import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiGateway, PLAN_REPOSITORY, PlanGenerationInput, StudyPlanRepository } from './ports';
import { StudyPlan, StudyPlanTopic, Weekday } from '../domain/models';
import { topicSlug } from '../domain/topic-normalization';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { OpenAiGateway } from '../ai/openai.gateway';
@Injectable()
export class GenerateStudyPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly ai: OpenAiGateway,
    private readonly knowledge: KnowledgeBaseService,
  ) {}
  async execute(input: PlanGenerationInput & { startDate?: string }): Promise<StudyPlan> {
    const context = await this.knowledge.retrieve(['profile', 'interview', 'architecture'], true);
    const generated = await this.ai.generatePlan(input, context);
    const expected = input.durationWeeks * input.sessionsPerWeek;
    if (generated.topics.length !== expected)
      throw new Error(`AI returned ${generated.topics.length} topics; expected ${expected}`);
    const id = randomUUID();
    const seen = new Set<string>();
    const topics: StudyPlanTopic[] = generated.topics.map((topic) => {
      const slug = topicSlug(topic.title);
      if (seen.has(slug)) throw new Error(`Duplicate generated topic: ${topic.title}`);
      seen.add(slug);
      return { ...topic, id: randomUUID(), studyPlanId: id, slug, status: 'PLANNED' };
    });
    const start = new Date(input.startDate ?? new Date().toISOString());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + input.durationWeeks * 7 - 1);
    const plan: StudyPlan = {
      id,
      title: input.title,
      goal: input.goal,
      level: input.level,
      durationWeeks: input.durationWeeks,
      sessionsPerWeek: input.sessionsPerWeek,
      preferredDays: input.preferredDays as Weekday[],
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      status: 'ACTIVE',
      overview: generated.overview,
      createdAt: new Date().toISOString(),
    };
    return this.plans.create(plan, topics);
  }
}
