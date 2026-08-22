import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationPlan, PodcastScript } from '../domain/models';
@Injectable()
export class PodcastScriptValidator {
  constructor(private readonly config: ConfigService) {}
  validate(script: PodcastScript, plan: ConversationPlan, targetMinutes: number): void {
    const errors: string[] = [];
    const speakers = new Set(script.turns.map((turn) => turn.speaker));
    for (const required of ['INTERVIEWER', 'CANDIDATE'])
      if (!speakers.has(required as never)) errors.push(`Missing required speaker ${required}`);
    if (script.turns.some((turn) => !turn.text.trim())) errors.push('Empty turn');
    if (script.turns.some((turn, index) => turn.sequence !== index))
      errors.push('Turn sequence must be contiguous and zero-based');
    const maxChars = this.config.get<number>('PODCAST_MAX_TURN_CHARACTERS', 1200);
    if (script.turns.some((turn) => turn.text.length > maxChars))
      errors.push(`Turn exceeds ${maxChars} characters`);
    const min = this.config.get<number>('PODCAST_MIN_TURNS', 35);
    const max = this.config.get<number>('PODCAST_MAX_TURNS', 120);
    if (script.turns.length < min || script.turns.length > max)
      errors.push(`Turn count must be between ${min} and ${max}`);
    const represented = new Set(script.turns.map((turn) => turn.sectionId));
    for (const section of plan.sections)
      if (!represented.has(section.id)) errors.push(`Missing section ${section.id}`);
    if (plan.incident && !represented.has(plan.incident.sectionId))
      errors.push(`Missing incident section ${plan.incident.sectionId}`);
    const dialogue = script.turns.map((turn) => turn.text.toLowerCase()).join(' ');
    for (const section of plan.sections)
      for (const constraint of section.constraintsToReveal) {
        const keywords =
          constraint.reveal
            .toLowerCase()
            .match(/[a-z0-9]+/g)
            ?.filter((word) => word.length > 4) ?? [];
        if (keywords.length && !keywords.some((word) => dialogue.includes(word)))
          errors.push(`Constraint reveal missing from ${section.id}`);
      }
    const targetSeconds = targetMinutes * 60;
    if (
      script.estimatedDurationSeconds < targetSeconds * 0.7 ||
      script.estimatedDurationSeconds > targetSeconds * 1.3
    )
      errors.push('Estimated duration is outside 30% target tolerance');
    if (errors.length) throw new Error(`Invalid podcast script: ${errors.join('; ')}`);
  }
}
