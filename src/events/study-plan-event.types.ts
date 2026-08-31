export const STUDY_PLAN_EVENT_TYPES = [
  'PLAN_CREATED',
  'PLAN_READY',
  'CURRICULUM_GENERATION_STARTED',
  'CURRICULUM_GENERATED',
  'SESSION_GENERATION_STARTED',
  'SESSION_READY',
  'SESSION_SKIPPED',
  'TOPIC_READY',
  'RETRY_SCHEDULED',
  'GENERATION_FAILED',
] as const;

export type StudyPlanEventType = (typeof STUDY_PLAN_EVENT_TYPES)[number];
export type EventStatus = 'RUNNING' | 'SUCCESS' | 'WARNING' | 'FAILED' | 'SKIPPED';
export type EventSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface PublishStudyPlanEvent {
  planId: string;
  type: StudyPlanEventType;
  status: EventStatus;
  severity?: EventSeverity;
  topicId?: string;
  sessionId?: string;
  stage?: string;
  result?: Record<string, unknown>;
  error?: unknown;
  metadata?: Record<string, unknown>;
}

export interface StudyPlanEvent extends Omit<PublishStudyPlanEvent, 'error' | 'severity'> {
  id: string;
  severity: EventSeverity;
  error?: { name?: string; message: string; code?: string; stack?: string; cause?: unknown };
  createdAt: string;
}
