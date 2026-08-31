import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProgressStudyPlanUseCase } from '../application/progress-study-plan.use-case';
import { ProgressJob, STUDY_PROGRESS_QUEUE } from './queue.service';

@Processor(STUDY_PROGRESS_QUEUE)
export class StudyProgressProcessor extends WorkerHost {
  constructor(private readonly progress: ProgressStudyPlanUseCase) {
    super();
  }

  async process(job: Job<ProgressJob>): Promise<void> {
    await this.progress.execute(job.data.planId);
  }
}
