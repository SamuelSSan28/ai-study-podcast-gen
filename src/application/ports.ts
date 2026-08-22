import {
  ScriptTurn,
  StudyContent,
  StudyPlan,
  StudyPlanTopic,
  StudySession,
} from '../domain/models';
export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');
export const TOPIC_REPOSITORY = Symbol('TOPIC_REPOSITORY');
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export interface StudyPlanRepository {
  create(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<StudyPlan>;
  findAll(): Promise<StudyPlan[]>;
  findById(id: string): Promise<StudyPlan | null>;
  findActive(): Promise<StudyPlan[]>;
}
export interface StudyTopicRepository {
  findTopicById(id: string): Promise<StudyPlanTopic | null>;
  findPlanned(planId: string): Promise<StudyPlanTopic[]>;
  findReady(planId: string): Promise<StudyPlanTopic[]>;
  update(topic: StudyPlanTopic): Promise<void>;
}
export interface StudySessionRepository {
  createSession(session: StudySession): Promise<StudySession>;
  findSessionById(id: string): Promise<StudySession | null>;
  findByGenerationKey(key: string): Promise<StudySession | null>;
  findByPlan(planId: string): Promise<StudySession[]>;
  updateSession(session: StudySession): Promise<void>;
}
export interface GeneratedPlan {
  overview: string;
  topics: Array<Omit<StudyPlanTopic, 'id' | 'studyPlanId' | 'slug' | 'status' | 'notionPageId'>>;
}
export interface AiGateway {
  generatePlan(input: PlanGenerationInput, context: string): Promise<GeneratedPlan>;
  validateDuplicate(
    candidate: StudyPlanTopic,
    history: StudyPlanTopic[],
  ): Promise<'NEW' | 'RELATED_BUT_DEEPER' | 'DUPLICATE'>;
  generateContent(topic: StudyPlanTopic, context: string): Promise<StudyContent>;
  generateScript(
    topic: StudyPlanTopic,
    content: StudyContent,
    minutes: number,
  ): Promise<ScriptTurn[]>;
  generateSpeech(turns: ScriptTurn[], destination: string): Promise<void>;
}
export interface PlanGenerationInput {
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  preferredDays: string[];
}
