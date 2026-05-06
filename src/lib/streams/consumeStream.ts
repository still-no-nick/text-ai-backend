import type { Readable } from "node:stream";

export async function consumeStream(stream: Readable): Promise<void> {
  for await (const _chunk of stream) {
    // intentionally discard
  }
}

