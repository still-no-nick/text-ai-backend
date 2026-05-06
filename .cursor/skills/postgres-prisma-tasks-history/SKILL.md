---
name: postgres-prisma-tasks-history
description: Store STT tasks and results in PostgreSQL via Prisma (task lifecycle, idempotency, audit).
whenToUse:
  - You need a history of requests/results.
  - You need task statuses, errors, and retry handling.
---

## Goal

Add a database layer for:
- tasks
- results
- metadata (language, duration, model)

## Minimal data model (idea)

- `Task`:
  - `id` (uuid)
  - `status` (enum)
  - `createdAt`, `updatedAt`
  - `audioObjectKey` / `audioPath`
  - `errorCode`, `errorMessage` (no secrets)
- `TranscriptionResult`:
  - `taskId` (unique, 1:1)
  - `text`
  - `rawResponse` (jsonb, optional)

## Patterns

- Idempotency: `taskId` is the primary key; the worker checks status before writing results.
- Transactions: status updates + result writes should be atomic where needed.
- Migrations: use Prisma migrate.

## API on top of the DB (example)

- `POST /tasks` (create) — typically combined with upload
- `GET /tasks/:id` — status + result (when ready)
- `GET /tasks/:id/result` — result only (optional)

## Definition of done

- The worker does not create duplicate results on retries.
- Task statuses correctly reflect progress.
- Errors are safe to return to the client.
