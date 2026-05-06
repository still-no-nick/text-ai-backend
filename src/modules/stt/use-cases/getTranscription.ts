import type { TranscriptionRepository } from "../ports/transcriptionRepository.js";

export async function getTranscription(input: { id: string; repo: TranscriptionRepository }) {
  return input.repo.get(input.id);
}

