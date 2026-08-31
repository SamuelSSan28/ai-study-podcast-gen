import { Inject, Injectable, Logger } from '@nestjs/common';
import { PLAN_REPOSITORY, StudyPlanRepository } from './ports';
import { GenerateStudyPlanUseCase } from './generate-study-plan.use-case';
import { GenerateNextStudySessionUseCase } from './generate-next-session.use-case';
import { DiscordNotifier } from '../notifications/discord.notifier';

@Injectable()
export class PlanGenerationRunner {
  private readonly logger = new Logger(PlanGenerationRunner.name);
  private readonly running = new Set<string>();

  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly generatePlan: GenerateStudyPlanUseCase,
    private readonly generateNext: GenerateNextStudySessionUseCase,
    private readonly notifier: DiscordNotifier,
  ) {}

  enqueue(planId: string): void {
    if (this.running.has(planId)) return;
    this.running.add(planId);
    void this.run(planId).finally(() => this.running.delete(planId));
  }

  private async run(planId: string): Promise<void> {
    try {
      await this.generatePlan.execute(planId);
      await this.generateNext.execute(planId);
      const plan = await this.plans.findById(planId);
      if (!plan) return;
      plan.provisioningStatus = 'READY';
      plan.provisioningError = undefined;
      await this.plans.updatePlan(plan);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Plan generation failed for ${planId}: ${message}`);
      const plan = await this.plans.findById(planId);
      if (plan) {
        plan.provisioningStatus = 'FAILED';
        plan.provisioningError = message;
        await this.plans.updatePlan(plan);
      }
      await this.notifier.notifyProcessingError({
        planId,
        operation: 'PLAN_GENERATION',
        error,
      });
    }
  }
}
