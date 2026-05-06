import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Env } from "../../../config/env.js";
import { DomainError } from "../../../infra/http/errors.js";
import { MockSttProvider } from "../adapters/mockSttProvider.js";
import { PrismaTranscriptionRepository } from "../adapters/prismaTranscriptionRepository.js";
import { createTranscription } from "../use-cases/createTranscription.js";
import { getTranscription } from "../use-cases/getTranscription.js";

const Mode = z.enum(["auto", "sync", "async"]).default("auto");
const Style = z.enum(["chat", "doc"]).default("chat");

function parseBool(v: unknown, fallback: boolean) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return fallback;
}

export async function registerSttRoutes(app: FastifyInstance, deps: { env: Env }) {
  const provider = new MockSttProvider();
  const repo = new PrismaTranscriptionRepository();

  app.post("/api/stt/transcriptions", async (req, reply) => {
    const file = await req.file();
    if (!file) {
      throw new DomainError({ code: "VALIDATION_FAILED", message: "file is required", statusCode: 400 });
    }

    const language = (file.fields?.language?.value as string | undefined) ?? "ru-RU";
    const mode = Mode.parse((file.fields?.mode?.value as string | undefined) ?? "auto");
    const style = Style.parse((file.fields?.style?.value as string | undefined) ?? "chat");
    const postProcess = parseBool(file.fields?.postProcess?.value, true);

    if (mode === "async") {
      const task = await repo.create({ language, provider: provider.name });

      // Fire-and-forget async processing (BullMQ worker will replace this later)
      void (async () => {
        try {
          await createTranscription({
            file: { stream: file.file, contentType: file.mimetype },
            language,
            postProcess,
            style,
            provider,
            repo
          });
        } catch {
          // errors already persisted/mapped
        }
      })();

      void reply.status(201).send({
        id: task.id,
        status: "processing",
        language,
        provider: provider.name
      });
      return;
    }

    const result = await createTranscription({
      file: { stream: file.file, contentType: file.mimetype },
      language,
      postProcess,
      style,
      provider,
      repo
    });

    void reply.status(201).send({
      id: result.id,
      status: result.status,
      language: result.language ?? language,
      textRaw: result.textRaw,
      text: result.text,
      provider: result.provider,
      providerMeta: result.providerMeta ?? {}
    });
  });

  app.get(
    "/api/stt/transcriptions/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.any()
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const task = await getTranscription({ id, repo });
      if (!task) {
        throw new DomainError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
      }

      if (task.status === "failed") {
        return {
          id: task.id,
          status: "failed",
          error: task.error ?? { code: "PROVIDER_STT_FAILED", message: "Failed", retryable: true }
        };
      }

      if (task.status === "done") {
        return {
          id: task.id,
          status: "done",
          language: task.language ?? "ru-RU",
          textRaw: task.textRaw ?? "",
          text: task.text ?? task.textRaw ?? "",
          provider: task.provider,
          providerMeta: task.providerMeta ?? {}
        };
      }

      return { id: task.id, status: "processing" };
    }
  );

  // Placeholder for future: provider selection, auth, etc.
  void deps.env;
}

