import { RU_FILLERS } from "../domain/fillers.js";
import { DomainError } from "../../../infra/http/errors.js";
import type { LlmProvider } from "../ports/llmProvider.js";

export type PostProcessStyle = "chat" | "doc";
export type PostProcessKind = "beautify" | "expand" | "compress";

function beautify(input: { text: string; style: PostProcessStyle }): { text: string } {
  const raw = input.text.trim();
  const tokens = raw
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((t) => t.length > 0);

  const filtered = tokens.filter((t) => {
    const lower = t.toLowerCase();
    return !RU_FILLERS.includes(lower);
  });

  let text = filtered.join(" ").trim();
  if (!text) text = raw;

  // Minimal punctuation: just ensure final dot for chat/doc.
  if (!/[.!?…]$/.test(text)) {
    text = `${text}.`;
  }

  // Minimal paragraphing for doc style (very conservative).
  if (input.style === "doc") {
    text = text.replace(/\. (\p{Lu})/gu, ".\n\n$1");
  }

  // Capitalize first letter (unicode-aware for ru/en)
  text = text.replace(/^(\p{L})/u, (m) => m.toUpperCase());

  return { text };
}

export async function postProcessText(input: {
  text: string;
  language?: string;
  style: PostProcessStyle;
  kind?: PostProcessKind;
  llm: LlmProvider;
}): Promise<{ text: string }> {
  const raw = input.text.trim();
  if (!raw) {
    throw new DomainError({
      code: "VALIDATION_FAILED",
      message: "text is required",
      statusCode: 400
    });
  }

  const kind = input.kind ?? "beautify";
  if (kind === "beautify") {
    return beautify({ text: raw, style: input.style });
  }

  const base = beautify({ text: raw, style: "chat" }).text;

  const system = [
    "You are a careful Russian editor.",
    "Do not invent facts or add details that are not in the source.",
    "Preserve the original meaning.",
    "Return plain text only. No markdown, no quotes, no bullet characters unless they were implied by the content."
  ].join("\n");

  const user =
    kind === "expand"
      ? `Расширь текст по смыслу, слегка перефразируя, но не добавляя новых фактов:\n\n${base}`
      : `Сожми текст, чтобы осталась суть (без потери ключевых мыслей) и без добавления новых фактов:\n\n${base}`;

  const out = (await input.llm.generate({ system, user })).trim();
  if (!out) {
    throw new DomainError({
      code: "POST_PROCESS_FAILED",
      message: "LLM returned empty response",
      statusCode: 502,
      retryable: true
    });
  }

  return { text: out };
}

