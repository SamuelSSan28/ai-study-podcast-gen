import {
  ConversationPlan,
  CreateConversationPlanInput,
  PodcastScript,
  PodcastMode,
  RawPodcastScript,
  StudyContent,
  StudyPlan,
  StudyPlanTopic,
  StudySession,
} from '../domain/models';
export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');
export const TOPIC_REPOSITORY = Symbol('TOPIC_REPOSITORY');
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export const AUDIO_STORAGE = Symbol('AUDIO_STORAGE');
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
  createConversationPlan(
    input: CreateConversationPlanInput,
    mode: PodcastMode,
  ): Promise<ConversationPlan>;
  generateScript(
    content: StudyContent,
    plan: ConversationPlan,
    mode: PodcastMode,
  ): Promise<RawPodcastScript>;
  polishDialogue(script: RawPodcastScript, mode: PodcastMode): Promise<PodcastScript>;
  generateSpeech(
    text: string,
    voice: string,
    instructions: string | undefined,
    destination: string,
  ): Promise<void>;
}
export interface AudioStorage {
  upload(input: { filePath: string; filename: string; folderPath: string[] }): Promise<{
    externalId: string;
    listenUrl: string;
    downloadUrl?: string;
  }>;
}
export interface PlanGenerationInput {
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  preferredDays: string[];
}
