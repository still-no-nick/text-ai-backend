---
name: docker-compose-dev-stack
description: Bring up a dev environment via Docker Compose (API + Redis + Postgres + MinIO) with convenient environment variables.
whenToUse:
  - You need a fast, reproducible dev stack.
  - You want the whole team to run the same local API + worker setup.
---

## Goal

Create a `docker-compose.yml` for:
- `api` (Fastify)
- `worker` (BullMQ)
- `redis`
- `postgres`
- `minio`

## Practices

- Separate local `.env` from production secrets (use a secret manager in prod).
- Mount volumes for Postgres and MinIO.
- Add healthchecks and dependencies (`depends_on` + healthcheck where appropriate).
- Logs go to stdout/stderr.

## Definition of done

- `docker compose up` brings up all dependencies.
- The API responds to `GET /healthz`, and the worker connects to Redis.
- Prisma can apply migrations to the local Postgres.
