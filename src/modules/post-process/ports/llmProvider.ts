export type LlmGenerateInput = {
  system: string;
  user: string;
};

export interface LlmProvider {
  readonly name: string;
  generate(input: LlmGenerateInput): Promise<string>;
}

