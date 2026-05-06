import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  YANDEX_FOLDER_ID: z.string().optional(),
  YANDEX_IAM_TOKEN: z.string().optional(),

  LLM_PROVIDER: z.enum(["mock"]).default("mock")
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(rawEnv: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Invalid environment variables: ${details}`);
  }
  return parsed.data;
}

