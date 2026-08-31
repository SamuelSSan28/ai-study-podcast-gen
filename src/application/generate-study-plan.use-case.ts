import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PLAN_REPOSITORY, PlanGenerationInput, StudyPlanRepository } from './ports';
import { StudyPlanTopic } from '../domain/models';
import { topicSlug } from '../domain/topic-normalization';
import { OpenAiGateway } from '../ai/openai.gateway';
import { STUDY_DEFAULTS } from '../config/study-defaults';
import { calculateStudyDates } from '../domain/study-schedule';

@Injectable()
export class GenerateStudyPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly ai: OpenAiGateway,
  ) {}

  async execute(planId: string): Promise<void> {
    const pending = await this.plans.findById(planId);
    if (!pending) throw new NotFoundException(`Study plan ${planId} not found`);

    const planningInput: PlanGenerationInput = {
      title: pending.title,
      goal: pending.goal,
      durationWeeks: STUDY_DEFAULTS.curriculum.durationWeeks,
      sessionsPerWeek: STUDY_DEFAULTS.schedule.sessionsPerWeek,
      preferredDays: [...STUDY_DEFAULTS.schedule.days],
      targetSessionMinutes: pending.targetSessionMinutes,
    };

    const generated = await this.ai.generatePlan(planningInput);
    const expected = planningInput.durationWeeks * planningInput.sessionsPerWeek;
    if (generated.topics.length !== expected) {
      throw new Error(`AI returned ${generated.topics.length} topics; expected ${expected}`);
    }

    const seen = new Set<string>();
    const start = new Date(pending.createdAt);
    const dates = calculateStudyDates(start, STUDY_DEFAULTS.schedule.days, generated.topics.length);
    const topics: StudyPlanTopic[] = generated.topics.map((topic, index) => {
      const slug = topicSlug(topic.title);
      if (seen.has(slug)) throw new Error(`Duplicate generated topic: ${topic.title}`);
      seen.add(slug);
      return {
        ...topic,
        id: randomUUID(),
        studyPlanId: planId,
        slug,
        status: 'PLANNED',
        order: index + 1,
        scheduledAt: dates[index],
        studied: false,
      };
    });

    pending.overview = generated.overview;
    pending.status = 'ACTIVE';
    pending.provisioningStatus = 'GENERATING';
    pending.currentTopicId = topics[0]?.id;

    await this.plans.finalizePlan(pending, topics);
  }
}
