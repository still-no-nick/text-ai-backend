---
name: fastify-multipart-audio-upload
description: Implement audio upload via multipart/form-data in Fastify (file + metadata), with limits and security.
whenToUse:
  - You need to accept an audio file from a client (web/mobile) and store it temporarily (disk/S3).
  - You need to support large files and enforce upload limits.
---

## Goal

Create an endpoint `POST /audio/upload` (or `POST /stt`) that accepts an audio file plus parameters and returns a `jobId`/`taskId`.

## Security and UX

- Enforce size limits (`bodyLimit` / multipart limits).
- Validate content-type/extension, but only rely on sniffing/signatures if you truly need it.
- Never store SpeechKit secrets on the client.

## Recommended request shape

`multipart/form-data`:
- `file`: audio
- `lang`: string (e.g. `ru-RU`)
- `format`: optional (`wav`, `ogg`, `mp3`)
- `callbackUrl`: optional (if you need a webhook)

## Implementation template

1. Register `@fastify/multipart`.
2. In the route:
   - read parts as streams
   - validate metadata
   - store the file:
     - MVP: on disk (tmp + TTL)
     - prod: S3/MinIO (streaming)
3. Return:
   - `202 Accepted` with `taskId` (if you continue via queue/async STT)
   - or `200 OK` with the text (if synchronous and fast)

## Common mistakes

- Reading the whole file into memory (not acceptable for long recordings).
- Not setting multipart limits.
- Not closing streams / not handling streaming errors.

## Definition of done

- A large file is never loaded fully into RAM.
- Size/type limits work.
- The endpoint returns a task identifier for tracking.
