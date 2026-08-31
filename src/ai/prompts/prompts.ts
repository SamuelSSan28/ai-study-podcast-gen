import { PlanGenerationInput } from '../../application/ports';
import { StudyContent, StudyPlanTopic } from '../../domain/models';
export const PROMPT_VERSIONS = {
  plan: 'study-plan.v2',
  content: 'study-content.v2',
  script: 'podcast-script.v1',
  duplicate: 'duplicate.v1',
} as const;
export function buildPlanPrompt(input: PlanGenerationInput): string {
  return `Crie um currículo completo e progressivo em português brasileiro intitulado "${input.title}" para este objetivo: ${input.goal}. São ${input.durationWeeks} semanas e ${input.sessionsPerWeek} sessões por semana. Retorne exatamente ${input.durationWeeks * input.sessionsPerWeek} tópicos ordenados. Avance por FOUNDATION, CORE, INTERMEDIATE, ADVANCED e APPLIED, terminando em um caso de uso realista ou aplicação prática/entrevista. Cada tópico deve ser estudável de forma independente em uma sessão de ${input.targetSessionMinutes} minutos e nunca exigir mais de 60 minutos; divida assuntos amplos (por exemplo Kafka) em conceitos focados como fundamentos, partições, grupos, offsets, rebalanceamento e semânticas de entrega. Títulos, descrições, objetivos e pré-requisitos devem estar em português brasileiro natural. Os objetivos devem ser concretos, os pré-requisitos devem referenciar títulos anteriores e sessões adjacentes devem avançar em vez de repetir.`;
}
export function buildContentPrompt(topic: StudyPlanTopic, context: string): string {
  return `Escreva um artigo técnico em português brasileiro para "${topic.title}": ${topic.description}. Alvo de aproximadamente ${topic.estimatedMinutes} minutos para a sessão completa de artigo mais áudio. Cubra requisitos, premissas, arquitetura e evolução, APIs/propriedade de dados/comunicação assíncrona quando relevante, consistência, concorrência, idempotência, retries, escalabilidade, observabilidade, incidentes, trade-offs, erros comuns, vocabulário e perguntas de revisão. Não force tecnologias irrelevantes. A pesquisa fornecida é a fonte factual para artigo e podcast; não a contradiga e represente suas fontes no conteúdo.\nPesquisa e contexto local:\n${context}`;
}
export function buildScriptPrompt(
  topic: StudyPlanTopic,
  content: StudyContent,
  minutes: number,
): string {
  return `Crie uma entrevista técnica natural e autocontida de ${minutes} minutos sobre ${topic.title}. Use falas ordenadas de INTERVIEWER e CANDIDATE; HOST só no início/fim breve. O entrevistador revela restrições gradualmente e desafia decisões. O candidato faz perguntas de esclarecimento, pensa em voz alta, explica trade-offs e pode reconsiderar. Português brasileiro falado, claro e conciso. Nunca mencione material de estudo, documento, prompt, lição ou exercício. Fonte técnica:\n${JSON.stringify(content)}`;
}
