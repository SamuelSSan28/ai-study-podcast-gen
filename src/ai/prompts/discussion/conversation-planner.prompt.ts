import { CreateConversationPlanInput } from '../../../domain/models';

export const DISCUSSION_PLANNER_PROMPT_VERSION = 'conversation-planner.discussion.v1';

export function buildDiscussionPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Planeje uma discussão técnica natural de ${input.targetMinutes} minutos entre dois engenheiros de software experientes.

Isto não é uma entrevista. Ambos são pares e exploram colaborativamente um sistema em produção. Não escreva diálogo. Crie uma discussão evolutiva: problema de negócio → arquitetura inicial → trade-offs → novas restrições → abordagens alternativas → refinamento da arquitetura → incidente em produção → confiabilidade/observabilidade → reflexão final.

Para cada seção defina entryPoint, discussionGoal, conceptsToExplore, tensions, questionsToNaturallyRaise, scenarioReveals, possibleDisagreement e connectionToPreviousSection. Defina mode como DISCUSSION.

Regras:
- Mantenha foco neste projeto, não em perguntas backend independentes.
- Não force tecnologias; ambos os engenheiros contribuem com ideias relevantes.
- Restrições posteriores desafiam premissas anteriores.
- Inclua um incidente realista em produção sem revelar a causa raiz.
- Todo o conteúdo planejado deve estar em português brasileiro.

Contexto do plano: ${JSON.stringify(input.studyPlanContext)}
Tópico: ${JSON.stringify(input.topic)}
Fonte técnica: ${JSON.stringify(input.technicalContent)}
Sessões anteriores (apenas contexto): ${JSON.stringify(input.previousSessions ?? [])}`;
}
