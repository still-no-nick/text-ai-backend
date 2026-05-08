import type { Readable } from "node:stream";

import type { SttProvider } from "../ports/sttProvider.js";
import type { TranscriptionRepository } from "../ports/transcriptionRepository.js";
import { DomainError } from "../../../infra/http/errors.js";
import { postProcessText, type PostProcessKind } from "../../post-process/use-cases/postProcessText.js";
import type { LlmProvider } from "../../post-process/ports/llmProvider.js";

export async function createTranscription(input: {
  file: { stream: Readable; contentType?: string };
  language: string;
  postProcess: boolean;
  style: "chat" | "doc";
  kind: PostProcessKind;
  llm: LlmProvider;
  provider: SttProvider;
  repo: TranscriptionRepository;
}) {
  if (!input.language) {
    throw new DomainError({ code: "VALIDATION_FAILED", message: "language is required", statusCode: 400 });
  }

  const task = await input.repo.create({ language: input.language, provider: input.provider.name });

  try {
    const stt = await input.provider.transcribeSync({
      audioStream: input.file.stream,
      language: input.language,
      ...(input.file.contentType ? { contentType: input.file.contentType } : {})
    });

    const processed = input.postProcess
      ? await postProcessText({
          text: stt.textRaw,
          language: input.language,
          style: input.style,
          kind: input.kind,
          llm: input.llm
        })
      : undefined;

    const done = await input.repo.markDone({
      id: task.id,
      language: input.language,
      provider: input.provider.name,
      textRaw: stt.textRaw,
      ...(processed?.text ? { text: processed.text } : {}),
      ...(stt.providerMeta ? { providerMeta: stt.providerMeta } : {})
    });

    return done;
  } catch (err) {
    if (err instanceof DomainError) {
      await input.repo.markFailed({
        id: task.id,
        code: err.code,
        message: err.message,
        retryable: err.retryable
      });
      throw err;
    }

    await input.repo.markFailed({
      id: task.id,
      code: "PROVIDER_STT_FAILED",
      message: "STT provider failed",
      retryable: true
    });
    throw new DomainError({
      code: "PROVIDER_STT_FAILED",
      message: "STT provider failed",
      statusCode: 502,
      retryable: true,
      cause: err
    });
  }
}

