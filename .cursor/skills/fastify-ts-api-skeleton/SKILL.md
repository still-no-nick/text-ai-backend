---
name: fastify-ts-api-skeleton
description: Quickly bootstrap a Node.js + TypeScript Fastify API with validation and a modular structure.
whenToUse:
  - You need to create a new backend service for an HTTP API.
  - You need to add a new module/router to a Fastify project.
  - You want consistent types/DTOs/validation for requests/responses.
---

## Goal

Bootstrap a minimal but production-appropriate Fastify API in TypeScript: config, env, validation, error handling, health checks.

## Principles

- Minimal code for the MVP, without “enterprise” heaviness.
- Types at the boundary: validate input and keep guaranteed types internally.
- No secrets on the client—server-side only via env/secret manager.

## Recommended structure

- `src/app.ts`: create Fastify instance, plugins, routes
- `src/server.ts`: start/stop
- `src/config/env.ts`: read and validate env
- `src/modules/*`: modules (routes + services + types)
- `src/lib/*`: shared utilities (http, errors, logger)

## What to do (template)

1. Create a `FastifyInstance` with `pino` logger (built into Fastify).
2. Add plugins:
   - `@fastify/sensible` (httpErrors, helpful utilities)
   - `@fastify/swagger` / `@fastify/swagger-ui` (optional)
3. Add:
   - `GET /healthz` (200 OK)
   - `GET /readyz` (check Redis/DB if connected)
4. Validation:
   - either JSON Schema (built into Fastify)
   - or zod + `@fastify/type-provider-zod` (if you want a shared approach with the frontend)
5. Centralized error handler:
   - map domain errors → HTTP codes
   - safe outward-facing messages

## Definition of done

- The API starts and serves `GET /healthz`.
- Every route has a schema/validation.
- Secrets are loaded from env and validated at startup.
