import {
  StudyPlanRepository,
  StudySessionRepository,
  StudyTopicRepository,
  AudioStorage,
} from '../application/ports';
import { StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';

export class EvalAudioStorage implements AudioStorage {
  upload(input: { filePath: string; filename: string; folderPath: string[] }): Promise<{
    externalId: string;
    listenUrl: string;
    downloadUrl?: string;
  }> {
    return Promise.resolve({
      externalId: `eval-${input.filename}`,
      listenUrl: `https://eval.local/${input.folderPath.join('/')}/${input.filename}`,
      downloadUrl: `https://eval.local/download/${input.filename}`,
    });
  }
}

export class InMemoryStudyRepository
  implements StudyPlanRepository, StudyTopicRepository, StudySessionRepository
{
  private plans = new Map<string, StudyPlan>();
  private topics = new Map<string, StudyPlanTopic>();
  private sessions = new Map<string, StudySession>();

  create(plan: StudyPlan, planTopics: StudyPlanTopic[]): Promise<StudyPlan> {
    this.plans.set(plan.id, plan);
    for (const topic of planTopics) this.topics.set(topic.id, { ...topic });
    return Promise.resolve(plan);
  }

  findAll(): Promise<StudyPlan[]> {
    return Promise.resolve([...this.plans.values()]);
  }

  findById(id: string): Promise<StudyPlan | null> {
    return Promise.resolve(this.plans.get(id) ?? null);
  }

  findActive(): Promise<StudyPlan[]> {
    return Promise.resolve([...this.plans.values()].filter((plan) => plan.status === 'ACTIVE'));
  }

  updatePlan(plan: StudyPlan): Promise<void> {
    this.plans.set(plan.id, plan);
    return Promise.resolve();
  }

  findTopicById(id: string): Promise<StudyPlanTopic | null> {
    return Promise.resolve(this.topics.get(id) ?? null);
  }

  findPlanned(planId: string): Promise<StudyPlanTopic[]> {
    return Promise.resolve(
      [...this.topics.values()].filter(
        (topic) => topic.studyPlanId === planId && topic.status === 'PLANNED',
      ),
    );
  }

  findReady(planId: string): Promise<StudyPlanTopic[]> {
    return Promise.resolve(
      [...this.topics.values()].filter(
        (topic) => topic.studyPlanId === planId && topic.status === 'READY',
      ),
    );
  }

  findCompleted(planId: string): Promise<StudyPlanTopic[]> {
    return Promise.resolve(
      [...this.topics.values()].filter(
        (topic) => topic.studyPlanId === planId && topic.status === 'COMPLETED',
      ),
    );
  }

  update(topic: StudyPlanTopic): Promise<void> {
    this.topics.set(topic.id, topic);
    return Promise.resolve();
  }

  createSession(session: StudySession): Promise<StudySession> {
    this.sessions.set(session.id, { ...session });
    return Promise.resolve(session);
  }

  findSessionById(id: string): Promise<StudySession | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }

  findByGenerationKey(key: string): Promise<StudySession | null> {
    return Promise.resolve(
      [...this.sessions.values()].find((session) => session.generationKey === key) ?? null,
    );
  }

  findByPlan(planId: string): Promise<StudySession[]> {
    return Promise.resolve(
      [...this.sessions.values()].filter((session) => session.studyPlanId === planId),
    );
  }

  updateSession(session: StudySession): Promise<void> {
    this.sessions.set(session.id, session);
    return Promise.resolve();
  }

  seed(plan: StudyPlan, planTopics: StudyPlanTopic[]): void {
    this.plans.set(plan.id, plan);
    for (const topic of planTopics) this.topics.set(topic.id, { ...topic });
  }

  getLastSession(): StudySession | undefined {
    return [...this.sessions.values()].at(-1);
  }
}

export const EVAL_REPOSITORIES = {
  plan: Symbol('EVAL_PLAN_REPOSITORY'),
  topic: Symbol('EVAL_TOPIC_REPOSITORY'),
  session: Symbol('EVAL_SESSION_REPOSITORY'),
};
