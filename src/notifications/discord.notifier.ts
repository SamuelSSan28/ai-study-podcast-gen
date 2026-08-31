import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { LocalAudioService } from '../audio/local-audio.service';
import { PodcastMode, StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import { AppUrlBuilder } from '../events/app-url.builder';
import { StudyPlanEvent } from '../events/study-plan-event.types';

const DEFAULT_DISCORD_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const DISCORD_CONTENT_LIMIT = 2000;

export interface SessionFailureContext {
  session: StudySession;
  topic: StudyPlanTopic;
  plan: StudyPlan;
  error: unknown;
}

export interface ProcessingFailureContext {
  plan?: StudyPlan;
  planId?: string;
  operation: string;
  phase?: 'CREATING' | 'GENERATING' | 'NOTION_PUBLISH';
  error: unknown;
}

@Injectable()
export class DiscordNotifier {
  private readonly logger = new Logger(DiscordNotifier.name);

  constructor(
    private readonly config: ConfigService,
    private readonly localAudio: LocalAudioService,
    private readonly urls: AppUrlBuilder,
  ) {}

  async notifyEvent(event: StudyPlanEvent): Promise<void> {
    const normal = ['PLAN_CREATED', 'PLAN_READY', 'TOPIC_READY', 'SESSION_READY'];
    const operational = ['RETRY_SCHEDULED', 'SESSION_SKIPPED', 'GENERATION_FAILED'];
    if (!normal.includes(event.type) && !operational.includes(event.type)) return;

    const title = this.displayValue(event.metadata?.planTitle, 'Study plan');
    const topic = event.metadata?.topicTitle
      ? this.displayValue(event.metadata.topicTitle)
      : undefined;
    const destination = event.topicId
      ? this.urls.topic(event.planId, event.topicId)
      : event.sessionId
        ? this.urls.session(event.planId, event.sessionId)
        : this.urls.plan(event.planId);
    const heading: Record<string, string> = {
      PLAN_CREATED: '📚 **Study plan created**',
      PLAN_READY: '🎉 **Study plan ready**',
      TOPIC_READY: '📖 **New topic ready**',
      SESSION_READY: '📖 **New lesson ready**',
      RETRY_SCHEDULED: '🔁 **Generation retry**',
      SESSION_SKIPPED: '⏭️ **Session generation skipped**',
      GENERATION_FAILED: '❌ **Generation failed**',
    };
    const lines = [heading[event.type], '', `**${topic ?? title}**`];
    if (topic) lines.push(`Plan: ${title}`);
    if (event.stage) lines.push(`Stage: ${event.stage}`);
    if (event.type === 'PLAN_CREATED') lines.push('Status: Preparing curriculum');
    if (event.type === 'PLAN_READY') lines.push('Curriculum created. Your first lesson is ready to consume.');
    if (event.result) {
      for (const [key, value] of Object.entries(event.result)) {
        lines.push(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}: ${String(value)}`);
      }
    }
    if (event.error?.message) lines.push('', `Reason: ${event.error.message}`);
    lines.push('', `📊 Open ${event.topicId || event.sessionId ? 'lesson' : 'plan'}: ${destination}`);
    const message = lines.join('\n');
    if (operational.includes(event.type)) await this.sendError(message);
    else await this.sendSuccess(message);
  }

  async notify(session: StudySession, topic: StudyPlanTopic): Promise<void> {
    const maxBytes = this.config.get<number>(
      'DISCORD_MAX_ATTACHMENT_BYTES',
      DEFAULT_DISCORD_MAX_ATTACHMENT_BYTES,
    );
    const audioPath = session.audioPath;
    if (audioPath) {
      const size = (await stat(audioPath)).size;
      if (size <= maxBytes) {
        await this.sendWithAttachment(session, topic, audioPath, size);
        return;
      }
      await this.sendText(session, topic, {
        localOnly: true,
        fileSizeBytes: size,
        maxBytes,
      });
      return;
    }
    await this.sendText(session, topic);
  }

  async notifyFailure(context: SessionFailureContext): Promise<void> {
    await this.sendError(this.buildFailureMessage(context));
  }

  async notifyProcessingError(context: ProcessingFailureContext): Promise<void> {
    await this.sendError(this.buildProcessingErrorMessage(context));
  }

  async notifyPlanStarted(plan: StudyPlan): Promise<void> {
    await this.sendSuccess(
      [
        '📚 **Study plan started**',
        '',
        `**${plan.title}**`,
        `Goal: ${plan.goal}`,
        `📊 Dashboard: ${this.dashboardUrl(plan.id)}`,
      ].join('\n'),
    );
  }

  async notifyPlanProvisioning(plan: StudyPlan, phase: 'CREATING' | 'GENERATING'): Promise<void> {
    const label = phase === 'CREATING' ? 'Generating curriculum' : 'Generating first episode';
    await this.sendSuccess(
      [
        '⚙️ **Study plan provisioning**',
        '',
        `**${plan.title}**`,
        `Phase: ${label}`,
        `📊 Dashboard: ${this.dashboardUrl(plan.id)}`,
      ].join('\n'),
    );
  }

  async notifyPlanCurriculumReady(plan: StudyPlan, topicCount: number): Promise<void> {
    await this.sendSuccess(
      [
        '✅ **Curriculum ready**',
        '',
        `**${plan.title}**`,
        `${topicCount} topics`,
        `📊 Dashboard: ${this.dashboardUrl(plan.id)}`,
      ].join('\n'),
    );
  }

  async notifyPlanReady(plan: StudyPlan): Promise<void> {
    await this.sendSuccess(
      [
        '🎉 **Study plan ready**',
        '',
        `**${plan.title}**`,
        'First episode completed — provisioning finished.',
        plan.notionUrl ? `📖 Notion: ${plan.notionUrl}` : '',
        `📊 Dashboard: ${this.dashboardUrl(plan.id)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  async notifyPlanRetry(plan: StudyPlan): Promise<void> {
    await this.sendSuccess(
      [
        '🔁 **Study plan retry queued**',
        '',
        `**${plan.title}**`,
        `📊 Dashboard: ${this.dashboardUrl(plan.id)}`,
      ].join('\n'),
    );
  }

  async notifySessionGenerationSkipped(plan: StudyPlan, waitingTopicCount: number): Promise<void> {
    await this.sendSuccess(
      [
        '⏭️ **Session generation skipped**',
        '',
        `**${plan.title}**`,
        `No completed topics yet — waiting for prerequisites before generating the next episode.`,
        waitingTopicCount > 0 ? `${waitingTopicCount} roadmap topics are blocked.` : '',
        `📊 Dashboard: ${this.dashboardUrl(plan.id)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  async notifyTopicStarted(
    plan: StudyPlan,
    topic: StudyPlanTopic,
    mode: PodcastMode,
  ): Promise<void> {
    const objectives =
      topic.learningObjectives.length > 0
        ? `\nObjectives: ${topic.learningObjectives.slice(0, 3).join(' · ')}`
        : '';
    await this.sendSuccess(
      [
        `▶️ **Generating topic** (#${topic.order})`,
        '',
        `**${topic.title}**`,
        `Plan: ${plan.title} · ${mode}${objectives}`,
        `📊 Dashboard: ${this.dashboardUrl(plan.id)}`,
      ].join('\n'),
    );
  }

  private buildFailureMessage(context: SessionFailureContext): string {
    const { session, topic, plan, error } = context;
    const { message, stack } = this.extractError(error);
    const baseUrl = this.publicBaseUrl();
    const failedTts = session.audioSegments?.filter((segment) => segment.status === 'FAILED') ?? [];

    const lines = [
      '🚨 **Session Generation Failed**',
      '',
      `**${session.title}**`,
      `Week ${String(topic.week).padStart(2, '0')} · Session ${String(topic.sequence).padStart(2, '0')} · ${session.podcastMode}`,
      '',
      `**Plan:** ${plan.title}`,
      `**Failed at:** ${session.failedStage ?? session.stage}`,
      `**Last OK stage:** ${session.lastSuccessfulStage}`,
      `**Retry count:** ${session.retryCount}`,
      '',
      '**Error**',
      '```',
      message,
      '```',
    ];

    if (stack) {
      lines.push('', '**Stack (tail)**', '```', stack, '```');
    }
    if (failedTts.length) {
      lines.push(
        '',
        '**TTS segment failures**',
        failedTts
          .slice(0, 5)
          .map((segment) => `#${segment.sequence}: ${segment.lastError ?? 'unknown error'}`)
          .join('\n'),
      );
      if (failedTts.length > 5) lines.push(`…and ${failedTts.length - 5} more`);
    }

    if (session.notionUrl) lines.push('', `📖 Notion: ${session.notionUrl}`);
    else if (topic.notionUrl) lines.push('', `📖 Notion: ${topic.notionUrl}`);
    lines.push(
      '',
      `📊 Dashboard: ${this.dashboardUrl(plan.id, session.id)}`,
      `🔁 Retry: POST ${baseUrl}/sessions/${session.id}/retry?token=<token>`,
    );
    if (topic.tags.length) lines.push('', `**Tags:** ${topic.tags.join(' · ')}`);
    if (topic.summary) lines.push('', `**Summary:** ${topic.summary}`);

    return this.truncateDiscordContent(lines.join('\n'));
  }

  private buildProcessingErrorMessage(context: ProcessingFailureContext): string {
    const { message, stack } = this.extractError(context.error);
    const baseUrl = this.publicBaseUrl();
    const planId = context.plan?.id ?? context.planId;
    const phaseLabel =
      context.phase === 'CREATING'
        ? 'Generating curriculum'
        : context.phase === 'GENERATING'
          ? 'Generating first episode'
          : context.phase === 'NOTION_PUBLISH'
            ? 'Notion publish'
            : undefined;

    const lines = ['🚨 **Plan Provisioning Failed**', ''];
    if (context.plan) {
      lines.push(`**Plan:** ${context.plan.title}`);
    }
    if (planId) {
      lines.push(`📊 Dashboard: ${this.dashboardUrl(planId)}`);
    }
    if (phaseLabel) {
      lines.push(`**Phase:** ${phaseLabel}`);
    }
    lines.push(`**Operation:** ${context.operation}`, '', '**Error**', '```', message, '```');
    if (stack) lines.push('', '**Stack (tail)**', '```', stack, '```');
    if (planId) {
      lines.push('', `🔁 Retry: POST ${baseUrl}/study-plans/${planId}/retry?token=<token>`);
    }
    return this.truncateDiscordContent(lines.join('\n'));
  }

  private publicBaseUrl(): string {
    return (
      this.config.get<string>('DASHBOARD_PUBLIC_BASE_URL')?.replace(/\/$/, '') ??
      `http://localhost:${this.config.get<number>('PORT', 3000)}`
    );
  }

  private dashboardUrl(planId: string, sessionId?: string): string {
    return sessionId ? this.urls.session(planId, sessionId) : this.urls.plan(planId);
  }

  private buildMessage(
    session: StudySession,
    topic: StudyPlanTopic,
    options?: { localOnly?: boolean; fileSizeBytes?: number; maxBytes?: number },
  ): string {
    const listenUrl = session.audioUrl ?? this.localAudio.publicUrl(session.id);
    const localNotice =
      options?.localOnly && options.fileSizeBytes !== undefined && options.maxBytes !== undefined
        ? `\n\n⚠️ Audio (${this.formatMegabytes(options.fileSizeBytes)} MB) exceeds the Discord limit (${this.formatMegabytes(options.maxBytes)} MB).\n` +
          `Saved locally only: ${listenUrl}`
        : '';
    const listenLine =
      options?.localOnly || !session.audioUrl
        ? ''
        : `\n🎙 Listen: ${session.audioUrl}${session.audioDownloadUrl ? `\n⬇️ Download: ${session.audioDownloadUrl}` : ''}`;

    const readUrl = topic.notionUrl ?? session.notionUrl;
    return (
      `🎧 **New Backend Study Session Ready**\n\n` +
      `**${session.title}**\n` +
      `Week ${String(topic.week).padStart(2, '0')} · Session ${String(topic.sequence).padStart(2, '0')}\n\n` +
      (readUrl ? `📖 Read: ${readUrl}` : '') +
      listenLine +
      localNotice +
      `\n\nFocus: ${topic.tags.join(' · ')}`
    );
  }

  private async sendText(
    session: StudySession,
    topic: StudyPlanTopic,
    options?: { localOnly?: boolean; fileSizeBytes?: number; maxBytes?: number },
  ): Promise<void> {
    await this.sendSuccess(this.buildMessage(session, topic, options));
  }

  private async sendSuccess(content: string): Promise<void> {
    await this.postWebhook(this.config.getOrThrow<string>('DISCORD_WEBHOOK_URL'), content);
  }

  private async sendError(content: string): Promise<void> {
    await this.postWebhook(this.config.getOrThrow<string>('DISCORD_WEBHOOK_ERRORS_URL'), content);
  }

  private async postWebhook(url: string, content: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: this.truncateDiscordContent(content) }),
      });
      if (!response.ok) {
        throw new Error(`Discord webhook returned ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Discord notification failed: ${message}`);
      throw error;
    }
  }

  private async sendWithAttachment(
    session: StudySession,
    topic: StudyPlanTopic,
    audioPath: string,
    fileSizeBytes: number,
  ): Promise<void> {
    const filename = path.basename(audioPath) || `${session.id}.mp3`;
    const audio = await readFile(audioPath);
    const form = new FormData();
    form.append(
      'payload_json',
      JSON.stringify({
        content: this.truncateDiscordContent(
          this.buildMessage(session, topic) +
            `\n\n🎙 Audio attached (${this.formatMegabytes(fileSizeBytes)} MB)`,
        ),
      }),
    );
    form.append('files[0]', new Blob([audio], { type: 'audio/mpeg' }), filename);

    try {
      const response = await fetch(this.config.getOrThrow<string>('DISCORD_WEBHOOK_URL'), {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new Error(`Discord webhook returned ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Discord attachment notification failed: ${message}`);
      throw error;
    }
  }

  private extractError(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      const stack = error.stack
        ?.split('\n')
        .slice(-6)
        .join('\n')
        .trim();
      return { message: error.message, stack: stack || undefined };
    }
    return { message: String(error) };
  }

  private truncateDiscordContent(content: string): string {
    if (content.length <= DISCORD_CONTENT_LIMIT) return content;
    const suffix = '\n\n…message truncated (Discord 2000 char limit)';
    return `${content.slice(0, DISCORD_CONTENT_LIMIT - suffix.length)}${suffix}`;
  }

  private formatMegabytes(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(1);
  }

  private displayValue(value: unknown, fallback = ''): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    return fallback;
  }
}
