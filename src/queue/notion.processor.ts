import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
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
import { NOTION_QUEUE, NotionJob } from './queue.service';

@Processor(NOTION_QUEUE)
export class NotionProcessor extends WorkerHost {
  private readonly logger = new Logger(NotionProcessor.name);

  constructor(
    private readonly notion: NotionContentPublisher,
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
    private readonly notifier: DiscordNotifier,
  ) {
    super();
  }

  private async planIdFromJob(data: NotionJob): Promise<string | undefined> {
    if (data.kind === 'plan-pending' || data.kind === 'plan-finalized') return data.planId;
    if (data.kind === 'session') {
      const session = await this.sessions.findSessionById(data.sessionId);
      return session?.studyPlanId;
    }
    if (data.kind === 'topic') {
      const topic = await this.topics.findTopicById(data.topicId);
      return topic?.studyPlanId;
    }
    return undefined;
  }

  async process(job: Job<NotionJob>): Promise<void> {
    try {
      await this.run(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Notion job failed (${job.data.kind}): ${message}`);
      const planId = await this.planIdFromJob(job.data);
      const plan = planId ? await this.plans.findById(planId) : null;
      try {
        await this.notifier.notifyProcessingError({
          plan: plan ?? undefined,
          planId: planId ?? undefined,
          operation: `NOTION_${job.data.kind}`,
          phase: 'NOTION_PUBLISH',
          error,
        });
      } catch {
        /* already logged in notifier */
      }
      throw error;
    }
  }

  private async run(job: Job<NotionJob>): Promise<void> {
    const data = job.data;
    if (data.kind === 'plan-pending') {
      const plan = await this.plans.findById(data.planId);
      if (!plan) return;
      const updated = await this.notion.publishPendingPlan(plan);
      await this.plans.updatePlan(updated);
      return;
    }
    if (data.kind === 'plan-finalized') {
      const plan = await this.plans.findById(data.planId);
      if (!plan) return;
      const topics = await this.topics.findTopicsByPlan(data.planId);
      const result = await this.notion.publishFinalizedPlan(plan, topics);
      for (const topic of result.topics) {
        if (topic.notionPageId) await this.topics.update(topic);
      }
      if (result.plan.notionPageId) await this.plans.updatePlan(result.plan);
      return;
    }
    if (data.kind === 'session') {
      const session = await this.sessions.findSessionById(data.sessionId);
      if (!session) return;
      const topic = await this.topics.findTopicById(session.topicId);
      const beforePageId = session.notionPageId;
      const result = await this.notion.publishSession(session, topic ?? undefined);
      if (result.session.notionPageId !== beforePageId) {
        await this.sessions.updateSession(result.session);
      }
      if (result.topic?.notionPageId) {
        await this.topics.update(result.topic);
      }
      return;
    }
    if (data.kind === 'topic') {
      const topic = await this.topics.findTopicById(data.topicId);
      if (!topic) return;
      await this.notion.publishTopicUpdate(topic);
    }
  }
}
