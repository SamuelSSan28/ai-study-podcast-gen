import { Inject, Injectable } from '@nestjs/common';
import {
  PLAN_REPOSITORY,
  StudyPlanRepository,
  StudyTopicRepository,
  TOPIC_REPOSITORY,
} from './ports';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ProgressStudyPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    private readonly queue: QueueService,
  ) {}

  async execute(
    planId: string,
  ): Promise<'NEEDS_GENERATION' | 'WAITING' | 'ADVANCED' | 'COMPLETED'> {
    const plan = await this.plans.findById(planId);
    if (!plan || plan.status !== 'ACTIVE') throw new Error('Active study plan not found');
    const ready = (await this.topics.findReady(planId)).sort((a, b) => a.order - b.order);
    const current = ready[0];
    if (!current) {
      await this.queue.enqueueGenerateSession(planId);
      return 'NEEDS_GENERATION';
    }
    if (!current.studied) return 'WAITING';

    current.status = 'COMPLETED';
    await this.topics.update(current);
    const next = (await this.topics.findPlanned(planId)).sort((a, b) => a.order - b.order)[0];
    if (!next) {
      plan.status = 'COMPLETED';
      plan.currentTopicId = undefined;
      await this.plans.updatePlan(plan);
      return 'COMPLETED';
    }

    plan.currentTopicId = next.id;
    await this.plans.updatePlan(plan);
    await this.queue.enqueueGenerateSession(planId);
    return 'ADVANCED';
  }
}
