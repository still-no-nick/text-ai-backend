export type TranscriptionStatus = "processing" | "done" | "failed";

export type TranscriptionError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type Transcription = {
  id: string;
  status: TranscriptionStatus;
  language?: string;
  provider: string;
  textRaw?: string;
  text?: string;
  providerMeta?: Record<string, unknown>;
  error?: TranscriptionError;
};

