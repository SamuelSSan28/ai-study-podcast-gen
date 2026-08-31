import { RawPodcastScript } from '../../../domain/models';

export const DISCUSSION_POLISHER_PROMPT_VERSION = 'dialogue-polisher.discussion.v1';

export function buildDiscussionPolisherPrompt(script: RawPodcastScript): string {
  return `Polir este podcast tecnicamente correto para soar como dois engenheiros discutindo um sistema de verdade. Preserve significado técnico, fatos de arquitetura, restrições do cenário, identidades dos falantes, ids, sequência e ids de seção. Melhore reações, continuidade, concordância e discordância naturais, referências a decisões anteriores, contrações, variação no tamanho das falas e ritmo falado. Reduza Q&A de entrevista, afirmações desconectadas, confirmações repetidas, palestras e frases de português escrito. Ambos os falantes permanecem pares competentes. Mantenha linguagem adequada para TTS. Não introduza fatos técnicos novos. Retorne o roteiro estruturado completo.\n${JSON.stringify(script)}`;
}
