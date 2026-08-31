import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PodcastMode } from '../domain/models';

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

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(STUDY_PLANS_QUEUE) private readonly plansQueue: Queue,
    @InjectQueue(STUDY_SESSIONS_QUEUE) private readonly sessionsQueue: Queue,
    @InjectQueue(STUDY_PROGRESS_QUEUE) private readonly progressQueue: Queue,
    @InjectQueue(NOTION_QUEUE) private readonly notionQueue: Queue,
  ) {}

  async enqueuePlanGeneration(planId: string): Promise<string> {
    const job = await this.plansQueue.add(
      'generate-plan',
      { planId } satisfies PlanJob,
      { jobId: `plan:${planId}`, removeOnComplete: 100, removeOnFail: 50 },
    );
    return job.id ?? planId;
  }

  async enqueueGenerateSession(
    planId: string,
    mode?: PodcastMode,
    topicId?: string,
  ): Promise<string> {
    const jobId = topicId
      ? `session:${planId}:${topicId}:${mode ?? 'default'}`
      : `session:${planId}:${mode ?? 'default'}`;
    const job = await this.sessionsQueue.add(
      'generate-session',
      { planId, mode, topicId } satisfies SessionJob,
      {
        jobId,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
    return job.id ?? jobId;
  }

  async enqueueRetrySession(sessionId: string): Promise<string> {
    const job = await this.sessionsQueue.add(
      'retry-session',
      { sessionId } satisfies RetryJob,
      {
        jobId: `retry:${sessionId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
    return job.id ?? sessionId;
  }

  async enqueueAdvancePlan(planId: string): Promise<string> {
    const job = await this.progressQueue.add(
      'advance-plan',
      { planId } satisfies ProgressJob,
      { jobId: `advance:${planId}`, removeOnComplete: 100, removeOnFail: 50 },
    );
    return job.id ?? planId;
  }

  async enqueueNotionPlanPending(planId: string): Promise<void> {
    await this.notionQueue.add(
      'publish-content',
      { kind: 'plan-pending', planId } satisfies NotionJob,
      { jobId: `notion:plan-pending:${planId}`, removeOnComplete: 200 },
    );
  }

  async enqueueNotionPlanFinalized(planId: string): Promise<void> {
    await this.notionQueue.add(
      'publish-content',
      { kind: 'plan-finalized', planId } satisfies NotionJob,
      { jobId: `notion:plan-finalized:${planId}`, removeOnComplete: 200 },
    );
  }

  async enqueueNotionSession(sessionId: string): Promise<void> {
    await this.notionQueue.add(
      'publish-content',
      { kind: 'session', sessionId } satisfies NotionJob,
      { jobId: `notion:session:${sessionId}:${Date.now()}`, removeOnComplete: 200 },
    );
  }

  async enqueueNotionTopic(topicId: string): Promise<void> {
    await this.notionQueue.add(
      'publish-content',
      { kind: 'topic', topicId } satisfies NotionJob,
      { jobId: `notion:topic:${topicId}`, removeOnComplete: 200 },
    );
  }
}
