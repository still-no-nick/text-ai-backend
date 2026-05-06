---
name: s3-minio-temp-audio-storage
description: Temporary audio storage in an S3-compatible object store (MinIO locally, S3/alternative in prod), with streaming and TTL.
whenToUse:
  - You need scalable storage for uploaded audio between the API and the worker.
  - You can’t store large files on local disk (or you need HA).
---

## Goal

Store audio as an object in a bucket and pass it around by key (`objectKey`) via the queue/DB.

## Local vs production

- Local: MinIO + docker-compose
- Prod: S3/alternative (Yandex Object Storage, AWS S3, etc.)

## Rules

- Upload and download must be streaming (don’t buffer the full file).
- Separate “raw” and “artifacts” (e.g. `raw/` and `results/` prefixes).
- TTL:
  - either bucket lifecycle policy
  - or background cleanup jobs (if lifecycle is not available)

## Implementation template

1. `ObjectStorage` service:
   - `putObject({ stream, contentType, contentLength? }) -> objectKey`
   - `getObjectStream(objectKey) -> stream`
   - `deleteObject(objectKey)`
2. Key naming:
   - `raw/{yyyy}/{mm}/{dd}/{taskId}.{ext}`
3. Integration:
   - API: stores the file in S3/MinIO and enqueues `objectKey`
   - Worker: reads `objectKey`, downloads via streaming, runs STT

## Definition of done

- No full-file reads into memory.
- A TTL/cleanup strategy exists.
- Keys are deterministic and tied to `taskId`.
