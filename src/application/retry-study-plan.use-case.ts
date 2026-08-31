import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLAN_REPOSITORY, StudyPlanRepository } from './ports';
import { QueueService } from '../queue/queue.service';
import { DiscordNotifier } from '../notifications/discord.notifier';

@Injectable()
export class RetryStudyPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly queue: QueueService,
    private readonly notifier: DiscordNotifier,
  ) {}

  async execute(planId: string): Promise<{ status: 'QUEUED'; jobId: string; planId: string }> {
    const plan = await this.plans.findById(planId);
    if (!plan) throw new NotFoundException(`Study plan ${planId} not found`);
    if (plan.provisioningStatus !== 'FAILED') {
      throw new BadRequestException(
        `Plan ${planId} is not FAILED (current: ${plan.provisioningStatus})`,
      );
    }

    plan.provisioningStatus = 'CREATING';
    plan.provisioningError = undefined;
    await this.plans.updatePlan(plan);

    try {
      await this.notifier.notifyPlanRetry(plan);
    } catch {
      /* Discord must not block retry */
    }

    const jobId = await this.queue.enqueuePlanGeneration(planId);
    return { status: 'QUEUED', jobId, planId };
  }
}
