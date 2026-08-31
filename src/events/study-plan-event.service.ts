import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { DiscordNotifier } from '../notifications/discord.notifier';
import { PublishStudyPlanEvent, StudyPlanEvent } from './study-plan-event.types';

@Injectable()
export class StudyPlanEventService {
  private readonly logger = new Logger(StudyPlanEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: DiscordNotifier,
  ) {}

  async publish(input: PublishStudyPlanEvent): Promise<StudyPlanEvent> {
    const event = this.normalize(input);
    await this.prisma.studyPlanEvent.create({
      data: {
        ...event,
        result: event.result ? JSON.stringify(event.result) : null,
        error: event.error ? JSON.stringify(event.error) : null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        createdAt: new Date(event.createdAt),
      },
    });
    try {
      await this.notifier.notifyEvent(event);
    } catch {
      this.logger.warn(`Event ${event.id} persisted but notification delivery failed`);
    }
    return event;
  }

  async findByPlan(planId: string): Promise<StudyPlanEvent[]> {
    const rows = await this.prisma.studyPlanEvent.findMany({
      where: { planId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      ...row,
      type: row.type as StudyPlanEvent['type'],
      status: row.status as StudyPlanEvent['status'],
      severity: row.severity as StudyPlanEvent['severity'],
      result: row.result ? this.parseJson<Record<string, unknown>>(row.result) : undefined,
      error: row.error ? this.parseJson<StudyPlanEvent['error']>(row.error) : undefined,
      metadata: row.metadata ? this.parseJson<Record<string, unknown>>(row.metadata) : undefined,
      stage: row.stage ?? undefined,
      topicId: row.topicId ?? undefined,
      sessionId: row.sessionId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private normalize(input: PublishStudyPlanEvent): StudyPlanEvent {
    const error = input.error instanceof Error
      ? { name: input.error.name, message: input.error.message, stack: input.error.stack }
      : input.error === undefined ? undefined : { message: this.errorMessage(input.error) };
    return {
      ...input,
      id: randomUUID(),
      severity: input.severity ?? (input.status === 'FAILED' ? 'ERROR' : input.status === 'WARNING' || input.status === 'SKIPPED' ? 'WARNING' : 'INFO'),
      error,
      createdAt: new Date().toISOString(),
    };
  }

  private parseJson<T>(value: string): T {
    return JSON.parse(value) as T;
  }

  private errorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
      return String(error);
    }
    return 'Unknown generation error';
  }
}
