import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnvironment } from './config/env.schema';
import { AiModelConfig } from './config/ai-model.config';
import { GenerationTokenGuard } from './common/auth/generation-token.guard';
import { KnowledgeBaseService } from './knowledge-base/knowledge-base.service';
import { LocalAudioService } from './audio/local-audio.service';
import { AudioController } from './audio/audio.controller';
import { OpenAiGateway } from './ai/openai.gateway';
import { NotionRepository } from './persistence/notion.repository';
import { PLAN_REPOSITORY, SESSION_REPOSITORY, TOPIC_REPOSITORY } from './application/ports';
import { GenerateStudyPlanUseCase } from './application/generate-study-plan.use-case';
import { GenerateNextStudySessionUseCase } from './application/generate-next-session.use-case';
import { DiscordNotifier } from './notifications/discord.notifier';
import { StudyPlansController } from './study-plans/study-plans.controller';
import { StudySessionsController } from './study-sessions/study-sessions.controller';
import { PodcastScheduler } from './scheduler/podcast.scheduler';
import { GoogleDriveAudioStorage } from './audio/google-drive-audio.storage';
import { AUDIO_STORAGE } from './application/ports';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ScheduleModule.forRoot(),
  ],
  controllers: [StudyPlansController, StudySessionsController, AudioController],
  providers: [
    AiModelConfig,
    GenerationTokenGuard,
    KnowledgeBaseService,
    LocalAudioService,
    GoogleDriveAudioStorage,
    { provide: AUDIO_STORAGE, useExisting: GoogleDriveAudioStorage },
    OpenAiGateway,
    NotionRepository,
    { provide: PLAN_REPOSITORY, useExisting: NotionRepository },
    { provide: TOPIC_REPOSITORY, useExisting: NotionRepository },
    { provide: SESSION_REPOSITORY, useExisting: NotionRepository },
    GenerateStudyPlanUseCase,
    GenerateNextStudySessionUseCase,
    DiscordNotifier,
    PodcastScheduler,
  ],
})
export class AppModule {}
