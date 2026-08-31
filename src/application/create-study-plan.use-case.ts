import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PLAN_REPOSITORY, StudyPlanRepository } from './ports';
import { StudyPlan } from '../domain/models';
import { buildIdempotencyKey } from '../domain/idempotency';
import { STUDY_DEFAULTS, StudyPlanSettings } from '../config/study-defaults';
import { QueueService } from '../queue/queue.service';

export type CreateStudyPlanResult =
  | { kind: 'created'; plan: StudyPlan }
  | { kind: 'processing'; id: string };

@Injectable()
export class CreateStudyPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    private readonly queue: QueueService,
  ) {}

  async execute(input: {
    title: string;
    goal: string;
    settings?: StudyPlanSettings;
    idempotencyKeyHeader?: string;
  }): Promise<CreateStudyPlanResult> {
    const key =
      input.idempotencyKeyHeader?.trim() ||
      buildIdempotencyKey(input.title, input.goal);

    const byKey = await this.plans.findByIdempotencyKey(key);
    if (byKey) {
      if (
        byKey.provisioningStatus === 'CREATING' ||
        byKey.provisioningStatus === 'GENERATING' ||
        byKey.provisioningStatus === 'READY' ||
        byKey.status === 'ACTIVE'
      ) {
        return { kind: 'processing', id: byKey.id };
      }
      if (byKey.provisioningStatus === 'FAILED') {
        byKey.provisioningStatus = 'CREATING';
        byKey.provisioningError = undefined;
        await this.plans.updatePlan(byKey);
        await this.queue.enqueuePlanGeneration(byKey.id);
        return { kind: 'created', plan: byKey };
      }
    }

    const inFlight = await this.plans.findInFlightByGoal(input.goal);
    if (inFlight) return { kind: 'processing', id: inFlight.id };

    const active = await this.plans.findActiveByGoal(input.goal);
    if (active) return { kind: 'processing', id: active.id };

    const targetSessionMinutes =
      input.settings?.targetSessionMinutes ?? STUDY_DEFAULTS.session.targetMinutes;
    const start = new Date();
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + STUDY_DEFAULTS.curriculum.durationWeeks * 7 - 1);

    const plan: StudyPlan = {
      id: randomUUID(),
      title: input.title,
      goal: input.goal,
      level: 'adaptive',
      durationWeeks: STUDY_DEFAULTS.curriculum.durationWeeks,
      sessionsPerWeek: STUDY_DEFAULTS.schedule.sessionsPerWeek,
      preferredDays: [...STUDY_DEFAULTS.schedule.days],
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      status: 'DRAFT',
      provisioningStatus: 'CREATING',
      idempotencyKey: key,
      overview: '',
      createdAt: new Date().toISOString(),
      targetSessionMinutes,
    };

    const pending = await this.plans.createPending(plan);
    await this.queue.enqueueNotionPlanPending(pending.id);
    await this.queue.enqueuePlanGeneration(pending.id);
    return { kind: 'created', plan: pending };
  }
}
