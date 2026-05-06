import type { Prisma } from "@prisma/client";
import { TranscriptionStatus } from "@prisma/client";

import type { TranscriptionRepository } from "../ports/transcriptionRepository.js";
import type { Transcription } from "../domain/types.js";
import { getPrisma } from "../../../infra/db/prisma.js";

function toDomain(row: {
  id: string;
  status: TranscriptionStatus;
  language: string | null;
  provider: string;
  textRaw: string | null;
  text: string | null;
  providerMeta: Prisma.JsonValue | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorRetryable: boolean | null;
}): Transcription {
  return {
    id: row.id,
    status: row.status,
    language: row.language ?? undefined,
    provider: row.provider,
    textRaw: row.textRaw ?? undefined,
    text: row.text ?? undefined,
    providerMeta: (row.providerMeta as Record<string, unknown> | null) ?? undefined,
    error:
      row.errorCode && row.errorMessage
        ? { code: row.errorCode, message: row.errorMessage, retryable: row.errorRetryable ?? false }
        : undefined
  };
}

export class PrismaTranscriptionRepository implements TranscriptionRepository {
  async create(input: { language: string; provider: string }): Promise<Transcription> {
    const prisma = getPrisma();
    const row = await prisma.transcription.create({
      data: { language: input.language, provider: input.provider, status: "processing" }
    });
    return toDomain(row);
  }

  async get(id: string): Promise<Transcription | null> {
    const prisma = getPrisma();
    const row = await prisma.transcription.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async markDone(input: {
    id: string;
    language: string;
    provider: string;
    textRaw: string;
    text?: string;
    providerMeta?: Record<string, unknown>;
  }): Promise<Transcription> {
    const prisma = getPrisma();
    const row = await prisma.transcription.update({
      where: { id: input.id },
      data: {
        status: "done",
        language: input.language,
        provider: input.provider,
        textRaw: input.textRaw,
        text: input.text ?? null,
        providerMeta: (input.providerMeta ?? null) as Prisma.JsonValue
      }
    });
    return toDomain(row);
  }

  async markFailed(input: { id: string; code: string; message: string; retryable: boolean }): Promise<Transcription> {
    const prisma = getPrisma();
    const row = await prisma.transcription.update({
      where: { id: input.id },
      data: {
        status: "failed",
        errorCode: input.code,
        errorMessage: input.message,
        errorRetryable: input.retryable
      }
    });
    return toDomain(row);
  }
}

