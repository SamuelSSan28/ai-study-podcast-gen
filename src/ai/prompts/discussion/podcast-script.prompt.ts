import { DiscussionConversationPlan, StudyContent } from '../../../domain/models';

export const DISCUSSION_SCRIPT_PROMPT_VERSION = 'podcast-script.discussion.v1';

export function buildDiscussionScriptPrompt(
  content: StudyContent,
  plan: DiscussionConversationPlan,
): string {
  return `Transforme este plano em uma conversa natural de podcast técnico entre ENGINEER_A e ENGINEER_B. São pares competentes.

Ambos introduzem ideias, reagem à fala anterior, fazem perguntas naturais, desafiam premissas, complementam o raciocínio, discordam ocasionalmente, sugerem alternativas e revisitam decisões conforme restrições aparecem. Evite pergunta → resposta completa → próxima pergunta. Desenvolva ideias em várias falas variadas e razoavelmente concisas. Nenhum falante é permanentemente entrevistador, professor, especialista ou aluno. Use português brasileiro falado, natural e adequado para TTS.

Não contradiga a fonte técnica nem mencione documentos, prompts, exercícios, lições ou material de estudo. Retorne falas estruturadas com ids estáveis, sequência zero-based, ids de seção, direção de entrega e estimativa de duração.

Fonte técnica: ${JSON.stringify(content)}
Plano da discussão: ${JSON.stringify(plan)}`;
}
