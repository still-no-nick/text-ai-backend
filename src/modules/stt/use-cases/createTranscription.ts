import type { Readable } from "node:stream";

import type { SttProvider } from "../ports/sttProvider.js";
import type { TranscriptionRepository } from "../ports/transcriptionRepository.js";
import { DomainError } from "../../../infra/http/errors.js";
import { postProcessText } from "../../post-process/use-cases/postProcessText.js";

export async function createTranscription(input: {
  file: { stream: Readable; contentType?: string };
  language: string;
  postProcess: boolean;
  style: "chat" | "doc";
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
      contentType: input.file.contentType
    });

    const processed = input.postProcess
      ? postProcessText({ text: stt.textRaw, language: input.language, style: input.style })
      : undefined;

    const done = await input.repo.markDone({
      id: task.id,
      language: input.language,
      provider: input.provider.name,
      textRaw: stt.textRaw,
      text: processed?.text,
      providerMeta: stt.providerMeta
    });

    return done;
  } catch (err) {
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

