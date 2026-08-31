import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PodcastMode } from '../domain/models';
import { enqueueUnique } from './queue-dedup';

export const STUDY_PLANS_QUEUE = 'study-plans';
export const STUDY_SESSIONS_QUEUE = 'study-sessions';
export const STUDY_PROGRESS_QUEUE = 'study-progress';
export const NOTION_QUEUE = 'notion';

export type PlanJob = { planId: string };
export type SessionJob = { planId: string; mode?: PodcastMode; topicId?: string };
export type RetryJob = { sessionId: string };
export type ProgressJob = { planId: string };
export type NotionJob =
  | { kind: 'plan-pending'; planId: string }
  | { kind: 'plan-finalized'; planId: string }
  | { kind: 'session'; sessionId: string }
  | { kind: 'topic'; topicId: string };

const JOB_RETENTION = { removeOnComplete: 100, removeOnFail: 50 } as const;
const RETRY_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 30_000 },
};

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(STUDY_PLANS_QUEUE) private readonly plansQueue: Queue,
    @InjectQueue(STUDY_SESSIONS_QUEUE) private readonly sessionsQueue: Queue,
    @InjectQueue(STUDY_PROGRESS_QUEUE) private readonly progressQueue: Queue,
    @InjectQueue(NOTION_QUEUE) private readonly notionQueue: Queue,
  ) {}

  async enqueuePlanGeneration(planId: string): Promise<string> {
    return enqueueUnique(
      this.plansQueue,
      'generate-plan',
      { planId } satisfies PlanJob,
      `plan-${planId}`,
      { ...JOB_RETENTION, ...RETRY_OPTS },
    );
  }

  async enqueueGenerateSession(
    planId: string,
    mode?: PodcastMode,
    topicId?: string,
  ): Promise<string> {
    const jobId = topicId
      ? `session-${planId}-${topicId}-${mode ?? 'default'}`
      : `session-${planId}-${mode ?? 'default'}`;
    return enqueueUnique(
      this.sessionsQueue,
      'generate-session',
      { planId, mode, topicId } satisfies SessionJob,
      jobId,
      { ...JOB_RETENTION, ...RETRY_OPTS },
    );
  }

  async enqueueRetrySession(sessionId: string): Promise<string> {
    return enqueueUnique(
      this.sessionsQueue,
      'retry-session',
      { sessionId } satisfies RetryJob,
      `retry-${sessionId}`,
      { ...JOB_RETENTION, ...RETRY_OPTS },
    );
  }

  async enqueueAdvancePlan(planId: string): Promise<string> {
    return enqueueUnique(
      this.progressQueue,
      'advance-plan',
      { planId } satisfies ProgressJob,
      `advance-${planId}`,
      JOB_RETENTION,
    );
  }

  async enqueueNotionPlanPending(planId: string): Promise<void> {
    await enqueueUnique(
      this.notionQueue,
      'publish-content',
      { kind: 'plan-pending', planId } satisfies NotionJob,
      `notion-plan-pending-${planId}`,
      { removeOnComplete: 200 },
    );
  }

  async enqueueNotionPlanFinalized(planId: string): Promise<void> {
    await enqueueUnique(
      this.notionQueue,
      'publish-content',
      { kind: 'plan-finalized', planId } satisfies NotionJob,
      `notion-plan-finalized-${planId}`,
      { removeOnComplete: 200 },
    );
  }

  async enqueueNotionSession(sessionId: string): Promise<void> {
    await enqueueUnique(
      this.notionQueue,
      'publish-content',
      { kind: 'session', sessionId } satisfies NotionJob,
      `notion-session-${sessionId}`,
      { removeOnComplete: 200 },
    );
  }

  async enqueueNotionTopic(topicId: string): Promise<void> {
    await enqueueUnique(
      this.notionQueue,
      'publish-content',
      { kind: 'topic', topicId } satisfies NotionJob,
      `notion-topic-${topicId}`,
      { removeOnComplete: 200 },
    );
  }
}
