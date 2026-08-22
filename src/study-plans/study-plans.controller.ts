import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GenerationTokenGuard } from '../common/auth/generation-token.guard';
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
import { PodcastMode } from '../domain/models';
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
  @Post('generate') @UseGuards(GenerationTokenGuard) create(@Body() dto: GenerateStudyPlanDto) {
    return this.generatePlan.execute(dto);
  }
  @Get() findAll() {
    return this.plans.findAll();
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.plans.findById(id);
  }
  @Post(':id/generate-next') @UseGuards(GenerationTokenGuard) next(
    @Param('id') id: string,
    @Query('mode', new ParseEnumPipe(PodcastModeParam, { optional: true })) mode?: PodcastMode,
  ) {
    return this.generateNext.execute(id, mode);
  }
  @Get(':id/sessions') findSessions(@Param('id') id: string) {
    return this.sessions.findByPlan(id);
  }
}
