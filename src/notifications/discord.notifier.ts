import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { LocalAudioService } from '../audio/local-audio.service';
import { StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';

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
  phase?: 'CREATING' | 'GENERATING';
  error: unknown;
}

@Injectable()
export class DiscordNotifier {
  constructor(
    private readonly config: ConfigService,
    private readonly localAudio: LocalAudioService,
  ) {}

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
    await this.sendContent(this.buildFailureMessage(context));
  }

  async notifyProcessingError(context: ProcessingFailureContext): Promise<void> {
    await this.sendContent(this.buildProcessingErrorMessage(context));
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
    const url = new URL('/', `${this.publicBaseUrl()}/`);
    url.searchParams.set('plan', planId);
    if (sessionId) url.searchParams.set('session', sessionId);
    return url.toString();
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

    return (
      `🎧 **New Backend Study Session Ready**\n\n` +
      `**${session.title}**\n` +
      `Week ${String(topic.week).padStart(2, '0')} · Session ${String(topic.sequence).padStart(2, '0')}\n\n` +
      `📖 Read: ${session.notionUrl}` +
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
    await this.sendContent(this.buildMessage(session, topic, options));
  }

  private async sendContent(content: string): Promise<void> {
    const response = await fetch(this.config.getOrThrow<string>('DISCORD_WEBHOOK_URL'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: this.truncateDiscordContent(content) }),
    });
    if (!response.ok) throw new Error(`Discord webhook returned ${response.status}`);
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

    const response = await fetch(this.config.getOrThrow<string>('DISCORD_WEBHOOK_URL'), {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error(`Discord webhook returned ${response.status}`);
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
}
