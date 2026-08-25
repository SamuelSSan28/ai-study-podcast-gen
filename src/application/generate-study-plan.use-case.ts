import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PLAN_REPOSITORY, PlanGenerationInput, StudyPlanRepository } from './ports';
import { StudyPlan, StudyPlanTopic } from '../domain/models';
import { topicSlug } from '../domain/topic-normalization';
import { OpenAiGateway } from '../ai/openai.gateway';
import { STUDY_DEFAULTS, StudyPlanSettings } from '../config/study-defaults';
import { calculateStudyDates } from '../domain/study-schedule';
@Injectable()
export class GenerateStudyPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly ai: OpenAiGateway,
  ) {}
  async execute(input: {
    title: string;
    goal: string;
    settings?: StudyPlanSettings;
  }): Promise<StudyPlan> {
    const targetSessionMinutes =
      input.settings?.targetSessionMinutes ?? STUDY_DEFAULTS.session.targetMinutes;
    const planningInput: PlanGenerationInput = {
      title: input.title,
      goal: input.goal,
      durationWeeks: STUDY_DEFAULTS.curriculum.durationWeeks,
      sessionsPerWeek: STUDY_DEFAULTS.schedule.sessionsPerWeek,
      preferredDays: [...STUDY_DEFAULTS.schedule.days],
      targetSessionMinutes,
    };
    const generated = await this.ai.generatePlan(planningInput);
    const expected = planningInput.durationWeeks * planningInput.sessionsPerWeek;
    if (generated.topics.length !== expected)
      throw new Error(`AI returned ${generated.topics.length} topics; expected ${expected}`);
    const id = randomUUID();
    const seen = new Set<string>();
    const start = new Date();
    const dates = calculateStudyDates(start, STUDY_DEFAULTS.schedule.days, generated.topics.length);
    const topics: StudyPlanTopic[] = generated.topics.map((topic, index) => {
      const slug = topicSlug(topic.title);
      if (seen.has(slug)) throw new Error(`Duplicate generated topic: ${topic.title}`);
      seen.add(slug);
      return {
        ...topic,
        id: randomUUID(),
        studyPlanId: id,
        slug,
        status: 'PLANNED',
        order: index + 1,
        scheduledAt: dates[index],
        studied: false,
      };
    });
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + planningInput.durationWeeks * 7 - 1);
    const plan: StudyPlan = {
      id,
      title: input.title,
      goal: input.goal,
      level: 'adaptive',
      durationWeeks: planningInput.durationWeeks,
      sessionsPerWeek: planningInput.sessionsPerWeek,
      preferredDays: STUDY_DEFAULTS.schedule.days,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      status: 'ACTIVE',
      overview: generated.overview,
      createdAt: new Date().toISOString(),
      targetSessionMinutes,
      currentTopicId: topics[0]?.id,
    };
    return this.plans.create(plan, topics);
  }
}
