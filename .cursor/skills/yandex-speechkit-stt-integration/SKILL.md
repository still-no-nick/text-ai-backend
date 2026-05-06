---
name: yandex-speechkit-stt-integration
description: STT integration with Yandex SpeechKit (sync/async), with safe secret handling and retries.
whenToUse:
  - You need to send audio to Yandex SpeechKit and get text back.
  - You need to support long recordings and an async pipeline (job + polling).
---

## Goal

Wrap SpeechKit in a reliable service layer: `SpeechkitClient`, which can:
- send audio (stream/URL)
- get results (sync or async polling)
- normalize responses into your DTO format

## Key rules

- Secrets (API key / IAM token / folderId) must stay server-side, via env.
- HTTP client: `fetch` (Node 18+ / undici).
- Logs: never log tokens or audio contents.

## Two modes

### Synchronous (short audio)

- Client uploads a file
- Server sends it to SpeechKit
- Server returns the text in the same request

Good for short recordings and simple UX.

### Asynchronous (long audio)

- Client uploads a file
- Server enqueues a task
- Worker sends it to SpeechKit
- Worker polls (or receives a callback if you use one)
- Result is stored (DB/S3) and served via `GET /tasks/:id`

## What to do (implementation checklist)

1. Define `SpeechkitConfig` (env):
   - `SPEECHKIT_API_KEY`/`SPEECHKIT_IAM_TOKEN` (depending on the chosen auth scheme)
   - `SPEECHKIT_FOLDER_ID` (if needed)
   - timeouts/retries
2. Implement `SpeechkitClient`:
   - `transcribeSync(input)` → `text`
   - `startTranscribeAsync(input)` → `operationId`
   - `getOperation(operationId)` → `status + result`
3. Add result normalization:
   - merge segments
   - confidence (if available)
   - language/model (as metadata)
4. Retries:
   - on network/5xx: exponential backoff
   - on 4xx: no retry (except rate limit, if applicable)

## Definition of done

- Config is validated on service startup.
- SpeechKit errors are mapped to clear domain errors (without leaking secrets).
- There is a separate path for long audio (through the queue).
