import type { LlmProvider } from "../ports/llmProvider.js";

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async generate(): Promise<string> {
    throw new Error("LLM provider is not configured (LLM_PROVIDER=mock)");
  }
}

