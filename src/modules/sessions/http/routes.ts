import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Env } from "../../../config/env.js";
import { nanoid } from "nanoid";

export async function registerSessionsRoutes(app: FastifyInstance, deps: { env: Env }) {
  app.post(
    "/api/sessions",
    {
      schema: {
        body: z.object({ language: z.string().optional().default("ru-RU") }),
        response: {
          201: z.object({ sessionId: z.string(), wsUrl: z.string() })
        }
      }
    },
    async (req, reply) => {
      const body = req.body as { language?: string };
      const sessionId = nanoid();
      const wsUrl = `ws://${deps.env.HOST}:${deps.env.PORT}/api/transcribe?sessionId=${encodeURIComponent(
        sessionId
      )}&language=${encodeURIComponent(body.language ?? "ru-RU")}`;
      void reply.status(201).send({ sessionId, wsUrl });
    }
  );

  app.get(
    "/api/transcribe",
    { websocket: true },
    (connection) => {
      connection.socket.send(
        JSON.stringify({
          type: "error",
          code: "NOT_IMPLEMENTED",
          message: "Streaming transcription is not implemented yet"
        })
      );
      connection.socket.close();
    }
  );
}

