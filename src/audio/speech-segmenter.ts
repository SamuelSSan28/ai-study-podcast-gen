const SENTENCE_BOUNDARY = /[^.!?…]+[.!?…]+(?:\s+|$)|[^.!?…]+$/g;

/** Split spoken text into sentence-sized units. */
export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(SENTENCE_BOUNDARY);
  if (!matches?.length) return [trimmed];
  return matches.map((s) => s.trim()).filter(Boolean);
}

/** Group sentences into TTS-sized semantic chunks (typically 1–3 sentences). */
export function segmentIntoChunks(text: string, maxSentencesPerChunk: number): string[] {
  const sentences = splitSentences(text);
  if (!sentences.length) return [];
  const limit = Math.max(1, maxSentencesPerChunk);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += limit) {
    chunks.push(sentences.slice(i, i + limit).join(' '));
  }
  return chunks;
}

export function endsWithQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim());
}
