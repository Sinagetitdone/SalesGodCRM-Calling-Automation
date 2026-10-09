import { readFileSync } from "node:fs";

import Fastify from "fastify";

import { CallOrchestrator } from "./application/call-orchestrator.js";
import { importContacts } from "./application/contact-import.js";
import { dispatchImportedContacts } from "./application/import-service.js";
import { SQLiteCallRepository } from "./application/sqlite-call-repository.js";
import type { ConsentRecord } from "./domain/consent.js";
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

app.get("/calls", async () => {
  return repository.list();
});

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
      imported = importContacts(
        request.body.csv,
        request.body.consents,
        new Set(request.body.doNotCallPhones ?? []),
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

      return reply.send({ accepted, rejected: imported.rejected });
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
