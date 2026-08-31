import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  PLAN_REPOSITORY,
  SESSION_REPOSITORY,
  StudyPlanRepository,
  StudySessionRepository,
  StudyTopicRepository,
  TOPIC_REPOSITORY,
  AUDIO_STORAGE,
  AudioStorage,
} from './ports';
import { PodcastMode, StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import { selectNextTopic } from '../domain/next-topic-policy';
import { OpenAiGateway } from '../ai/openai.gateway';
import { LocalAudioService } from '../audio/local-audio.service';
import { DiscordNotifier } from '../notifications/discord.notifier';
import { AiModelConfig } from '../config/ai-model.config';
import { PROMPT_VERSIONS } from '../ai/prompts/prompts';
import { OpenAiConversationPlanner } from '../conversation/conversation-planner';
import { OpenAiPodcastScriptGenerator } from '../conversation/podcast-script-generator';
import { OpenAiDialoguePolisher } from '../conversation/dialogue-polisher';
import { PodcastScriptValidator } from '../conversation/podcast-script.validator';
import { ConfigurableAudioDirector } from '../audio/audio-director';
import { TurnBasedTtsService } from '../audio/turn-based-tts.service';
import { FfmpegAudioComposer } from '../audio/audio-composer';
import { INTERVIEW_PLANNER_PROMPT_VERSION } from '../ai/prompts/interview/conversation-planner.prompt';
import { INTERVIEW_SCRIPT_PROMPT_VERSION } from '../ai/prompts/interview/podcast-script.prompt';
import { INTERVIEW_POLISHER_PROMPT_VERSION } from '../ai/prompts/interview/dialogue-polisher.prompt';
import { DISCUSSION_PLANNER_PROMPT_VERSION } from '../ai/prompts/discussion/conversation-planner.prompt';
import { DISCUSSION_SCRIPT_PROMPT_VERSION } from '../ai/prompts/discussion/podcast-script.prompt';
import { DISCUSSION_POLISHER_PROMPT_VERSION } from '../ai/prompts/discussion/dialogue-polisher.prompt';
import { RunTraceService } from '../observability/run-trace.service';
import { EvalConfig } from '../observability/eval-config';

@Injectable()
export class GenerateNextStudySessionUseCase {
  private readonly evalConfig: EvalConfig;

  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
    private readonly ai: OpenAiGateway,
    private readonly audio: LocalAudioService,
    @Inject(AUDIO_STORAGE) private readonly audioStorage: AudioStorage,
    private readonly notifier: DiscordNotifier,
    private readonly models: AiModelConfig,
    private readonly config: ConfigService,
    private readonly planner: OpenAiConversationPlanner,
    private readonly scriptGenerator: OpenAiPodcastScriptGenerator,
    private readonly polisher: OpenAiDialoguePolisher,
    private readonly validator: PodcastScriptValidator,
    private readonly director: ConfigurableAudioDirector,
    private readonly tts: TurnBasedTtsService,
    private readonly composer: FfmpegAudioComposer,
    @Optional() private readonly trace?: RunTraceService,
  ) {
    this.evalConfig = this.trace?.getConfig() ?? { enabled: false, mode: 'final', skipWebResearch: false, skipDuplicateCheck: false, skipPriorContext: false, skipValidator: false, skipAudio: false, skipNotification: false, humanStepsRequired: 0 };
  }

  async execute(planId: string, requestedMode?: PodcastMode): Promise<StudySession> {
    this.trace?.beginRun({
      runId: this.evalConfig.runId,
      caseId: this.evalConfig.caseId,
      mode: this.evalConfig.mode,
    });
    const mode =
      requestedMode ?? this.config.get<PodcastMode>('DEFAULT_PODCAST_MODE', 'DISCUSSION');
    const plan = await this.plans.findById(planId);
    if (!plan || plan.status !== 'ACTIVE') throw new Error('Active study plan not found');
    const candidates = await this.topics.findPlanned(planId);
    if (!candidates.length) throw new Error('No planned topics remain');
    const history = await this.topics.findReady(planId);
    this.trace?.startStage('topic_selection');
    const selection = await selectNextTopic(candidates, history, async (candidate, completed) => {
      if (this.evalConfig.skipDuplicateCheck) {
        this.trace?.recordDuplicateCheck({
          topicId: candidate.id,
          classification: 'NEW',
        });
        return 'NEW';
      }
      const classification = await this.ai.validateDuplicate(candidate, completed);
      this.trace?.recordDuplicateCheck({ topicId: candidate.id, classification });
      return classification;
    });
    for (const rejected of selection.rejected) {
      this.trace?.recordDuplicateCheck({
        topicId: rejected.topicId,
        classification: 'REJECTED',
        rejectedReason: rejected.reason,
      });
    }
    this.trace?.endStage('topic_selection', { selectedTopicId: selection.topic?.id });
    const topic = selection.topic;
    if (!topic)
      throw new Error(
        `No eligible unique topic remains (${selection.rejected.length} roadmap topics rejected)`,
      );
    const key = `${planId}:${topic.id}:${mode}`;
    const existing = await this.sessions.findByGenerationKey(key);
    if (existing) return existing;
    topic.status = 'GENERATING';
    await this.topics.update(topic);
    const session: StudySession = {
      id: randomUUID(),
      generationKey: key,
      studyPlanId: planId,
      topicId: topic.id,
      title: topic.title,
      podcastMode: mode,
      stage: 'CONTENT_PENDING',
      lastSuccessfulStage: 'CONTENT_PENDING',
      summary: topic.summary,
      notificationStatus: 'NOT_PENDING',
      createdAt: new Date().toISOString(),
      generationModel: this.models.content,
      ttsModel: this.models.tts,
      contentPromptVersion: PROMPT_VERSIONS.content,
      podcastPromptVersion: PROMPT_VERSIONS.script,
      conversationModel: this.models.conversationPlan,
      scriptModel: this.models.podcast,
      polishModel: this.models.polish,
      conversationPlanVersion:
        mode === 'INTERVIEW' ? INTERVIEW_PLANNER_PROMPT_VERSION : DISCUSSION_PLANNER_PROMPT_VERSION,
      scriptPromptVersion:
        mode === 'INTERVIEW' ? INTERVIEW_SCRIPT_PROMPT_VERSION : DISCUSSION_SCRIPT_PROMPT_VERSION,
      polisherPromptVersion:
        mode === 'INTERVIEW'
          ? INTERVIEW_POLISHER_PROMPT_VERSION
          : DISCUSSION_POLISHER_PROMPT_VERSION,
      retryCount: 0,
    };
    await this.sessions.createSession(session);
    return this.runRemainingStages(session, topic, plan);
  }

  async retry(sessionId: string): Promise<StudySession> {
    const session = await this.sessions.findSessionById(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.stage !== 'FAILED' && session.notificationStatus !== 'FAILED') return session;
    const topic = await this.topics.findTopicById(session.topicId);
    if (!topic) throw new Error('Session topic not found');
    const plan = await this.plans.findById(session.studyPlanId);
    if (!plan) throw new Error('Session study plan not found');
    session.podcastMode ??= 'INTERVIEW';
    session.failureMessage = undefined;
    session.lastError = undefined;
    session.retryCount += 1;
    this.trace?.recordRetry(session.retryCount);
    topic.status = 'GENERATING';
    return this.runRemainingStages(session, topic, plan);
  }

  private maybeInjectFailure(stage: string): void {
    if (this.evalConfig.injectFailureStage === stage) {
      throw new Error(`Injected eval failure at ${stage}`);
    }
  }

  private validateScript(
    session: StudySession,
    targetMinutes: number,
  ): void {
    if (this.evalConfig.skipValidator) {
      this.trace?.recordValidation({ passed: true, errors: ['skipped_by_eval'] });
      return;
    }
    try {
      this.validator.validate(session.script!, session.conversationPlan!, targetMinutes);
      this.trace?.recordValidation({ passed: true, errors: [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      this.trace?.recordValidation({ passed: false, errors: [message] });
      throw error;
    }
  }

  private async runRemainingStages(
    session: StudySession,
    topic: StudyPlanTopic,
    plan: StudyPlan,
  ): Promise<StudySession> {
    try {
      if (!session.content) {
        this.trace?.startStage('research');
        if (this.evalConfig.skipWebResearch) {
          session.research = {
            summary: topic.summary,
            keyConcepts: topic.learningObjectives,
            sources: [],
          };
        } else {
          session.research = await this.ai.researchTopic(topic);
          this.trace?.recordSourceCount(session.research.sources.length);
        }
        this.trace?.endStage('research', { sourceCount: session.research.sources.length });
        this.maybeInjectFailure('CONTENT_READY');
        this.trace?.startStage('content');
        session.content = await this.ai.generateContent(
          topic,
          this.evalConfig.skipWebResearch
            ? `TOPIC_ONLY:${topic.description}`
            : `CURRENT_WEB_RESEARCH:${JSON.stringify(session.research)}`,
        );
        this.trace?.endStage('content');
        session.stage = session.lastSuccessfulStage = 'CONTENT_READY';
        session.technicalContentHash = this.hash(session.content);
        await this.sessions.updateSession(session);
      }
      const targetMinutes = Math.min(plan.targetSessionMinutes ?? 45, 30);
      if (!session.conversationPlan) {
        session.stage = 'CONVERSATION_PLAN_PENDING';
        await this.sessions.updateSession(session);
        this.trace?.startStage('conversation_plan');
        const prior = this.evalConfig.skipPriorContext
          ? []
          : (await this.sessions.findByPlan(plan.id))
              .filter((item) => item.id !== session.id && item.stage === 'COMPLETED')
              .map(({ title, summary }) => ({ title, summary }));
        session.conversationPlan = await this.planner.createPlan(
          {
            studyPlanContext: { title: plan.title, goal: plan.goal, level: plan.level },
            topic,
            technicalContent: session.content,
            previousSessions: prior,
            targetMinutes,
          },
          session.podcastMode,
        );
        this.trace?.endStage('conversation_plan', { priorSessionCount: prior.length });
        this.maybeInjectFailure('CONVERSATION_PLAN_READY');
        session.conversationPlanHash = this.hash(session.conversationPlan);
        session.stage = session.lastSuccessfulStage = 'CONVERSATION_PLAN_READY';
        await this.sessions.updateSession(session);
      }
      if (!session.rawScript) {
        session.stage = 'SCRIPT_PENDING';
        await this.sessions.updateSession(session);
        this.trace?.startStage('script');
        session.rawScript = await this.scriptGenerator.generate({
          technicalContent: session.content,
          conversationPlan: session.conversationPlan,
          mode: session.podcastMode,
        });
        this.trace?.endStage('script');
        this.maybeInjectFailure('SCRIPT_READY');
        session.rawScriptHash = this.hash(session.rawScript);
        session.stage = session.lastSuccessfulStage = 'SCRIPT_READY';
        await this.sessions.updateSession(session);
      }
      if (!session.script) {
        session.stage = 'DIALOGUE_POLISH_PENDING';
        await this.sessions.updateSession(session);
        this.trace?.startStage('dialogue_polish');
        session.script = await this.polisher.polish(session.rawScript, session.podcastMode);
        this.trace?.endStage('dialogue_polish');
        this.validateScript(session, targetMinutes);
        this.maybeInjectFailure('DIALOGUE_READY');
        session.polishedScriptHash = this.hash(session.script);
        session.stage = session.lastSuccessfulStage = 'DIALOGUE_READY';
        await this.sessions.updateSession(session);
      }
      if (!session.audioUrl && !this.evalConfig.skipAudio) {
        session.stage = 'AUDIO_GENERATING';
        await this.sessions.updateSession(session);
        this.trace?.startStage('audio');
        const destination = this.audio.destination(session.id);
        const jobs = this.director.buildJobs(session.script);
        const generated = await this.tts.generate(
          session.id,
          jobs,
          session.audioSegments,
          async (states) => {
            session.audioSegments = states;
            await this.sessions.updateSession(session);
          },
        );
        session.audioSegments = generated.states;
        await this.composer.compose(generated.segments, destination);
        session.audioPath = destination;
        session.stage = session.lastSuccessfulStage = 'AUDIO_READY';
        await this.sessions.updateSession(session);
        session.stage = 'UPLOAD_PENDING';
        await this.sessions.updateSession(session);
        const artifact = await this.audioStorage.upload({
          filePath: destination,
          filename: `${topic.slug}.mp3`,
          folderPath: [
            this.config.get<string>('GOOGLE_DRIVE_ROOT_FOLDER', 'AI Study Podcasts'),
            plan.title,
            `Week ${String(topic.week).padStart(2, '0')}`,
          ],
        });
        session.audioExternalId = artifact.externalId;
        session.audioUrl = artifact.listenUrl;
        session.audioDownloadUrl = artifact.downloadUrl;
        session.stage = session.lastSuccessfulStage = 'UPLOADED';
        this.trace?.endStage('audio');
        await this.sessions.updateSession(session);
      } else if (!session.audioUrl && this.evalConfig.skipAudio) {
        session.audioUrl = `eval://skipped/${session.id}`;
        session.stage = session.lastSuccessfulStage = 'UPLOADED';
        this.trace?.startStage('audio');
        this.trace?.endStage('audio', { skipped: true });
        await this.sessions.updateSession(session);
      }
      session.stage = session.lastSuccessfulStage = 'COMPLETED';
      session.completedAt ??= new Date().toISOString();
      session.notificationStatus = 'PENDING';
      topic.status = 'READY';
      await this.sessions.updateSession(session);
      await this.topics.update(topic);
      if (!this.evalConfig.skipNotification) {
        try {
          await this.notifier.notify(session, topic);
          session.notificationStatus = 'SENT';
        } catch {
          session.notificationStatus = 'FAILED';
        }
      } else {
        session.notificationStatus = 'NOT_PENDING';
      }
      await this.sessions.updateSession(session);
      this.trace?.finishRun({ success: true });
      return session;
    } catch (error) {
      session.failedStage =
        session.stage === 'FAILED' ? session.lastSuccessfulStage : session.stage;
      session.stage = 'FAILED';
      session.lastError = session.failureMessage =
        error instanceof Error ? error.message : 'Unknown generation error';
      topic.status = 'FAILED';
      await this.sessions.updateSession(session);
      await this.topics.update(topic);
      if (!this.evalConfig.skipNotification) {
        try {
          await this.notifier.notifyFailure({ session, topic, plan, error });
        } catch {
          // Discord failure alerts must not mask the original pipeline error.
        }
      }
      this.trace?.finishRun({
        success: false,
        failedStage: session.failedStage,
        errorMessage: session.failureMessage,
      });
      throw error;
    }
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
