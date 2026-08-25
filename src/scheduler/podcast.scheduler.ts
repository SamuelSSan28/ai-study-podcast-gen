import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { PLAN_REPOSITORY, StudyPlanRepository } from '../application/ports';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import { ProgressStudyPlanUseCase } from '../application/progress-study-plan.use-case';
@Injectable()
export class PodcastScheduler {
  private readonly logger = new Logger(PodcastScheduler.name);
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly generate: GenerateNextStudySessionUseCase,
    private readonly progress: ProgressStudyPlanUseCase,
  ) {}
  @Cron(process.env.PODCAST_CRON ?? '0 * * * *', {
    timeZone: process.env.PODCAST_TIMEZONE ?? 'America/Sao_Paulo',
  })
  async run(): Promise<void> {
    for (const plan of await this.plans.findActive()) {
      try {
        const ready = await this.progress.execute(plan.id);
        if (ready === 'NEEDS_GENERATION') {
          const generated = await this.generate.execute(plan.id).catch((error: unknown) => {
            if (error instanceof Error && error.message === 'No planned topics remain') return null;
            throw error;
          });
          void generated;
        }
      } catch (error) {
        this.logger.error(
          `Scheduled generation failed for plan ${plan.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
