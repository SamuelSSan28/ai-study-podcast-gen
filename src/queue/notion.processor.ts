import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  PLAN_REPOSITORY,
  SESSION_REPOSITORY,
  TOPIC_REPOSITORY,
  StudyPlanRepository,
  StudySessionRepository,
  StudyTopicRepository,
} from '../application/ports';
import { NotionContentPublisher } from '../persistence/notion-content.publisher';
import { NOTION_QUEUE, NotionJob } from './queue.service';

@Processor(NOTION_QUEUE)
export class NotionProcessor extends WorkerHost {
  constructor(
    private readonly notion: NotionContentPublisher,
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
  ) {
    super();
  }

  async process(job: Job<NotionJob>): Promise<void> {
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
      await this.notion.publishFinalizedPlan(plan, topics);
      for (const topic of topics) {
        if (topic.notionPageId) await this.topics.update(topic);
      }
      if (plan.notionPageId) await this.plans.updatePlan(plan);
      return;
    }
    if (data.kind === 'session') {
      const session = await this.sessions.findSessionById(data.sessionId);
      if (!session) return;
      const updated = await this.notion.publishSession(session);
      if (updated.notionPageId !== session.notionPageId) {
        await this.sessions.updateSession(updated);
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
