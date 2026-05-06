---
name: observability-pino-prometheus-sentry
description: Add observability: pino logs, basic Prometheus metrics, and optional Sentry for API/worker.
whenToUse:
  - You need to quickly diagnose issues in the API/worker.
  - You want production-grade visibility without major complexity.
---

## Goal

Minimal but useful setup:
- structured logs (pino) with context (requestId/taskId/jobId)
- optional metrics for RPS/latency/queue/errors
- optional exception reporting via Sentry

## Logs (pino)

- In the API:
  - log incoming requests (Fastify does this out of the box)
  - add correlation: `request.id` + your `taskId` (if present)
- In the worker:
  - log `taskId`, `jobId`, step durations, attempt (`attemptsMade`)
  - never log tokens/secrets; never log full audio contents

## Metrics (Prometheus, optional)

Minimal set:
- `http_requests_total{route,method,status}`
- `http_request_duration_seconds{route,method}`
- `stt_jobs_total{status}`
- `stt_job_duration_seconds`
- `bullmq_queue_waiting` / `active` (if you collect them)

## Sentry (optional)

- Enable via env (`SENTRY_DSN`).
- In the API: capture errors in the error handler.
- In the worker: capture unhandled exceptions and job failures.

## Definition of done

- For a single `taskId`, you can trace the full path in logs (API → queue → worker).
- Basic metrics exist for HTTP and jobs (if enabled).
- Sentry receives no secrets, only safe context.
