export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type TopicStatus = 'PLANNED' | 'GENERATING' | 'READY' | 'FAILED' | 'SKIPPED';
export type SessionStage =
  | 'CLAIMED'
  | 'CONTENT_READY'
  | 'SCRIPT_READY'
  | 'AUDIO_READY'
  | 'COMPLETED'
  | 'FAILED';
export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface StudyPlan {
  id: string;
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  preferredDays: Weekday[];
  startDate: string;
  endDate: string;
  status: PlanStatus;
  overview: string;
  notionPageId?: string;
  notionUrl?: string;
  createdAt: string;
}
export interface StudyPlanTopic {
  id: string;
  studyPlanId: string;
  title: string;
  slug: string;
  description: string;
  week: number;
  sequence: number;
  difficulty: 'FOUNDATIONAL' | 'INTERMEDIATE' | 'ADVANCED';
  tags: string[];
  learningObjectives: string[];
  prerequisites: string[];
  depthDelta: string;
  summary: string;
  status: TopicStatus;
  notionPageId?: string;
}
export interface StudyContent {
  overview: string;
  businessContext: string;
  requirements: string[];
  assumptions: string[];
  architecture: string;
  architectureEvolution: string[];
  decisions: string[];
  failureScenarios: string[];
  observability: string[];
  slos: string[];
  tradeoffs: string[];
  vocabulary: string[];
  reviewQuestions: string[];
  challenge?: string | null;
}
export interface ScriptTurn {
  speaker: 'HOST' | 'INTERVIEWER' | 'CANDIDATE';
  text: string;
}
export interface StudySession {
  id: string;
  generationKey: string;
  studyPlanId: string;
  topicId: string;
  title: string;
  stage: SessionStage;
  lastSuccessfulStage: Exclude<SessionStage, 'FAILED'>;
  summary: string;
  content?: StudyContent;
  script?: ScriptTurn[];
  audioPath?: string;
  audioUrl?: string;
  notionPageId?: string;
  notionUrl?: string;
  generationModel?: string;
  ttsModel?: string;
  contentPromptVersion?: string;
  podcastPromptVersion?: string;
  failureMessage?: string;
  notificationStatus: 'NOT_PENDING' | 'PENDING' | 'SENT' | 'FAILED';
  createdAt: string;
  completedAt?: string;
}
