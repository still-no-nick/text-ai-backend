import type { Readable } from "node:stream";

export type SttSyncResult = { textRaw: string; providerMeta?: Record<string, unknown> };

export interface SttProvider {
  readonly name: string;
  transcribeSync(input: {
    audioStream: Readable;
    language: string;
    contentType?: string;
  }): Promise<SttSyncResult>;
}

