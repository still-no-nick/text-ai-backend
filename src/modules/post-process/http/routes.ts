import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { postProcessText } from "../use-cases/postProcessText.js";

const PostProcessBody = z.object({
  text: z.string().min(1),
  language: z.string().optional().default("ru"),
  style: z.enum(["chat", "doc"]).optional().default("chat")
});

export async function registerPostProcessRoutes(app: FastifyInstance) {
  app.post(
    "/api/post-process",
    {
      schema: {
        body: PostProcessBody,
        response: {
          200: z.object({ text: z.string() })
        }
      }
    },
    async (req) => {
      const body = req.body as z.infer<typeof PostProcessBody>;
      return postProcessText({ text: body.text, language: body.language, style: body.style });
    }
  );
}

