import { Injectable } from '@nestjs/common';
import {
  StudyPlanRepository,
  StudySessionRepository,
  StudyTopicRepository,
} from '../application/ports';
import { StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import { goalsMatch } from '../domain/idempotency';
import { PrismaService } from './prisma.service';
import {
  planFromRow,
  planToRow,
  sessionFromRow,
  sessionToRow,
  topicFromRow,
  topicToRow,
} from './sqlite.mappers';

@Injectable()
export class SqliteRepository
  implements StudyPlanRepository, StudyTopicRepository, StudySessionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async createPending(plan: StudyPlan): Promise<StudyPlan> {
    await this.prisma.studyPlan.create({ data: planToRow(plan) });
    return plan;
  }

  async finalizePlan(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<StudyPlan> {
    await this.prisma.$transaction([
      this.prisma.studyPlan.update({
        where: { id: plan.id },
        data: planToRow(plan),
      }),
      ...topics.map((topic) =>
        this.prisma.studyPlanTopic.create({ data: topicToRow(topic) }),
      ),
    ]);
    return plan;
  }

  async findAll(): Promise<StudyPlan[]> {
    const rows = await this.prisma.studyPlan.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(planFromRow);
  }

  async findActive(): Promise<StudyPlan[]> {
    const rows = await this.prisma.studyPlan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(planFromRow);
  }

  async findById(id: string): Promise<StudyPlan | null> {
    const row = await this.prisma.studyPlan.findUnique({ where: { id } });
    return row ? planFromRow(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<StudyPlan | null> {
    const row = await this.prisma.studyPlan.findUnique({ where: { idempotencyKey: key } });
    return row ? planFromRow(row) : null;
  }

  async findActiveByGoal(goal: string): Promise<StudyPlan | null> {
    const rows = await this.prisma.studyPlan.findMany({ where: { status: 'ACTIVE' } });
    return rows.map(planFromRow).find((plan) => goalsMatch(plan.goal, goal)) ?? null;
  }

  async findInFlightByGoal(goal: string): Promise<StudyPlan | null> {
    const rows = await this.prisma.studyPlan.findMany({
      where: { provisioningStatus: { in: ['CREATING', 'GENERATING'] } },
    });
    return rows.map(planFromRow).find((plan) => goalsMatch(plan.goal, goal)) ?? null;
  }

  async updatePlan(plan: StudyPlan): Promise<void> {
    await this.prisma.studyPlan.update({
      where: { id: plan.id },
      data: planToRow(plan),
    });
  }

  async archivePlan(id: string): Promise<void> {
    await this.prisma.studyPlan.delete({ where: { id } });
  }

  async findTopicById(id: string): Promise<StudyPlanTopic | null> {
    const row = await this.prisma.studyPlanTopic.findUnique({ where: { id } });
    return row ? topicFromRow(row) : null;
  }

  async findTopicsByPlan(planId: string): Promise<StudyPlanTopic[]> {
    const rows = await this.prisma.studyPlanTopic.findMany({
      where: { studyPlanId: planId },
      orderBy: [{ week: 'asc' }, { sequence: 'asc' }],
    });
    return rows.map(topicFromRow);
  }

  async findPlanned(planId: string): Promise<StudyPlanTopic[]> {
    const rows = await this.prisma.studyPlanTopic.findMany({
      where: { studyPlanId: planId, status: 'PLANNED' },
      orderBy: [{ week: 'asc' }, { sequence: 'asc' }],
    });
    return rows.map(topicFromRow);
  }

  async findReady(planId: string): Promise<StudyPlanTopic[]> {
    const rows = await this.prisma.studyPlanTopic.findMany({
      where: { studyPlanId: planId, status: 'READY' },
      orderBy: { order: 'asc' },
    });
    return rows.map(topicFromRow);
  }

  async findCompleted(planId: string): Promise<StudyPlanTopic[]> {
    const rows = await this.prisma.studyPlanTopic.findMany({
      where: { studyPlanId: planId, status: 'COMPLETED' },
      orderBy: { order: 'asc' },
    });
    return rows.map(topicFromRow);
  }

  async update(topic: StudyPlanTopic): Promise<void> {
    await this.prisma.studyPlanTopic.update({
      where: { id: topic.id },
      data: topicToRow(topic),
    });
  }

  async createSession(session: StudySession): Promise<StudySession> {
    await this.prisma.studySession.create({ data: sessionToRow(session) });
    return session;
  }

  async findSessionById(id: string): Promise<StudySession | null> {
    const row = await this.prisma.studySession.findUnique({ where: { id } });
    return row ? sessionFromRow(row) : null;
  }

  async findByGenerationKey(key: string): Promise<StudySession | null> {
    const row = await this.prisma.studySession.findUnique({ where: { generationKey: key } });
    return row ? sessionFromRow(row) : null;
  }

  async findByPlan(planId: string): Promise<StudySession[]> {
    const rows = await this.prisma.studySession.findMany({
      where: { studyPlanId: planId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(sessionFromRow);
  }

  async updateSession(session: StudySession): Promise<void> {
    await this.prisma.studySession.update({
      where: { id: session.id },
      data: sessionToRow(session),
    });
  }
}
