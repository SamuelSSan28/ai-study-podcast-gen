import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import { QueueService, RetryJob, SessionJob, STUDY_SESSIONS_QUEUE } from './queue.service';

@Processor(STUDY_SESSIONS_QUEUE, { concurrency: 2 })
export class StudySessionsProcessor extends WorkerHost {
  constructor(
    private readonly generator: GenerateNextStudySessionUseCase,
    private readonly queue: QueueService,
  ) {
    super();
  }

  async process(job: Job<SessionJob | RetryJob>): Promise<void> {
    if (job.name === 'retry-session') {
      const { sessionId } = job.data as RetryJob;
      const session = await this.generator.retry(sessionId);
      await this.queue.enqueueNotionSession(session.id);
      return;
    }
    const { planId, mode } = job.data as SessionJob;
    const session = await this.generator.execute(planId, mode);
    await this.queue.enqueueNotionSession(session.id);
  }
}
