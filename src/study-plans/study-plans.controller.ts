import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateStudyPlanUseCase } from '../application/create-study-plan.use-case';
import { GetStudyPlanStatusUseCase } from '../application/get-study-plan-status.use-case';
import { RetryStudyPlanUseCase } from '../application/retry-study-plan.use-case';
import { ArchiveStudyPlanUseCase } from '../application/archive-study-plan.use-case';
import { MarkTopicStudiedUseCase } from '../application/mark-topic-studied.use-case';
import {
  PLAN_REPOSITORY,
  SESSION_REPOSITORY,
  TOPIC_REPOSITORY,
  StudyPlanRepository,
  StudySessionRepository,
  StudyTopicRepository,
} from '../application/ports';
import {
  AsyncJobResponse,
  CreateStudyPlanResponse,
  GenerateStudyPlanDto,
  MarkTopicStudiedDto,
  StudyPlanStatusResponse,
} from './dto';
import { PodcastMode, StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import { QueueService } from '../queue/queue.service';

enum PodcastModeParam {
  INTERVIEW = 'INTERVIEW',
  DISCUSSION = 'DISCUSSION',
  EXPLANATION = 'EXPLANATION',
}

@Controller('study-plans')
export class StudyPlansController {
  constructor(
    private readonly createPlan: CreateStudyPlanUseCase,
    private readonly getStatus: GetStudyPlanStatusUseCase,
    private readonly retryPlan: RetryStudyPlanUseCase,
    private readonly archivePlan: ArchiveStudyPlanUseCase,
    private readonly markStudied: MarkTopicStudiedUseCase,
    private readonly queue: QueueService,
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(TOPIC_REPOSITORY) private readonly topics: StudyTopicRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
  ) {}

  @Post()
  async create(
    @Body() dto: GenerateStudyPlanDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateStudyPlanResponse> {
    const result = await this.createPlan.execute({
      title: dto.title,
      goal: dto.goal,
      settings: dto.settings,
      idempotencyKeyHeader: idempotencyKey,
    });

    if (result.kind === 'processing') {
      res.status(200);
      return { id: result.id, status: 'PROCESSING' };
    }

    res.status(202);
    return {
      id: result.plan.id,
      title: result.plan.title,
      goal: result.plan.goal,
      status: 'PROCESSING',
    };
  }

  @Get()
  findAll(): Promise<StudyPlan[]> {
    return this.plans.findAll();
  }

  @Get(':id/status')
  status(@Param('id') id: string): Promise<StudyPlanStatusResponse> {
    return this.getStatus.execute(id);
  }

  @Get(':id/topics')
  findTopics(@Param('id') id: string): Promise<StudyPlanTopic[]> {
    return this.topics.findTopicsByPlan(id);
  }

  @Get(':id/sessions')
  findSessions(@Param('id') id: string): Promise<StudySession[]> {
    return this.sessions.findByPlan(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<StudyPlan | null> {
    return this.plans.findById(id);
  }

  @Post(':id/retry')
  @HttpCode(202)
  async retry(@Param('id') id: string): Promise<AsyncJobResponse> {
    return this.retryPlan.execute(id);
  }

  @Post(':id/generate-next')
  @HttpCode(202)
  async next(
    @Param('id') id: string,
    @Query('mode', new ParseEnumPipe(PodcastModeParam, { optional: true })) mode?: PodcastMode,
  ): Promise<AsyncJobResponse> {
    const jobId = await this.queue.enqueueGenerateSession(id, mode);
    return { status: 'QUEUED', jobId, planId: id };
  }

  @Patch(':planId/topics/:topicId/studied')
  @HttpCode(202)
  async setStudied(
    @Param('planId') planId: string,
    @Param('topicId') topicId: string,
    @Body() dto: MarkTopicStudiedDto,
  ): Promise<{ status: 'QUEUED'; planId: string; topicId: string }> {
    await this.markStudied.execute(planId, topicId, dto.studied ?? true);
    return { status: 'QUEUED', planId, topicId };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.archivePlan.execute(id);
  }
}
