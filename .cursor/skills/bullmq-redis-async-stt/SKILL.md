---
name: bullmq-redis-async-stt
description: Build an async speech-to-text pipeline with BullMQ + Redis (producer/worker), with retries and task statuses.
whenToUse:
  - You need to process long audio outside the HTTP request.
  - You need SpeechKit retries/polling without blocking the API.
---

## Goal

Split API and processing:
- API: accepts upload, creates a task, enqueues a job
- Worker: runs STT + post-processing, updates task/result

## Components

- Redis: queue broker
- BullMQ: queue + workers + retries
- (optional) PostgreSQL: store task history and results

## Job design

Recommended job payload:
- `taskId`
- `audioObjectKey` (if S3/MinIO) or `tmpPath` (if disk)
- `lang`, `model`, `options`

## Task statuses (example)

- `PENDING` → `PROCESSING` → `DONE`
- `FAILED` (with `errorCode` + safe `errorMessage`)

## Implementation template

1. Queue:
   - `sttQueue = new Queue("stt", { connection })`
2. Producer (API):
   - create a task record (if you have a DB)
   - `await sttQueue.add("transcribe", { taskId, ... }, { attempts, backoff })`
   - return `202` + `taskId`
3. Worker:
   - `new Worker("stt", processor, { concurrency })`
   - processor steps:
     - download/read audio (streaming)
     - call SpeechKit (async/sync)
     - post-processing (text normalization)
     - persist result
     - clean temporary files (if disk)
4. Observability:
   - log `taskId`, `jobId`, durations
   - queue metrics (optional)

## Definition of done

- After upload, the client gets a `taskId` and can poll `GET /tasks/:id`.
- Retries on transient errors do not “duplicate” results (idempotency by `taskId`).
- Temporary audio is cleaned up (TTL or explicit cleanup).
