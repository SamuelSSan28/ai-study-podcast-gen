import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  PLAN_REPOSITORY,
  SESSION_REPOSITORY,
  StudyPlanRepository,
  StudySessionRepository,
  StudyTopicRepository,
  TOPIC_REPOSITORY,
} from './ports';
import { StudyPlanTopic, StudySession } from '../domain/models';
import { selectNextTopic } from '../domain/next-topic-policy';
import { OpenAiGateway } from '../ai/openai.gateway';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { LocalAudioService } from '../audio/local-audio.service';
import { DiscordNotifier } from '../notifications/discord.notifier';
import { AiModelConfig } from '../config/ai-model.config';
import { PROMPT_VERSIONS } from '../ai/prompts/prompts';
@Injectable()
export class GenerateNextStudySessionUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
    private readonly ai: OpenAiGateway,
    private readonly knowledge: KnowledgeBaseService,
    private readonly audio: LocalAudioService,
    private readonly notifier: DiscordNotifier,
    private readonly models: AiModelConfig,
    private readonly config: ConfigService,
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
      stage: 'CLAIMED',
      lastSuccessfulStage: 'CLAIMED',
      summary: topic.summary,
      notificationStatus: 'NOT_PENDING',
      createdAt: new Date().toISOString(),
      generationModel: this.models.content,
      ttsModel: this.models.tts,
      contentPromptVersion: PROMPT_VERSIONS.content,
      podcastPromptVersion: PROMPT_VERSIONS.script,
    };
    await this.sessions.createSession(session);
    return this.runRemainingStages(session, topic);
  }
  async retry(sessionId: string): Promise<StudySession> {
    const session = await this.sessions.findSessionById(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.stage !== 'FAILED' && session.notificationStatus !== 'FAILED') return session;
    const topic = await this.topics.findTopicById(session.topicId);
    if (!topic) throw new Error('Session topic not found');
    session.failureMessage = undefined;
    topic.status = 'GENERATING';
    return this.runRemainingStages(session, topic);
  }
  private async runRemainingStages(
    session: StudySession,
    topic: StudyPlanTopic,
  ): Promise<StudySession> {
    try {
      if (!session.content) {
        const context = await this.knowledge.retrieve(topic.tags);
        session.content = await this.ai.generateContent(topic, context);
        session.stage = session.lastSuccessfulStage = 'CONTENT_READY';
        await this.sessions.updateSession(session);
      }
      if (!session.script) {
        session.script = await this.ai.generateScript(
          topic,
          session.content,
          this.config.get<number>('PODCAST_TARGET_MINUTES', 30),
        );
        session.stage = session.lastSuccessfulStage = 'SCRIPT_READY';
        await this.sessions.updateSession(session);
      }
      if (!session.audioUrl) {
        const destination = this.audio.destination(session.id);
        await this.ai.generateSpeech(session.script, destination);
        session.audioPath = destination;
        session.audioUrl = this.audio.publicUrl(session.id);
        session.stage = session.lastSuccessfulStage = 'AUDIO_READY';
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
      session.stage = 'FAILED';
      session.failureMessage = error instanceof Error ? error.message : 'Unknown generation error';
      topic.status = 'FAILED';
      await this.sessions.updateSession(session);
      await this.topics.update(topic);
      throw error;
    }
  }
}
