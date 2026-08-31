import { CreateConversationPlanInput } from '../../../domain/models';

export const INTERVIEW_PLANNER_PROMPT_VERSION = 'conversation-planner.interview.v2';

export function buildInterviewPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Planeje uma entrevista técnica realista de ${input.targetMinutes} minutos para engenharia backend sênior.

Não escreva diálogo. O entrevistador explora progressivamente um sistema em produção e desafia as decisões do candidato. Crie uma progressão contínua: contexto de negócio → esclarecimento de requisitos → arquitetura inicial → decisões técnicas mais profundas → novas restrições → trade-offs → incidente em produção → observabilidade/confiabilidade → reflexão final.

Para cada seção defina initialQuestion, candidateExpectedReasoning, interviewerChallenges, conceptsToExplore, constraintsToReveal e transitionHint. Defina mode como INTERVIEW.

Regras:
- Mantenha foco neste projeto; não crie perguntas triviais desconectadas.
- O candidato não deve conhecer todas as restrições de início.
- Informações posteriores devem às vezes forçar revisão de decisões anteriores.
- Inclua um incidente realista em produção sem revelar a causa raiz.
- Todo o conteúdo planejado deve estar em português brasileiro.

Contexto do plano: ${JSON.stringify(input.studyPlanContext)}
Tópico: ${JSON.stringify(input.topic)}
Fonte técnica: ${JSON.stringify(input.technicalContent)}
Sessões anteriores (apenas contexto): ${JSON.stringify(input.previousSessions ?? [])}`;
}
