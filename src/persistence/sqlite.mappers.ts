import {
  StudyPlan as StudyPlanRow,
  StudyPlanTopic as StudyPlanTopicRow,
  StudySession as StudySessionRow,
} from '@prisma/client';
import {
  StudyPlan,
  StudyPlanTopic,
  StudySession,
  Weekday,
} from '../domain/models';

export function planToRow(plan: StudyPlan): {
  id: string;
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  preferredDays: string;
  startDate: string;
  endDate: string;
  status: string;
  provisioningStatus: string;
  idempotencyKey: string;
  provisioningError: string | null;
  overview: string;
  notionPageId: string | null;
  notionTopicsDbId: string | null;
  notionUrl: string | null;
  targetSessionMinutes: number;
  currentTopicId: string | null;
  createdAt: Date;
} {
  return {
    id: plan.id,
    title: plan.title,
    goal: plan.goal,
    level: plan.level,
    durationWeeks: plan.durationWeeks,
    sessionsPerWeek: plan.sessionsPerWeek,
    preferredDays: JSON.stringify(plan.preferredDays),
    startDate: plan.startDate,
    endDate: plan.endDate,
    status: plan.status,
    provisioningStatus: plan.provisioningStatus,
    idempotencyKey: plan.idempotencyKey,
    provisioningError: plan.provisioningError ?? null,
    overview: plan.overview,
    notionPageId: plan.notionPageId ?? null,
    notionTopicsDbId: plan.notionTopicsDbId ?? null,
    notionUrl: plan.notionUrl ?? null,
    targetSessionMinutes: plan.targetSessionMinutes,
    currentTopicId: plan.currentTopicId ?? null,
    createdAt: new Date(plan.createdAt),
  };
}

export function planFromRow(row: StudyPlanRow): StudyPlan {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    level: row.level,
    durationWeeks: row.durationWeeks,
    sessionsPerWeek: row.sessionsPerWeek,
    preferredDays: JSON.parse(row.preferredDays) as Weekday[],
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as StudyPlan['status'],
    provisioningStatus: row.provisioningStatus as StudyPlan['provisioningStatus'],
    idempotencyKey: row.idempotencyKey,
    provisioningError: row.provisioningError ?? undefined,
    overview: row.overview,
    notionPageId: row.notionPageId ?? undefined,
    notionTopicsDbId: row.notionTopicsDbId ?? undefined,
    notionUrl: row.notionUrl ?? undefined,
    targetSessionMinutes: row.targetSessionMinutes,
    currentTopicId: row.currentTopicId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function topicToRow(topic: StudyPlanTopic): {
  id: string;
  studyPlanId: string;
  payload: string;
  status: string;
  studied: boolean;
  order: number;
  scheduledAt: string;
  week: number;
  sequence: number;
  notionPageId: string | null;
} {
  return {
    id: topic.id,
    studyPlanId: topic.studyPlanId,
    payload: JSON.stringify(topic),
    status: topic.status,
    studied: topic.studied,
    order: topic.order,
    scheduledAt: topic.scheduledAt,
    week: topic.week,
    sequence: topic.sequence,
    notionPageId: topic.notionPageId ?? null,
  };
}

export function topicFromRow(row: StudyPlanTopicRow): StudyPlanTopic {
  const topic = JSON.parse(row.payload) as StudyPlanTopic;
  return {
    ...topic,
    id: row.id,
    studyPlanId: row.studyPlanId,
    status: row.status as StudyPlanTopic['status'],
    studied: row.studied,
    order: row.order,
    scheduledAt: row.scheduledAt,
    week: row.week,
    sequence: row.sequence,
    notionPageId: row.notionPageId ?? topic.notionPageId,
  };
}

export function sessionToRow(session: StudySession): {
  id: string;
  studyPlanId: string;
  topicId: string;
  generationKey: string;
  stage: string;
  payload: string;
  createdAt: Date;
  completedAt: Date | null;
  notionPageId: string | null;
  notionScriptPageId: string | null;
} {
  return {
    id: session.id,
    studyPlanId: session.studyPlanId,
    topicId: session.topicId,
    generationKey: session.generationKey,
    stage: session.stage,
    payload: JSON.stringify(session),
    createdAt: new Date(session.createdAt),
    completedAt: session.completedAt ? new Date(session.completedAt) : null,
    notionPageId: session.notionPageId ?? null,
    notionScriptPageId: session.notionScriptPageId ?? null,
  };
}

export function sessionFromRow(row: StudySessionRow): StudySession {
  const session = JSON.parse(row.payload) as StudySession;
  return {
    ...session,
    id: row.id,
    studyPlanId: row.studyPlanId,
    topicId: row.topicId,
    generationKey: row.generationKey,
    stage: row.stage as StudySession['stage'],
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    notionPageId: row.notionPageId ?? session.notionPageId,
    notionScriptPageId: row.notionScriptPageId ?? session.notionScriptPageId,
  };
}
