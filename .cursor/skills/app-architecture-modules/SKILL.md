---
name: app-architecture-modules
description: Architecture for a modular monolith with hexagonal/clean boundaries and swappable providers (STT/LLM/Storage).
whenToUse:
  - You need to design/refactor a backend for STT + post-processing (LLM) without microservices.
  - You need “clean” boundaries (ports/adapters) to easily swap external providers.
  - You want to organize code feature-first by domain modules rather than by layers.
---

## Goal

Build a “modular monolith” (one deploy, one repo) with clean/hexagonal boundaries: business logic and use cases must not depend on Fastify/Prisma/SpeechKit/LLM SDKs. This keeps iteration fast early on and allows you to later extract heavy parts (workers/jobs/STT) into a separate service without rewriting the domain.

## Core principles

- **Feature-first**: group code by modules/domains (`stt`, `post-process`, `jobs`), not by “controllers/services/repositories”.
- **Ports/Adapters**:
  - the domain/use-cases depend only on ports (interfaces)
  - external integrations (SpeechKit, LLM, S3/MinIO, BullMQ, Prisma) are adapters
- **LLM integrations only through a port**: no OpenAI/Anthropic/YandexGPT SDK dependencies inside use-cases/domain. Switching providers = swapping an adapter, not changing business logic.
- **DTOs + input validation**: the HTTP layer does auth/validation/parsing (including multipart) and calls use-cases.
- **Domain errors and statuses**: consistent error codes/task statuses; the HTTP layer only maps them to correct HTTP status codes/responses.

## Recommended structure (Node.js + TS)

Reference layout (names can be adapted to your repo style):

- `src/modules/stt/`
  - `domain/`: statuses, rules, errors (no HTTP/DB)
  - `use-cases/`: `createTranscription`, `getTranscription`
  - `ports/`: `SttProvider`, `AudioStorage`, `TranscriptionRepository`, `Clock` (minimal required dependencies)
  - `adapters/`: `YandexSpeechKitSttProvider`, `S3AudioStorage`, `PrismaTranscriptionRepository`
  - `http/`: Fastify routes + DTO schemas
- `src/modules/post-process/`
  - `use-cases/`: `postProcessText`
  - `ports/`: `LlmProvider` (and/or a narrower `TextEnhancer`)
  - `adapters/`: `OpenAIProvider` / `AnthropicProvider` / `YandexGptProvider`, etc.
- `src/modules/jobs/`
  - `ports/`: `QueuePort` (enqueue), `WorkerRuntime` (process)
  - `adapters/`: `BullMqQueue`, `BullMqWorker`
- `src/infra/http/`: Fastify composition, plugins, global error handler
- `src/infra/db/`: Prisma client, migrations, transactions
- `src/config/`: env + configuration validation (including provider selection)

Important: HTTP/infra must not “leak” into the domain. A use-case receives dependencies via a constructor/factory (manual dependency injection; no container needed yet).

## Port contracts (minimal set)

### STT

- `SttProvider`
  - `transcribeSync(input) -> { textRaw, meta }`
  - `startAsync(input) -> { operationId }`
  - `poll(operationId) -> { status, textRaw?, meta? }`

### LLM (post-processing)

Rule: the post-process use-case only knows “what it wants to get”, not “which SDK it uses”.

- `LlmProvider`
  - `complete(input) -> { text }` (or a more specific method, e.g. `enhanceTranscript`)

Recommendations:
- return a **normalized** result (string + metadata), not the provider’s raw response
- keep “prompting” inside the adapter or in config/templates, but don’t spread it across the domain

### Audio storage

- `AudioStorage`
  - `put(stream, meta) -> { objectKey, contentType, size }`
  - `get(objectKey) -> stream`
  - `delete(objectKey)` (if TTL is not guaranteed)

### Tasks/results repository

- `TranscriptionRepository`
  - `create(draft) -> task`
  - `get(id) -> task`
  - `updateStatus(id, patch) -> task`

## End-to-end flows

### `POST /api/stt/transcriptions`

- HTTP layer: auth → multipart parse → DTO validation
- `createTranscription`:
  - stores audio in temporary storage
  - chooses sync vs async based on duration/size/config
  - sync: calls `SttProvider.transcribeSync` → persists result → (optionally) `postProcessText` → responds `done`
  - async: creates a task → enqueues a job → responds `processing (202)`

### `GET /api/stt/transcriptions/:id`

- HTTP layer: auth → validation
- `getTranscription`:
  - reads the task from the repository
  - returns `processing/done/failed`
  - if `done`: can return `textRaw` and `text` (post-processed) as two versions

### Worker (jobs)

- takes `taskId` → reads audio from storage → calls `SttProvider` (async polling/processing) → stores `textRaw` → (optionally) runs `postProcessText` → stores `text` → cleans up temporary audio based on policy

## Practical rules for painless provider swaps

- In the domain/use-cases, importing provider SDKs/clients is **forbidden** (SpeechKit SDK, OpenAI SDK, etc.).
- Any external API = an adapter implementing a port (`LlmProvider`, `SttProvider`).
- Map provider errors → your `DomainError` (e.g. `RATE_LIMIT`, `INVALID_AUDIO`, `PROVIDER_UNAVAILABLE`).
- Provider selection (and keys) lives in config/env at the composition root level (e.g. `src/app.ts`/`src/infra/*`), not inside a use-case.

## Definition of done

- Each module has `use-cases/`, `ports/`, `adapters/`, and dependencies point **inward** (use-cases depend on ports).
- You can swap the LLM provider (OpenAI ↔ Anthropic ↔ YandexGPT) by changing the adapter and configuration **without** touching use-cases/domain code.
- The HTTP layer contains no business logic: only auth/validation/error mapping.
- For async flows, task statuses and idempotency are defined and enforced (especially on queue retries).
