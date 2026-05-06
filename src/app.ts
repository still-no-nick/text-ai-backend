import Fastify from "fastify";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { fastifyZodOpenApiPlugin, fastifyZodOpenApiTransform, fastifyZodOpenApiTransformObject } from "@fastify/zod";

import type { Env } from "./config/env.js";
import { registerErrorHandler } from "./infra/http/errors.js";
import { registerSwagger } from "./infra/http/swagger.js";
import { registerHealthRoutes } from "./modules/health/http/routes.js";
import { registerSttRoutes } from "./modules/stt/http/routes.js";
import { registerPostProcessRoutes } from "./modules/post-process/http/routes.js";
import { registerSessionsRoutes } from "./modules/sessions/http/routes.js";

export async function buildApp(deps: { env: Env }) {
  const app = Fastify({
    logger:
      deps.env.NODE_ENV === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" }
            }
          }
        : true
  });

  await app.register(sensible);

  await app.register(fastifyZodOpenApiPlugin, {
    transform: fastifyZodOpenApiTransform,
    transformObject: fastifyZodOpenApiTransformObject
  });

  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024
    }
  });

  await app.register(websocket);

  registerErrorHandler(app);
  await registerSwagger(app);

  await registerHealthRoutes(app);
  await registerPostProcessRoutes(app);
  await registerSttRoutes(app, { env: deps.env });
  await registerSessionsRoutes(app, { env: deps.env });

  return app;
}

