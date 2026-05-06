import type { Transcription } from "../domain/types.js";

export interface TranscriptionRepository {
  create(input: { language: string; provider: string }): Promise<Transcription>;
  get(id: string): Promise<Transcription | null>;
  markDone(input: {
    id: string;
    language: string;
    provider: string;
    textRaw: string;
    text?: string;
    providerMeta?: Record<string, unknown>;
  }): Promise<Transcription>;
  markFailed(input: { id: string; code: string; message: string; retryable: boolean }): Promise<Transcription>;
}

