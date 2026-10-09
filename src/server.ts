import { readFileSync } from "node:fs";

import Fastify from "fastify";

import { CallOrchestrator } from "./application/call-orchestrator.js";
import { importContacts } from "./application/contact-import.js";
import { dispatchImportedContacts } from "./application/import-service.js";
import { SQLiteCallRepository } from "./application/sqlite-call-repository.js";
import { followUpFor } from "./domain/call-outcome.js";
import type { ConsentRecord } from "./domain/consent.js";
import { type ConversationStage, nextTurn, openingTurn } from "./domain/conversation.js";
import { VOICEMAIL_SCRIPT } from "./domain/voicemail-script.js";
import { FakeSalesGodProvider } from "./integrations/salesgod/fake-provider.js";

const demoDir = new URL("../fixtures/", import.meta.url);
const publicDir = new URL("./public/", import.meta.url);

const app = Fastify({
  logger: true,
});

const repository = new SQLiteCallRepository(
  "data/local-app.db",
);

const provider = new FakeSalesGodProvider();

const orchestrator = new CallOrchestrator(
  repository,
  provider,
);

app.get("/", async (_request, reply) => {
  return reply
    .type("text/html; charset=utf-8")
    .send(readFileSync(new URL("index.html", publicDir), "utf8"));
});

app.get("/demo/data", async () => {
  return {
    csv: readFileSync(new URL("synthetic-contacts.csv", demoDir), "utf8"),
    consents: JSON.parse(
      readFileSync(new URL("synthetic-consent.json", demoDir), "utf8"),
    ),
  };
});

// Only the official JML logo files are served from this route.
const brandFiles = new Set([
  "JML-Logo-Full-Dark.svg",
  "JML-Logo-Full-Light.svg",
  "JML-Logo-J-Dark.svg",
  "JML-Logo-J-Light.svg",
]);

app.get<{ Params: { file: string } }>("/brand/:file", async (request, reply) => {
  if (!brandFiles.has(request.params.file)) {
    return reply.code(404).send({ error: "NOT_FOUND" });
  }

  return reply
    .type("image/svg+xml")
    .send(readFileSync(new URL(`./public/brand/${request.params.file}`, import.meta.url), "utf8"));
});

app.get("/calls", async () => {
  return repository.list();
});

app.get("/voicemail-script", async () => {
  return VOICEMAIL_SCRIPT;
});

app.get("/conversation/opening", async () => {
  return openingTurn();
});

app.post<{
  Body: {
    contactExternalId: string;
    phoneNumber: string;
    stage: ConversationStage;
    message: string;
  };
}>(
  "/conversation",
  {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["contactExternalId", "phoneNumber", "stage", "message"],
        properties: {
          contactExternalId: { type: "string", minLength: 1 },
          phoneNumber: { type: "string", pattern: "^\\+[1-9][0-9]{7,14}$" },
          stage: {
            type: "string",
            enum: ["GREETING", "SCHEDULING", "DONE", "OPTED_OUT"],
          },
          message: { type: "string", maxLength: 1000 },
        },
      },
    },
  },
  async (request) => {
    const turn = nextTurn(request.body.stage, request.body.message);

    // An opt-out is stored right away so no later import can dial this number.
    if (turn.optedOut && request.body.stage !== "OPTED_OUT") {
      await repository.addDoNotCall(request.body.phoneNumber);
    }

    return turn;
  },
);

app.post<{
  Body: {
    campaignExternalId: string;
    csv: string;
    consents: ConsentRecord[];
    doNotCallPhones?: string[];
    withinCallingWindow: boolean;
  };
}>(
  "/imports",
  {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["campaignExternalId", "csv", "consents", "withinCallingWindow"],
        properties: {
          campaignExternalId: { type: "string", minLength: 1 },
          csv: { type: "string", minLength: 1 },
          consents: { type: "array", items: { type: "object" } },
          doNotCallPhones: { type: "array", items: { type: "string" } },
          withinCallingWindow: { type: "boolean" },
        },
      },
    },
  },
  async (request, reply) => {
    let imported;

    try {
      // Numbers from the request and numbers that opted out earlier are both excluded.
      const doNotCall = new Set([
        ...(request.body.doNotCallPhones ?? []),
        ...(await repository.listDoNotCall()),
      ]);

      imported = importContacts(
        request.body.csv,
        request.body.consents,
        doNotCall,
      );
    } catch (error) {
      return reply.code(400).send({
        error: "INVALID_CSV",
        message: (error as Error).message,
      });
    }

    try {
      const accepted = await dispatchImportedContacts(
        imported,
        {
          campaignExternalId: request.body.campaignExternalId,
          withinCallingWindow: request.body.withinCallingWindow,
        },
        orchestrator,
      );

      return reply.send({
        accepted: accepted.map((call) => ({
          ...call,
          followUp: followUpFor(call),
        })),
        rejected: imported.rejected,
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(502).send({
        error: "PROVIDER_DISPATCH_FAILED",
      });
    }
  },
);

app.get("/health", async () => {
  return {
    status: "ok",
  };
});

app.get<{
  Params: {
    id: string;
  };
}>("/calls/:id", async (request, reply) => {
  const call = await repository.get(
    request.params.id,
  );

  if (!call) {
    return reply.code(404).send({
      error: "CALL_NOT_FOUND",
    });
  }

  return call;
});

app.post<{
  Body: {
    id: string;
    contactExternalId: string;
    campaignExternalId: string;
    consentConfirmed: boolean;
    doNotCall: boolean;
    withinCallingWindow: boolean;
    idempotencyKey: string;
  };
}>(
  "/calls",
  {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "contactExternalId",
          "campaignExternalId",
          "consentConfirmed",
          "doNotCall",
          "withinCallingWindow",
          "idempotencyKey",
        ],
        properties: {
          id: {
            type: "string",
            minLength: 1,
          },
          contactExternalId: {
            type: "string",
            minLength: 1,
          },
          campaignExternalId: {
            type: "string",
            minLength: 1,
          },
          consentConfirmed: {
            type: "boolean",
          },
          doNotCall: {
            type: "boolean",
          },
          withinCallingWindow: {
            type: "boolean",
          },
          idempotencyKey: {
            type: "string",
            minLength: 1,
          },
        },
      },
    },
  },
  async (request, reply) => {
    try {
      const result = await orchestrator.start(
        request.body,
      );

      return reply.code(200).send(result);
    } catch (error) {
      request.log.error(error);

      return reply.code(502).send({
        error: "PROVIDER_DISPATCH_FAILED",
      });
    }
  },
);

async function main(): Promise<void> {
  await app.listen({
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 3000),
  });
}

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
