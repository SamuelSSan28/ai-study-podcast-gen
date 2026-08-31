import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SESSION_REPOSITORY, StudySessionRepository } from '../application/ports';
import { StudySession } from '../domain/models';
import { QueueService } from '../queue/queue.service';
import { AsyncJobResponse } from '../study-plans/dto';

@Controller('sessions')
export class StudySessionsController {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: StudySessionRepository,
    private readonly queue: QueueService,
  ) {}

  @Get(':id')
  findOne(@Param('id') id: string): Promise<StudySession | null> {
    return this.sessions.findSessionById(id);
  }

  @Post(':id/retry')
  @HttpCode(202)
  async retry(@Param('id') id: string): Promise<AsyncJobResponse> {
    const jobId = await this.queue.enqueueRetrySession(id);
    return { status: 'QUEUED', jobId, planId: '', sessionId: id };
  }
}
