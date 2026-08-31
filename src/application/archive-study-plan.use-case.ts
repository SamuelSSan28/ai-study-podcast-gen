import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PLAN_REPOSITORY,
  TOPIC_REPOSITORY,
  StudyPlanRepository,
  StudyTopicRepository,
} from './ports';
import { NotionContentPublisher } from '../persistence/notion-content.publisher';

@Injectable()
export class ArchiveStudyPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    private readonly notion: NotionContentPublisher,
  ) {}

  async execute(planId: string): Promise<void> {
    const plan = await this.plans.findById(planId);
    if (!plan) throw new NotFoundException(`Study plan ${planId} not found`);
    const planTopics = await this.topics.findTopicsByPlan(planId);
    await this.plans.archivePlan(planId);
    void this.notion.archivePlan(plan, planTopics);
  }
}
