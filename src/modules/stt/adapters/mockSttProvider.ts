import type { Readable } from "node:stream";

import type { SttProvider, SttSyncResult } from "../ports/sttProvider.js";
import { consumeStream } from "../../../lib/streams/consumeStream.js";

export class MockSttProvider implements SttProvider {
  public readonly name = "mock_stt";

  async transcribeSync(input: { audioStream: Readable; language: string; contentType?: string }): Promise<SttSyncResult> {
    await consumeStream(input.audioStream);

    // Minimal placeholder for end-to-end wiring.
    const textRaw =
      input.language.startsWith("ru")
        ? "привет это тестовая транскрибация без пунктуации э ну типа"
        : "hello this is a mock transcription without punctuation uh like";

    return {
      textRaw,
      providerMeta: {
        mock: true,
        contentType: input.contentType ?? null
      }
    };
  }
}

