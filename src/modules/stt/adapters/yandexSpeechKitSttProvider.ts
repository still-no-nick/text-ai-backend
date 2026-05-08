import type { Readable } from "node:stream";

import type { SttProvider, SttSyncResult } from "../ports/sttProvider.js";
import { DomainError } from "../../../infra/http/errors.js";

async function readToBuffer(stream: Readable, limitBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer);
    total += buf.length;
    if (total > limitBytes) {
      throw new DomainError({
        code: "UNSUPPORTED_AUDIO",
        message: "Audio file is too large for sync recognition",
        statusCode: 413
      });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function resolveSpeechKitFormat(contentType?: string): { format: string; contentTypeHint: string } {
  // MVP: only the most predictable formats. If frontend sends webm/opus, we'll add transcoding later.
  if (!contentType) return { format: "lpcm", contentTypeHint: "audio/wav" };

  if (contentType.includes("audio/wav") || contentType.includes("audio/x-wav")) {
    return { format: "lpcm", contentTypeHint: "audio/wav" };
  }
  if (contentType.includes("audio/ogg")) {
    return { format: "oggopus", contentTypeHint: "audio/ogg" };
  }

  throw new DomainError({
    code: "UNSUPPORTED_AUDIO",
    message: `Unsupported audio content-type: ${contentType}. Use WAV (PCM) or OGG/Opus for now.`,
    statusCode: 415,
    retryable: false
  });
}

function isWav(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE";
}

function stripWavToPcm16(buf: Buffer): { pcm: Buffer; sampleRate: number; channels: number; bitsPerSample: number } {
  if (!isWav(buf)) {
    throw new DomainError({
      code: "UNSUPPORTED_AUDIO",
      message: "Invalid WAV container",
      statusCode: 415,
      retryable: false
    });
  }

  // Minimal WAV parser (PCM only). We search for 'fmt ' and 'data' chunks.
  let offset = 12;
  let fmt: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;
  let dataOffset = -1;
  let dataSize = -1;

  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (id === "fmt " && chunkStart + 16 <= buf.length) {
      const audioFormat = buf.readUInt16LE(chunkStart);
      const channels = buf.readUInt16LE(chunkStart + 2);
      const sampleRate = buf.readUInt32LE(chunkStart + 4);
      const bitsPerSample = buf.readUInt16LE(chunkStart + 14);
      fmt = { audioFormat, channels, sampleRate, bitsPerSample };
    }
    if (id === "data") {
      dataOffset = chunkStart;
      dataSize = Math.min(size, Math.max(0, buf.length - chunkStart));
      break;
    }
    offset = chunkStart + size + (size % 2);
  }

  if (!fmt || dataOffset < 0 || dataSize < 0) {
    throw new DomainError({
      code: "UNSUPPORTED_AUDIO",
      message: "Unsupported WAV structure",
      statusCode: 415,
      retryable: false
    });
  }

  // PCM = 1
  if (fmt.audioFormat !== 1) {
    throw new DomainError({
      code: "UNSUPPORTED_AUDIO",
      message: "Only PCM WAV is supported for now",
      statusCode: 415,
      retryable: false
    });
  }

  return {
    pcm: buf.subarray(dataOffset, dataOffset + dataSize),
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    bitsPerSample: fmt.bitsPerSample
  };
}

export class YandexSpeechKitSttProvider implements SttProvider {
  public readonly name = "yandex_speechkit";

  constructor(
    private readonly cfg: {
      folderId: string;
      apiKey?: string;
      iamToken?: string;
      endpoint?: string;
    }
  ) {}

  async transcribeSync(input: { audioStream: Readable; language: string; contentType?: string }): Promise<SttSyncResult> {
    const endpoint = this.cfg.endpoint ?? "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize";
    const { format } = resolveSpeechKitFormat(input.contentType);

    // Keep sync path conservative: do not buffer huge inputs.
    const audioBuf = await readToBuffer(input.audioStream, 25 * 1024 * 1024);
    const body =
      format === "lpcm" && (input.contentType?.includes("audio/wav") || input.contentType?.includes("audio/x-wav"))
        ? stripWavToPcm16(audioBuf).pcm
        : audioBuf;

    const url = new URL(endpoint);
    url.searchParams.set("lang", input.language || "ru-RU");
    url.searchParams.set("format", format);
    url.searchParams.set("folderId", this.cfg.folderId);
    if (format === "lpcm") {
      // SpeechKit requires sample rate for raw PCM.
      url.searchParams.set("sampleRateHertz", "16000");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream"
    };

    // Prefer Api-Key if provided; fallback to IAM token.
    if (this.cfg.apiKey) headers.Authorization = `Api-Key ${this.cfg.apiKey}`;
    else if (this.cfg.iamToken) headers.Authorization = `Bearer ${this.cfg.iamToken}`;
    else {
      throw new DomainError({
        code: "PROVIDER_STT_FAILED",
        message: "SpeechKit credentials are not configured (YANDEX_API_KEY or YANDEX_IAM_TOKEN)",
        statusCode: 500
      });
    }

    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body });
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      throw new DomainError({
        code: "PROVIDER_STT_FAILED",
        message: `SpeechKit network error: ${msg}`,
        statusCode: 502,
        retryable: true,
        cause: err
      });
    }
    const text = await res.text();
    if (!res.ok) {
      throw new DomainError({
        code: "PROVIDER_STT_FAILED",
        message: `SpeechKit error (${res.status}): ${text}`,
        statusCode: 502,
        retryable: res.status >= 500 || res.status === 429
      });
    }

    // SpeechKit response is JSON; we parse minimally and return normalized text.
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const resultText =
      (parsed && typeof parsed === "object" && "result" in parsed && typeof (parsed as any).result === "string"
        ? (parsed as any).result
        : "") || "";

    return {
      textRaw: resultText,
      providerMeta: {
        format,
        httpStatus: res.status
      }
    };
  }
}

