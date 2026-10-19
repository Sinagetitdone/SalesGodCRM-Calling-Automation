import Fastify from "fastify";

import { CallOrchestrator } from "./application/call-orchestrator.js";
import { CallIdConflictError } from "./application/call-repository.js";
import { SQLiteCallRepository } from "./application/sqlite-call-repository.js";
import { FakeSalesGodProvider } from "./integrations/salesgod/fake-provider.js";

const app = Fastify({
  logger: true,
});

const repository = new SQLiteCallRepository(
  process.env.CALL_DATABASE_PATH ?? "data/local-app.db",
);

const provider = new FakeSalesGodProvider();

const orchestrator = new CallOrchestrator(
  repository,
  provider,
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
    consentConfirmed?: boolean;
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
      if (error instanceof CallIdConflictError) {
        return reply.code(409).send({ error: "CALL_ID_CONFLICT" });
      }
      request.log.error(error);

      return reply.code(502).send({
        error: "PROVIDER_DISPATCH_FAILED",
      });
    }
  },
);

async function main(): Promise<void> {
  await app.listen({
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3000),
  });
}

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
