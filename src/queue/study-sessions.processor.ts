import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import { PLAN_REPOSITORY, StudyPlanRepository } from '../application/ports';
import { isSessionGenerationSkippedError } from '../domain/session-generation-skipped.error';
import { DiscordNotifier } from '../notifications/discord.notifier';
import { QueueService, RetryJob, SessionJob, STUDY_SESSIONS_QUEUE } from './queue.service';

@Processor(STUDY_SESSIONS_QUEUE, { concurrency: 2 })
export class StudySessionsProcessor extends WorkerHost {
  private readonly logger = new Logger(StudySessionsProcessor.name);

  constructor(
    private readonly generator: GenerateNextStudySessionUseCase,
    private readonly queue: QueueService,
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly notifier: DiscordNotifier,
  ) {
    super();
  }

  async process(job: Job<SessionJob | RetryJob>): Promise<void> {
    try {
      if (job.name === 'retry-session') {
        const { sessionId } = job.data as RetryJob;
        const session = await this.generator.retry(sessionId);
        await this.queue.enqueueNotionSession(session.id);
        return;
      }
      const { planId, mode } = job.data as SessionJob;
      const session = await this.generator.execute(planId, mode);
      await this.queue.enqueueNotionSession(session.id);
    } catch (error) {
      if (isSessionGenerationSkippedError(error)) {
        const plan = await this.plans.findById(error.planId);
        this.logger.log(
          `Session generation skipped for plan ${error.planId}: ${error.message}`,
        );
        if (plan) {
          try {
            await this.notifier.notifySessionGenerationSkipped(plan, error.waitingTopicCount);
          } catch {
            /* Discord must not block the worker */
          }
        }
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const planId =
        job.name === 'retry-session'
          ? undefined
          : (job.data as SessionJob).planId;
      this.logger.error(`Session job failed: ${message}`);
      if (planId) {
        const plan = await this.plans.findById(planId);
        try {
          await this.notifier.notifyProcessingError({
            plan: plan ?? undefined,
            planId,
            operation: 'SESSION_GENERATION',
            phase: 'GENERATING',
            error,
          });
        } catch {
          /* already logged in notifier */
        }
      }
      throw error;
    }
  }
}
