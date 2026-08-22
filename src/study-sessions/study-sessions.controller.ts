import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SESSION_REPOSITORY, StudySessionRepository } from '../application/ports';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import { GenerationTokenGuard } from '../common/auth/generation-token.guard';
@Controller('sessions')
export class StudySessionsController {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
    private readonly generator: GenerateNextStudySessionUseCase,
  ) {}
  @Get(':id') findOne(@Param('id') id: string) {
    return this.sessions.findSessionById(id);
  }
  @Post(':id/retry') @UseGuards(GenerationTokenGuard) retry(@Param('id') id: string) {
    return this.generator.retry(id);
  }
}
