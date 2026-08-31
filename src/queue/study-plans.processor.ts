import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenerateStudyPlanUseCase } from '../application/generate-study-plan.use-case';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import {
  PLAN_REPOSITORY,
  SESSION_REPOSITORY,
  TOPIC_REPOSITORY,
  StudyPlanRepository,
  StudySessionRepository,
  StudyTopicRepository,
} from '../application/ports';
import { DiscordNotifier } from '../notifications/discord.notifier';
import { NotionContentPublisher } from '../persistence/notion-content.publisher';
import { PlanJob, STUDY_PLANS_QUEUE } from './queue.service';
import { QueueService } from './queue.service';
import { StudyPlanProvisioningStatus, StudySession } from '../domain/models';

@Processor(STUDY_PLANS_QUEUE)
export class StudyPlansProcessor extends WorkerHost {
  private readonly logger = new Logger(StudyPlansProcessor.name);

  constructor(
    private readonly generatePlan: GenerateStudyPlanUseCase,
    private readonly generateNext: GenerateNextStudySessionUseCase,
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
    private readonly queue: QueueService,
    private readonly notifier: DiscordNotifier,
    private readonly notion: NotionContentPublisher,
  ) {
    super();
  }

  async process(job: Job<PlanJob>): Promise<void> {
    const { planId } = job.data;
    let phase: StudyPlanProvisioningStatus = 'CREATING';
    let plan = await this.plans.findById(planId);
    if (plan) {
      try {
        await this.notifier.notifyPlanProvisioning(plan, 'CREATING');
      } catch {
        /* Discord must not block provisioning */
      }
    }

    try {
      const topicsBefore = await this.topics.findTopicsByPlan(planId);
      const hadCurriculum = topicsBefore.length > 0;

      await this.generatePlan.execute(planId);
      phase = 'GENERATING';

      plan = await this.plans.findById(planId);
      if (plan) {
        plan.provisioningStatus = 'GENERATING';
        plan.provisioningError = undefined;
        await this.plans.updatePlan(plan);
        try {
          await this.notifier.notifyPlanProvisioning(plan, 'GENERATING');
        } catch {
          /* Discord must not block provisioning */
        }
      }

      const topics = await this.topics.findTopicsByPlan(planId);
      if (!hadCurriculum && topics.length > 0 && plan) {
        try {
          await this.notifier.notifyPlanCurriculumReady(plan, topics.length);
        } catch {
          /* Discord must not block provisioning */
        }
      }

      const needsNotionSync =
        !plan?.notionPageId ||
        !plan?.notionTopicsDbId ||
        topics.some((topic) => !topic.notionPageId);
      if (needsNotionSync && plan) {
        try {
          const result = await this.notion.publishFinalizedPlan(plan, topics);
          for (const topic of result.topics) {
            if (topic.notionPageId) await this.topics.update(topic);
          }
          await this.plans.updatePlan(result.plan);
          plan = result.plan;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Inline Notion plan publish failed for ${planId}: ${message}`);
          await this.queue.enqueueNotionPlanFinalized(planId);
        }
      }

      const session = await this.resumeOrGenerateFirstSession(planId);
      await this.queue.enqueueNotionSession(session.id);

      plan = await this.plans.findById(planId);
      if (plan) {
        plan.provisioningStatus = 'READY';
        plan.provisioningError = undefined;
        await this.plans.updatePlan(plan);
        try {
          await this.notifier.notifyPlanReady(plan);
        } catch {
          /* Discord must not block provisioning */
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Plan generation failed for ${planId} (${phase}): ${message}`);
      plan = await this.plans.findById(planId);
      if (plan) {
        plan.provisioningStatus = 'FAILED';
        plan.provisioningError = message;
        await this.plans.updatePlan(plan);
      }
      try {
        await this.notifier.notifyProcessingError({
          plan: plan ?? undefined,
          planId,
          operation: 'PLAN_GENERATION',
          phase,
          error,
        });
      } catch {
        /* already logged in notifier */
      }
      throw error;
    }
  }

  private async resumeOrGenerateFirstSession(planId: string): Promise<StudySession> {
    const existing = await this.sessions.findByPlan(planId);
    const completed = existing.find((session) => session.stage === 'COMPLETED');
    if (completed) return completed;

    const resumable = existing.find((session) => session.stage !== 'COMPLETED');
    if (resumable) {
      return this.generateNext.retry(resumable.id);
    }
    return this.generateNext.executeForProvisioning(planId);
  }
}
