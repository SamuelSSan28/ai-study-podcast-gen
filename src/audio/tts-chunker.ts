import { ScriptTurn } from '../domain/models';

export function buildTtsChunks(turns: ScriptTurn[], maxCharacters = 3500): ScriptTurn[] {
  const chunks: ScriptTurn[] = [];
  for (const turn of turns) {
    if (turn.text.length <= maxCharacters) {
      chunks.push(turn);
      continue;
    }
    const sentences = turn.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [turn.text];
    let current = '';
    for (const sentence of sentences) {
      if (sentence.length > maxCharacters)
        throw new Error('A single script sentence exceeds the TTS limit');
      if (current && current.length + sentence.length > maxCharacters) {
        chunks.push({ speaker: turn.speaker, text: current.trim() });
        current = '';
      }
      current += sentence;
    }
    if (current.trim()) chunks.push({ speaker: turn.speaker, text: current.trim() });
  }
  return chunks;
}
