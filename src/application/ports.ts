import {
  ArticleReview,
  ConversationPlan,
  CreateConversationPlanInput,
  PodcastScript,
  PodcastMode,
  RawPodcastScript,
  StudyContent,
  StudyPlan,
  StudyPlanTopic,
  StudySession,
  TopicResearch,
} from '../domain/models';
export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');
export const TOPIC_REPOSITORY = Symbol('TOPIC_REPOSITORY');
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export const AUDIO_STORAGE = Symbol('AUDIO_STORAGE');
export interface StudyPlanRepository {
  createPending(plan: StudyPlan): Promise<StudyPlan>;
  finalizePlan(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<StudyPlan>;
  findAll(): Promise<StudyPlan[]>;
  findById(id: string): Promise<StudyPlan | null>;
  findByIdempotencyKey(key: string): Promise<StudyPlan | null>;
  findActiveByGoal(goal: string): Promise<StudyPlan | null>;
  findInFlightByGoal(goal: string): Promise<StudyPlan | null>;
  findActive(): Promise<StudyPlan[]>;
  updatePlan(plan: StudyPlan): Promise<void>;
  archivePlan(id: string): Promise<void>;
}
export interface StudyTopicRepository {
  findTopicById(id: string): Promise<StudyPlanTopic | null>;
  findTopicsByPlan(planId: string): Promise<StudyPlanTopic[]>;
  findPlanned(planId: string): Promise<StudyPlanTopic[]>;
  findReady(planId: string): Promise<StudyPlanTopic[]>;
  findCompleted(planId: string): Promise<StudyPlanTopic[]>;
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
  topics: Array<
    Omit<
      StudyPlanTopic,
      | 'id'
      | 'studyPlanId'
      | 'slug'
      | 'status'
      | 'notionPageId'
      | 'order'
      | 'scheduledAt'
      | 'studied'
      | 'articleOutline'
    >
  >;
}
export interface AiGateway {
  generatePlan(input: PlanGenerationInput): Promise<GeneratedPlan>;
  validateDuplicate(
    candidate: StudyPlanTopic,
    history: StudyPlanTopic[],
  ): Promise<'NEW' | 'RELATED_BUT_DEEPER' | 'DUPLICATE'>;
  generateContent(topic: StudyPlanTopic, context: string): Promise<StudyContent>;
  reviewArticle(
    topic: StudyPlanTopic,
    research: TopicResearch,
    article: StudyContent,
  ): Promise<ArticleReview>;
  reviseArticle(
    topic: StudyPlanTopic,
    research: TopicResearch,
    article: StudyContent,
    review: ArticleReview,
  ): Promise<StudyContent>;
  researchTopic(topic: StudyPlanTopic): Promise<TopicResearch>;
  createConversationPlan(
    input: CreateConversationPlanInput,
    mode: PodcastMode,
  ): Promise<ConversationPlan>;
  generateScript(
    topic: StudyPlanTopic,
    content: StudyContent,
    plan: ConversationPlan,
    mode: PodcastMode,
  ): Promise<RawPodcastScript>;
  polishDialogue(
    script: RawPodcastScript,
    mode: PodcastMode,
    context?: { article: StudyContent; plan: ConversationPlan },
  ): Promise<PodcastScript>;
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
  durationWeeks: number;
  sessionsPerWeek: number;
  preferredDays: string[];
  targetSessionMinutes: number;
}
