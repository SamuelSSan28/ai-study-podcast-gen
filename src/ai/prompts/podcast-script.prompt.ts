import { ConversationPlan, StudyContent } from '../../domain/models';
export const PODCAST_SCRIPT_PROMPT_VERSION = 'podcast-script.v2';
export function buildPodcastScriptPrompt(content: StudyContent, plan: ConversationPlan): string {
  return `Turn the planned discussion into believable spoken dialogue. Do not redesign the architecture or add facts. Follow every section, challenge, constraint reveal, incident, and transition in order. Use mostly INTERVIEWER and CANDIDATE; HOST only for a brief opening/closing. Candidate English is B2-C1. Return structured turns with stable ids, zero-based sequence, section ids, generic delivery direction, and a duration estimate.\nTechnical source: ${JSON.stringify(content)}\nConversation plan: ${JSON.stringify(plan)}`;
}
