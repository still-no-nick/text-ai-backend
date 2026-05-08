import type { Env } from "../../../config/env.js";
import type { LlmProvider } from "../ports/llmProvider.js";
import { MockLlmProvider } from "./mockLlmProvider.js";
import { YandexGptProvider } from "./yandexGptProvider.js";

export function createLlmProvider(env: Env): LlmProvider {
  if (
    env.LLM_PROVIDER === "yandexgpt" &&
    env.YANDEX_FOLDER_ID &&
    (env.YANDEX_API_KEY || env.YANDEX_IAM_TOKEN)
  ) {
    return new YandexGptProvider({
      folderId: env.YANDEX_FOLDER_ID,
      ...(env.YANDEX_API_KEY ? { apiKey: env.YANDEX_API_KEY } : {}),
      ...(env.YANDEX_IAM_TOKEN ? { iamToken: env.YANDEX_IAM_TOKEN } : {}),
      ...(env.YANDEX_GPT_ENDPOINT ? { endpoint: env.YANDEX_GPT_ENDPOINT } : {}),
      ...(env.YANDEX_GPT_MODEL_URI ? { modelUri: env.YANDEX_GPT_MODEL_URI } : {})
    });
  }

  return new MockLlmProvider();
}

