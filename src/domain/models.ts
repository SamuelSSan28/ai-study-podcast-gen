export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type StudyPlanProvisioningStatus = 'CREATING' | 'GENERATING' | 'READY' | 'FAILED';
export type PodcastMode = 'INTERVIEW' | 'DISCUSSION' | 'EXPLANATION';
export type TopicStatus = 'PLANNED' | 'GENERATING' | 'READY' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
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
  provisioningStatus: StudyPlanProvisioningStatus;
  idempotencyKey: string;
  provisioningError?: string;
  overview: string;
  notionPageId?: string;
  notionTopicsDbId?: string;
  notionUrl?: string;
  createdAt: string;
  targetSessionMinutes: number;
  currentTopicId?: string;
}
export interface ArticleOutlineSection {
  id: string;
  title: string;
  promptHint?: string;
  sourceHints?: string[];
}

export interface ArticleOutline {
  sections: ArticleOutlineSection[];
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
  notionUrl?: string;
  order: number;
  level: 'FOUNDATION' | 'CORE' | 'INTERMEDIATE' | 'ADVANCED' | 'APPLIED';
  estimatedMinutes: number;
  scheduledAt: string;
  studied: boolean;
  articleOutline?: ArticleOutline;
}
export interface TopicResearch {
  summary: string;
  keyConcepts: string[];
  sources: Array<{
    title: string;
    url: string;
    publisher: string | null;
    type: 'OFFICIAL_DOCUMENTATION' | 'PAPER' | 'ARTICLE' | 'BOOK' | 'OTHER';
  }>;
}
export interface StudyArticleSection {
  id: string;
  title: string;
  blocks: import('../persistence/notion-format.contract').ArticleContentBlock[];
}

/** Canonical teaching article — podcast scripts derive from this, not from the topic alone. */
export interface StudyContent {
  sections: StudyArticleSection[];
  reviewQuestions?: string[] | null;
}

export interface ConstraintReveal {
  afterTurn?: number | null;
  condition?: string | null;
  reveal: string;
  expectedImpact: string;
}
export interface InterviewConversationSection {
  id: string;
  topic: string;
  objective: string;
  initialQuestion: string;
  conceptsToExplore: string[];
  candidateExpectedReasoning: string[];
  interviewerChallenges: string[];
  constraintsToReveal: ConstraintReveal[];
  transitionHint?: string | null;
}
export interface DiscussionSection {
  id: string;
  topic: string;
  objective: string;
  entryPoint: string;
  discussionGoal: string;
  conceptsToExplore: string[];
  tensions: string[];
  questionsToNaturallyRaise: string[];
  scenarioReveals: ConstraintReveal[];
  possibleDisagreement?: string | null;
  connectionToPreviousSection?: string | null;
}
export interface IncidentScenario {
  title: string;
  symptoms: string[];
  constraints: string[];
  expectedInvestigation: string[];
  sectionId: string;
}
interface ConversationPlanBase {
  version: string;
  title: string;
  context: { companyType: string; product: string; initialProblem: string; scale: string[] };
  objectives: string[];
  incident?: IncidentScenario | null;
  closing: { finalQuestion: string; expectedThemes: string[] };
}
export interface InterviewConversationPlan extends ConversationPlanBase {
  mode: 'INTERVIEW';
  sections: InterviewConversationSection[];
}
export interface DiscussionConversationPlan extends ConversationPlanBase {
  mode: 'DISCUSSION';
  sections: DiscussionSection[];
}
export type ExplanationSpeakerMode = 'instructor_solo' | 'dialogue';
export type ExplanationDialogueReason =
  | 'comparison'
  | 'tradeoff'
  | 'misconception'
  | 'ambiguous_case'
  | 'decision_review'
  | 'interview_practice';
export interface ExplanationSection {
  id: string;
  episodeBeat:
    | 'HOOK'
    | 'LEARNING_PROMISE'
    | 'SETUP'
    | 'DISCOVERY'
    | 'GUIDED_PRACTICE'
    | 'FAILURE'
    | 'CORRECTION'
    | 'INDEPENDENT_CHECK'
    | 'MENTAL_MODEL'
    | 'RECAP';
  topic: string;
  objective: string;
  concept: string;
  examples: string[];
  realWorldCases: string[];
  /** instructor_solo = INSTRUCTOR only; dialogue = CO_HOST + INSTRUCTOR when pedagogically justified */
  speakerMode: ExplanationSpeakerMode;
  /** Required when speakerMode is dialogue; null/omit for instructor_solo */
  dialogueReason?: ExplanationDialogueReason | null;
  coHostMoments: string[];
  keyTakeaways: string[];
  /** @deprecated Use coHostMoments — kept for persisted plans */
  faqItems?: Array<{ question: string; answer: string }> | null;
}
export type ExplanationDeliveryApproach =
  | 'solo_lecture'
  | 'instructor_with_faq'
  | 'guided_walkthrough';
export interface ExplanationRunningScenario {
  name: string;
  description: string;
  components: string[];
}
export interface ExplanationConversationPlan extends ConversationPlanBase {
  mode: 'EXPLANATION';
  centralQuestion: string;
  runningScenario: ExplanationRunningScenario;
  deliveryApproach: ExplanationDeliveryApproach;
  deliveryRationale: string;
  sections: ExplanationSection[];
}
export type ConversationPlan =
  | InterviewConversationPlan
  | DiscussionConversationPlan
  | ExplanationConversationPlan;
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

export type PodcastSpeaker =
  | 'INTERVIEWER'
  | 'CANDIDATE'
  | 'ENGINEER_A'
  | 'ENGINEER_B'
  | 'HOST'
  | 'INSTRUCTOR'
  | 'CO_HOST';
export type DialogueRole =
  | 'HOOK'
  | 'QUESTION'
  | 'EXPLAIN'
  | 'EXAMPLE'
  | 'CHALLENGE'
  | 'ANSWER'
  | 'CORRECTION'
  | 'RECAP'
  | 'TRANSITION';
export type DeliveryStyle =
  | 'normal'
  | 'reflective'
  | 'conversational'
  | 'energetic'
  | 'question';
export interface DeliveryDirection {
  style?: DeliveryStyle | null;
  tone?: 'neutral' | 'curious' | 'skeptical' | 'thoughtful' | 'confident' | 'concerned' | null;
  pace?: 'slow' | 'medium' | 'fast' | null;
  emphasis?: string[] | null;
  pauseBeforeMs?: number | null;
  pauseAfterMs?: number | null;
}
export interface PodcastTurn {
  id: string;
  speaker: PodcastSpeaker;
  text: string;
  sectionId: string;
  sequence: number;
  role?: DialogueRole | null;
  delivery?: DeliveryDirection | null;
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
  podcastMode: PodcastMode;
  stage: SessionStage;
  lastSuccessfulStage: Exclude<SessionStage, 'FAILED'>;
  summary: string;
  content?: StudyContent;
  research?: TopicResearch;
  conversationPlan?: ConversationPlan;
  rawScript?: RawPodcastScript;
  script?: PodcastScript;
  audioSegments?: TtsSegmentState[];
  audioPath?: string;
  audioUrl?: string;
  audioDownloadUrl?: string;
  audioExternalId?: string;
  notionPageId?: string;
  notionScriptPageId?: string;
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
