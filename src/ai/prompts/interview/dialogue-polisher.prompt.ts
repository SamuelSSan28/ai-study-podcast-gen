import { RawPodcastScript } from '../../../domain/models';

export const INTERVIEW_POLISHER_PROMPT_VERSION = 'dialogue-polisher.interview.v2';

export function buildInterviewPolisherPrompt(script: RawPodcastScript): string {
  return `Polir esta entrevista tecnicamente correta para português brasileiro falado natural. Preserve significado técnico, perguntas e desafios, revelações de restrições, identidades dos falantes, ids, sequência e ids de seção. Melhore respostas concisas do candidato, follow-ups naturais, reações, ritmo, contrações e continuidade. Reduza linguagem acadêmica, confirmações repetidas, monólogos longos e Q&A robótico. Não introduza fatos técnicos novos. Retorne o roteiro estruturado completo.\n${JSON.stringify(script)}`;
}
