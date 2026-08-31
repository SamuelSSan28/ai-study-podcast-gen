import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { PLAN_REPOSITORY, StudyPlanRepository } from '../application/ports';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class LocalProgressCron {
  private readonly logger = new Logger(LocalProgressCron.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly queue: QueueService,
  ) {}

  @Cron(process.env.LOCAL_PROGRESS_CRON ?? '0 */12 * * *', {
    timeZone: process.env.PODCAST_TIMEZONE ?? 'America/Sao_Paulo',
  })
  async checkLocalProgress(): Promise<void> {
    if (!this.config.get<boolean>('LOCAL_PROGRESS_ENABLED', true)) return;
    const activePlans = await this.plans.findActive();
    for (const plan of activePlans) {
      try {
        await this.queue.enqueueAdvancePlan(plan.id);
      } catch (error) {
        this.logger.error(
          `Local progress check failed for plan ${plan.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
