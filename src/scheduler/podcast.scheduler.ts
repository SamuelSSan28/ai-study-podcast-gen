import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { PLAN_REPOSITORY, StudyPlanRepository } from '../application/ports';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
@Injectable()
export class PodcastScheduler {
  private readonly logger = new Logger(PodcastScheduler.name);
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly generate: GenerateNextStudySessionUseCase,
  ) {}
  @Cron(process.env.PODCAST_CRON ?? '0 12 * * 2,5', {
    timeZone: process.env.PODCAST_TIMEZONE ?? 'America/Sao_Paulo',
  })
  async run(): Promise<void> {
    for (const plan of await this.plans.findActive()) {
      try {
        await this.generate.execute(plan.id);
      } catch (error) {
        this.logger.error(
          `Scheduled generation failed for plan ${plan.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
