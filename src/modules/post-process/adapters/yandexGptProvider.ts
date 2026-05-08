import type { LlmProvider } from "../ports/llmProvider.js";
import { DomainError } from "../../../infra/http/errors.js";

type YandexGptCompletionResponse = {
  result?: {
    alternatives?: Array<{
      message?: { role?: string; text?: string };
      status?: string;
    }>;
  };
};

export class YandexGptProvider implements LlmProvider {
  readonly name = "yandexgpt";

  constructor(
    private readonly cfg: {
      folderId: string;
      apiKey?: string;
      iamToken?: string;
      endpoint?: string;
      modelUri?: string;
    }
  ) {}

  async generate(input: { system: string; user: string }): Promise<string> {
    const endpoint = this.cfg.endpoint ?? "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

    const modelUri =
      this.cfg.modelUri && this.cfg.modelUri.trim()
        ? this.cfg.modelUri.trim()
        : `gpt://${this.cfg.folderId}/yandexgpt/latest`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (this.cfg.apiKey) headers.Authorization = `Api-Key ${this.cfg.apiKey}`;
    else if (this.cfg.iamToken) headers.Authorization = `Bearer ${this.cfg.iamToken}`;
    else {
      throw new DomainError({
        code: "POST_PROCESS_FAILED",
        message: "YandexGPT credentials are not configured (YANDEX_API_KEY or YANDEX_IAM_TOKEN)",
        statusCode: 500
      });
    }

    const body = {
      modelUri,
      completionOptions: {
        stream: false,
        temperature: 0.2,
        maxTokens: 800
      },
      messages: [
        { role: "system", text: input.system },
        { role: "user", text: input.user }
      ]
    };

    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) {
      throw new DomainError({
        code: "POST_PROCESS_FAILED",
        message: `YandexGPT error (${res.status}): ${text}`,
        statusCode: 502,
        retryable: res.status >= 500 || res.status === 429
      });
    }

    let parsed: YandexGptCompletionResponse | null = null;
    try {
      parsed = JSON.parse(text) as YandexGptCompletionResponse;
    } catch {
      parsed = null;
    }

    const out = parsed?.result?.alternatives?.[0]?.message?.text;
    return typeof out === "string" ? out.trim() : "";
  }
}

