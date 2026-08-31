import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { GenerateStudyPlanUseCase } from '../application/generate-study-plan.use-case';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import { PLAN_REPOSITORY, StudyPlanRepository } from '../application/ports';
import { DiscordNotifier } from '../notifications/discord.notifier';
import { PlanJob, STUDY_PLANS_QUEUE } from './queue.service';
import { QueueService } from './queue.service';
import { isFinalJobAttempt } from './queue-dedup';
import { StudyPlanProvisioningStatus } from '../domain/models';

@Processor(STUDY_PLANS_QUEUE)
export class StudyPlansProcessor extends WorkerHost {
  private readonly logger = new Logger(StudyPlansProcessor.name);

  constructor(
    private readonly generatePlan: GenerateStudyPlanUseCase,
    private readonly generateNext: GenerateNextStudySessionUseCase,
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly queue: QueueService,
    private readonly notifier: DiscordNotifier,
  ) {
    super();
  }

  async process(job: Job<PlanJob>): Promise<void> {
    const { planId } = job.data;
    let phase: StudyPlanProvisioningStatus = 'CREATING';
    try {
      await this.generatePlan.execute(planId);
      phase = 'GENERATING';
      await this.queue.enqueueNotionPlanFinalized(planId);
      const session = await this.generateNext.execute(planId);
      await this.queue.enqueueNotionSession(session.id);
      const plan = await this.plans.findById(planId);
      if (plan) {
        plan.provisioningStatus = 'READY';
        plan.provisioningError = undefined;
        await this.plans.updatePlan(plan);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Plan generation failed for ${planId} (${phase}): ${message}`);
      const plan = await this.plans.findById(planId);
      if (plan) {
        plan.provisioningStatus = 'FAILED';
        plan.provisioningError = message;
        await this.plans.updatePlan(plan);
      }
      if (isFinalJobAttempt(job)) {
        await this.notifier.notifyProcessingError({
          plan: plan ?? undefined,
          planId,
          operation: 'PLAN_GENERATION',
          phase,
          error,
        });
      }
      throw error;
    }
  }
}
