import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Env } from "../../../config/env.js";
import { nanoid } from "nanoid";

const CreateSessionBody = z.object({
  language: z.string().optional().default("ru-RU")
});

export async function registerSessionsRoutes(app: FastifyInstance, deps: { env: Env }) {
  app.post("/api/sessions", async (req, reply) => {
    const body = CreateSessionBody.parse(req.body);
    const sessionId = nanoid();
    const wsUrl = `ws://${deps.env.HOST}:${deps.env.PORT}/api/transcribe?sessionId=${encodeURIComponent(
      sessionId
    )}&language=${encodeURIComponent(body.language)}`;
    void reply.status(201).send({ sessionId, wsUrl });
  });

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

