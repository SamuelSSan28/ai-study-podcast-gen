import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLAN_REPOSITORY, TOPIC_REPOSITORY, StudyPlanRepository, StudyTopicRepository } from './ports';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MarkTopicStudiedUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    private readonly queue: QueueService,
  ) {}

  async execute(planId: string, topicId: string, studied: boolean): Promise<void> {
    const plan = await this.plans.findById(planId);
    if (!plan) throw new NotFoundException(`Study plan ${planId} not found`);
    const topic = await this.topics.findTopicById(topicId);
    if (!topic || topic.studyPlanId !== planId) {
      throw new NotFoundException(`Topic ${topicId} not found in plan ${planId}`);
    }
    topic.studied = studied;
    await this.topics.update(topic);
    if (studied) {
      await this.queue.enqueueNotionTopic(topicId);
      await this.queue.enqueueAdvancePlan(planId);
    }
  }
}
