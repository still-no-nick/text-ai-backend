import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Env } from "../../../config/env.js";
import { postProcessText } from "../use-cases/postProcessText.js";
import { createLlmProvider } from "../adapters/createLlmProvider.js";

const Kind = z.enum(["beautify", "expand", "compress"]).default("beautify");

const PostProcessBody = z.object({
  text: z.string().min(1),
  language: z.string().optional().default("ru"),
  style: z.enum(["chat", "doc"]).optional().default("chat"),
  kind: Kind.optional().default("beautify")
});

export async function registerPostProcessRoutes(app: FastifyInstance, deps: { env: Env }) {
  const llm = createLlmProvider(deps.env);

  app.post("/api/post-process", async (req) => {
    const body = PostProcessBody.parse(req.body);
    return await postProcessText({ text: body.text, language: body.language, style: body.style, kind: body.kind, llm });
  });
}

