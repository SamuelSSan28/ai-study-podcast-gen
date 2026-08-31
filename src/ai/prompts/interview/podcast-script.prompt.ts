import { InterviewConversationPlan, StudyContent } from '../../../domain/models';

export const INTERVIEW_SCRIPT_PROMPT_VERSION = 'podcast-script.interview.v3';

export function buildInterviewScriptPrompt(
  content: StudyContent,
  plan: InterviewConversationPlan,
): string {
  return `Transforme este plano em uma entrevista técnica natural entre INTERVIEWER e CANDIDATE.

O entrevistador faz perguntas concisas, desafia premissas, revela restrições progressivamente e aprofunda a resposta anterior em vez de apenas aprovar. O candidato faz perguntas de esclarecimento, pensa em voz alta, justifica trade-offs e ocasionalmente revisa uma decisão anterior. Use português brasileiro falado, natural e conciso.

Evite trivia, respostas de livro-texto, monólogos longos, respostas perfeitas imediatas e referências a prompts, lições, documentos ou material de estudo. Retorne falas estruturadas com ids estáveis, sequência zero-based, ids de seção, direção de entrega e estimativa de duração.

Fonte técnica: ${JSON.stringify(content)}
Plano da entrevista: ${JSON.stringify(plan)}`;
}
