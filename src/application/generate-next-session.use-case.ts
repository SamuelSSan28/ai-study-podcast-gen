import { Inject, Injectable } from '@nestjs/common';
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
import { StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import { selectNextTopic } from '../domain/next-topic-policy';
import { OpenAiGateway } from '../ai/openai.gateway';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
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
import { CONVERSATION_PLANNER_PROMPT_VERSION } from '../ai/prompts/conversation-planner.prompt';
import { PODCAST_SCRIPT_PROMPT_VERSION } from '../ai/prompts/podcast-script.prompt';
import { DIALOGUE_POLISHER_PROMPT_VERSION } from '../ai/prompts/dialogue-polisher.prompt';
@Injectable()
export class GenerateNextStudySessionUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
    private readonly ai: OpenAiGateway,
    private readonly knowledge: KnowledgeBaseService,
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
  ) {}
  async execute(planId: string): Promise<StudySession> {
    const plan = await this.plans.findById(planId);
    if (!plan || plan.status !== 'ACTIVE') throw new Error('Active study plan not found');
    const candidates = await this.topics.findPlanned(planId);
    if (!candidates.length) throw new Error('No planned topics remain');
    const history = await this.topics.findReady(planId);
    const selection = await selectNextTopic(candidates, history, (candidate, completed) =>
      this.ai.validateDuplicate(candidate, completed),
    );
    const topic = selection.topic;
    if (!topic)
      throw new Error(
        `No eligible unique topic remains (${selection.rejected.length} roadmap topics rejected)`,
      );
    const key = `${planId}:${topic.id}`;
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
      conversationPlanVersion: CONVERSATION_PLANNER_PROMPT_VERSION,
      scriptPromptVersion: PODCAST_SCRIPT_PROMPT_VERSION,
      polisherPromptVersion: DIALOGUE_POLISHER_PROMPT_VERSION,
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
    session.failureMessage = undefined;
    session.lastError = undefined;
    session.retryCount += 1;
    topic.status = 'GENERATING';
    return this.runRemainingStages(session, topic, plan);
  }
  private async runRemainingStages(
    session: StudySession,
    topic: StudyPlanTopic,
    plan: StudyPlan,
  ): Promise<StudySession> {
    try {
      if (!session.content) {
        const context = await this.knowledge.retrieve(topic.tags);
        session.content = await this.ai.generateContent(topic, context);
        session.stage = session.lastSuccessfulStage = 'CONTENT_READY';
        session.technicalContentHash = this.hash(session.content);
        await this.sessions.updateSession(session);
      }
      const targetMinutes = this.config.get<number>('PODCAST_TARGET_MINUTES', 30);
      if (!session.conversationPlan) {
        session.stage = 'CONVERSATION_PLAN_PENDING';
        await this.sessions.updateSession(session);
        const prior = (await this.sessions.findByPlan(plan.id))
          .filter((item) => item.id !== session.id && item.stage === 'COMPLETED')
          .map(({ title, summary }) => ({ title, summary }));
        session.conversationPlan = await this.planner.createPlan({
          studyPlanContext: { title: plan.title, goal: plan.goal, level: plan.level },
          topic,
          technicalContent: session.content,
          previousSessions: prior,
          targetMinutes,
        });
        session.conversationPlanHash = this.hash(session.conversationPlan);
        session.stage = session.lastSuccessfulStage = 'CONVERSATION_PLAN_READY';
        await this.sessions.updateSession(session);
      }
      if (!session.rawScript) {
        session.stage = 'SCRIPT_PENDING';
        await this.sessions.updateSession(session);
        session.rawScript = await this.scriptGenerator.generate({
          technicalContent: session.content,
          conversationPlan: session.conversationPlan,
        });
        session.rawScriptHash = this.hash(session.rawScript);
        session.stage = session.lastSuccessfulStage = 'SCRIPT_READY';
        await this.sessions.updateSession(session);
      }
      if (!session.script) {
        session.stage = 'DIALOGUE_POLISH_PENDING';
        await this.sessions.updateSession(session);
        session.script = await this.polisher.polish(session.rawScript);
        this.validator.validate(session.script, session.conversationPlan, targetMinutes);
        session.polishedScriptHash = this.hash(session.script);
        session.stage = session.lastSuccessfulStage = 'DIALOGUE_READY';
        await this.sessions.updateSession(session);
      }
      if (!session.audioUrl) {
        session.stage = 'AUDIO_GENERATING';
        await this.sessions.updateSession(session);
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
        await this.sessions.updateSession(session);
      }
      session.stage = session.lastSuccessfulStage = 'COMPLETED';
      session.completedAt ??= new Date().toISOString();
      session.notificationStatus = 'PENDING';
      topic.status = 'READY';
      await this.sessions.updateSession(session);
      await this.topics.update(topic);
      try {
        await this.notifier.notify(session, topic);
        session.notificationStatus = 'SENT';
      } catch {
        session.notificationStatus = 'FAILED';
      }
      await this.sessions.updateSession(session);
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
      throw error;
    }
  }
  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
