import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Env } from "../../../config/env.js";
import { DomainError } from "../../../infra/http/errors.js";
import { MockSttProvider } from "../adapters/mockSttProvider.js";
import { YandexSpeechKitSttProvider } from "../adapters/yandexSpeechKitSttProvider.js";
import { PrismaTranscriptionRepository } from "../adapters/prismaTranscriptionRepository.js";
import { createTranscription } from "../use-cases/createTranscription.js";
import { getTranscription } from "../use-cases/getTranscription.js";
import { createLlmProvider } from "../../post-process/adapters/createLlmProvider.js";

const Mode = z.enum(["auto", "sync", "async"]).default("auto");
const Style = z.enum(["chat", "doc"]).default("chat");
const Kind = z.enum(["beautify", "expand", "compress"]).default("beautify");

function parseBool(v: unknown, fallback: boolean) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return fallback;
}

export async function registerSttRoutes(app: FastifyInstance, deps: { env: Env }) {
  const pickField = (fields: unknown, key: string): string | undefined => {
    const f = fields as Record<string, unknown> | undefined;
    const v = f?.[key] as { value?: unknown } | undefined;
    return typeof v?.value === "string" ? v.value : undefined;
  };

  const provider =
    deps.env.YANDEX_FOLDER_ID && (deps.env.YANDEX_API_KEY || deps.env.YANDEX_IAM_TOKEN)
      ? new YandexSpeechKitSttProvider({
          folderId: deps.env.YANDEX_FOLDER_ID,
          ...(deps.env.YANDEX_API_KEY ? { apiKey: deps.env.YANDEX_API_KEY } : {}),
          ...(deps.env.YANDEX_IAM_TOKEN ? { iamToken: deps.env.YANDEX_IAM_TOKEN } : {})
        })
      : new MockSttProvider();
  const llm = createLlmProvider(deps.env);
  const repo = new PrismaTranscriptionRepository();

  app.log.info(
    {
      sttProvider: provider.name,
      hasFolderId: Boolean(deps.env.YANDEX_FOLDER_ID),
      hasApiKey: Boolean(deps.env.YANDEX_API_KEY),
      hasIamToken: Boolean(deps.env.YANDEX_IAM_TOKEN)
    },
    "STT provider selected"
  );

  app.post("/api/stt/transcriptions", async (req, reply) => {
    const file = await req.file();
    if (!file) {
      throw new DomainError({ code: "VALIDATION_FAILED", message: "file is required", statusCode: 400 });
    }

    const language = pickField(file.fields, "language") ?? "ru-RU";
    const mode = Mode.parse(pickField(file.fields, "mode") ?? "auto");
    const style = Style.parse(pickField(file.fields, "style") ?? "chat");
    const postProcess = parseBool(pickField(file.fields, "postProcess"), true);
    const kind = Kind.parse(pickField(file.fields, "kind") ?? "beautify");

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
            kind,
            llm,
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
      kind,
      llm,
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
    async (req) => {
      const { id } = req.params as { id: string };
      z.string().uuid().parse(id);
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

