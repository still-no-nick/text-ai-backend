import { RU_FILLERS } from "../domain/fillers.js";
import { DomainError } from "../../../infra/http/errors.js";

export type PostProcessStyle = "chat" | "doc";

export function postProcessText(input: { text: string; language?: string; style: PostProcessStyle }): { text: string } {
  const raw = input.text.trim();
  if (!raw) {
    throw new DomainError({
      code: "VALIDATION_FAILED",
      message: "text is required",
      statusCode: 400
    });
  }

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

