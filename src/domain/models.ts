export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type TopicStatus = 'PLANNED' | 'GENERATING' | 'READY' | 'FAILED' | 'SKIPPED';
export type SessionStage =
  | 'CONTENT_PENDING'
  | 'CONTENT_READY'
  | 'CONVERSATION_PLAN_PENDING'
  | 'CONVERSATION_PLAN_READY'
  | 'SCRIPT_PENDING'
  | 'SCRIPT_READY'
  | 'DIALOGUE_POLISH_PENDING'
  | 'DIALOGUE_READY'
  | 'AUDIO_PENDING'
  | 'AUDIO_GENERATING'
  | 'AUDIO_READY'
  | 'UPLOAD_PENDING'
  | 'UPLOADED'
  | 'COMPLETED'
  | 'FAILED';
export type Weekday =
  'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

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

export interface ConstraintReveal {
  afterTurn?: number;
  condition?: string;
  reveal: string;
  expectedImpact: string;
}
export interface ConversationSection {
  id: string;
  topic: string;
  objective: string;
  initialQuestion: string;
  conceptsToExplore: string[];
  candidateExpectedReasoning: string[];
  interviewerChallenges: string[];
  constraintsToReveal: ConstraintReveal[];
  transitionHint?: string;
}
export interface IncidentScenario {
  title: string;
  symptoms: string[];
  constraints: string[];
  expectedInvestigation: string[];
  sectionId: string;
}
export interface ConversationPlan {
  version: string;
  title: string;
  context: { companyType: string; product: string; initialProblem: string; scale: string[] };
  objectives: string[];
  sections: ConversationSection[];
  incident?: IncidentScenario;
  closing: { finalQuestion: string; expectedThemes: string[] };
}
export interface StudyPlanContext {
  title: string;
  goal: string;
  level: string;
  previousTopicTitles?: string[];
}
export interface PreviousSessionSummary {
  title: string;
  summary: string;
}
export interface CreateConversationPlanInput {
  studyPlanContext: StudyPlanContext;
  topic: StudyPlanTopic;
  technicalContent: StudyContent;
  previousSessions?: PreviousSessionSummary[];
  targetMinutes: number;
}

export type PodcastSpeaker = 'INTERVIEWER' | 'CANDIDATE' | 'HOST';
export interface DeliveryDirection {
  tone?: 'neutral' | 'curious' | 'skeptical' | 'thoughtful' | 'confident' | 'concerned';
  pace?: 'slow' | 'medium' | 'fast';
  emphasis?: string[];
  pauseBeforeMs?: number;
  pauseAfterMs?: number;
}
export interface PodcastTurn {
  id: string;
  speaker: PodcastSpeaker;
  text: string;
  sectionId: string;
  sequence: number;
  delivery?: DeliveryDirection;
}
export interface RawPodcastScript {
  id: string;
  title: string;
  version: string;
  turns: PodcastTurn[];
  estimatedDurationSeconds: number;
}
export type PodcastScript = RawPodcastScript;
/** @deprecated Legacy chunking shape; persisted scripts use PodcastTurn. */
export interface ScriptTurn {
  speaker: PodcastSpeaker;
  text: string;
}
export interface AiUsage {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
}
export interface TtsSegmentState {
  sequence: number;
  path: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  lastError?: string;
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
  conversationPlan?: ConversationPlan;
  rawScript?: RawPodcastScript;
  script?: PodcastScript;
  audioSegments?: TtsSegmentState[];
  audioPath?: string;
  audioUrl?: string;
  audioDownloadUrl?: string;
  audioExternalId?: string;
  notionPageId?: string;
  notionUrl?: string;
  generationModel?: string;
  conversationModel?: string;
  scriptModel?: string;
  polishModel?: string;
  ttsModel?: string;
  contentPromptVersion?: string;
  conversationPlanVersion?: string;
  scriptPromptVersion?: string;
  polisherPromptVersion?: string;
  podcastPromptVersion?: string;
  usage?: Partial<Record<'content' | 'conversationPlan' | 'script' | 'polish' | 'tts', AiUsage>>;
  technicalContentHash?: string;
  conversationPlanHash?: string;
  rawScriptHash?: string;
  polishedScriptHash?: string;
  failedStage?: Exclude<SessionStage, 'FAILED'>;
  lastError?: string;
  retryCount: number;
  failureMessage?: string;
  notificationStatus: 'NOT_PENDING' | 'PENDING' | 'SENT' | 'FAILED';
  createdAt: string;
  completedAt?: string;
}
