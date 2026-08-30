import { randomUUID } from 'node:crypto';
import { EvalCase } from './eval-case.types';
import { InMemoryStudyRepository } from './memory.repository';
import { StudyPlan, StudyPlanTopic } from '../domain/models';
import { topicSlug } from '../domain/topic-normalization';

export function seedEvalCase(repo: InMemoryStudyRepository, evalCase: EvalCase): {
  planId: string;
  topicId: string;
} {
  const planId = randomUUID();
  const topicId = randomUUID();
  const plan: StudyPlan = {
    id: planId,
    title: evalCase.title,
    goal: evalCase.goal,
    level: 'adaptive',
    durationWeeks: 6,
    sessionsPerWeek: 3,
    preferredDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10),
    status: 'ACTIVE',
    overview: evalCase.topic.summary,
    createdAt: new Date().toISOString(),
    targetSessionMinutes: 45,
    currentTopicId: topicId,
  };
  const topic: StudyPlanTopic = {
    id: topicId,
    studyPlanId: planId,
    title: evalCase.topic.title,
    slug: topicSlug(evalCase.topic.title),
    description: evalCase.topic.description,
    week: evalCase.topic.week,
    sequence: evalCase.topic.sequence,
    difficulty: evalCase.topic.difficulty,
    tags: evalCase.topic.tags,
    learningObjectives: evalCase.topic.learningObjectives,
    prerequisites: evalCase.topic.prerequisites,
    depthDelta: evalCase.topic.depthDelta,
    summary: evalCase.topic.summary,
    status: 'PLANNED',
    order: 1,
    level: evalCase.topic.level,
    estimatedMinutes: evalCase.topic.estimatedMinutes,
    scheduledAt: new Date().toISOString(),
    studied: false,
  };
  repo.seed(plan, [topic]);
  return { planId, topicId };
}
