import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query } from '@nestjs/common';
import { GenerateStudyPlanUseCase } from '../application/generate-study-plan.use-case';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import { Inject } from '@nestjs/common';
import {
  PLAN_REPOSITORY,
  SESSION_REPOSITORY,
  StudyPlanRepository,
  StudySessionRepository,
} from '../application/ports';
import { GenerateStudyPlanDto } from './dto';
import { PodcastMode, StudyPlan, StudySession } from '../domain/models';
enum PodcastModeParam {
  INTERVIEW = 'INTERVIEW',
  DISCUSSION = 'DISCUSSION',
}
@Controller('study-plans')
export class StudyPlansController {
  constructor(
    private readonly generatePlan: GenerateStudyPlanUseCase,
    private readonly generateNext: GenerateNextStudySessionUseCase,
    @Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
  ) {}
  @Post() async create(@Body() dto: GenerateStudyPlanDto): Promise<StudyPlan> {
    const plan = await this.generatePlan.execute(dto);
    await this.generateNext.execute(plan.id);
    return plan;
  }
  @Get() findAll(): Promise<StudyPlan[]> {
    return this.plans.findAll();
  }
  @Get(':id') findOne(@Param('id') id: string): Promise<StudyPlan | null> {
    return this.plans.findById(id);
  }
  @Post(':id/generate-next') next(
    @Param('id') id: string,
    @Query('mode', new ParseEnumPipe(PodcastModeParam, { optional: true })) mode?: PodcastMode,
  ): Promise<StudySession> {
    return this.generateNext.execute(id, mode);
  }
  @Get(':id/sessions') findSessions(@Param('id') id: string): Promise<StudySession[]> {
    return this.sessions.findByPlan(id);
  }
}
