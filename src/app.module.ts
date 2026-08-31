import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'node:path';
import { validateEnvironment } from './config/env.schema';
import { AiModelConfig } from './config/ai-model.config';
import { GenerationTokenGuard } from './common/auth/generation-token.guard';
import { LocalAudioService } from './audio/local-audio.service';
import { AudioController } from './audio/audio.controller';
import { OpenAiGateway } from './ai/openai.gateway';
import { PLAN_REPOSITORY, SESSION_REPOSITORY, TOPIC_REPOSITORY } from './application/ports';
import { GenerateStudyPlanUseCase } from './application/generate-study-plan.use-case';
import { CreateStudyPlanUseCase } from './application/create-study-plan.use-case';
import { GetStudyPlanStatusUseCase } from './application/get-study-plan-status.use-case';
import { ArchiveStudyPlanUseCase } from './application/archive-study-plan.use-case';
import { MarkTopicStudiedUseCase } from './application/mark-topic-studied.use-case';
import { GenerateNextStudySessionUseCase } from './application/generate-next-session.use-case';
import { DiscordNotifier } from './notifications/discord.notifier';
import { StudyPlansController } from './study-plans/study-plans.controller';
import { StudySessionsController } from './study-sessions/study-sessions.controller';
import { PodcastScheduler } from './scheduler/podcast.scheduler';
import { LocalProgressCron } from './scheduler/local-progress.cron';
import { GoogleDriveAudioStorage } from './audio/google-drive-audio.storage';
import { LocalAudioStorage } from './audio/local-audio.storage';
import { AUDIO_STORAGE } from './application/ports';
import { OpenAiConversationPlanner } from './conversation/conversation-planner';
import { OpenAiPodcastScriptGenerator } from './conversation/podcast-script-generator';
import { OpenAiDialoguePolisher } from './conversation/dialogue-polisher';
import { PodcastScriptValidator } from './conversation/podcast-script.validator';
import { ConfigurableAudioDirector } from './audio/audio-director';
import { TurnBasedTtsService } from './audio/turn-based-tts.service';
import { FfmpegAudioComposer } from './audio/audio-composer';
import { ProgressStudyPlanUseCase } from './application/progress-study-plan.use-case';
import { RunTraceService } from './observability/run-trace.service';
import { PrismaService } from './persistence/prisma.service';
import { SqliteRepository } from './persistence/sqlite.repository';
import { NotionContentPublisher } from './persistence/notion-content.publisher';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web'),
      exclude: ['/study-plans*', '/sessions*', '/audio*'],
    }),
    QueueModule,
  ],
  controllers: [StudyPlansController, StudySessionsController, AudioController],
  providers: [
    AiModelConfig,
    { provide: APP_GUARD, useClass: GenerationTokenGuard },
    LocalAudioService,
    GoogleDriveAudioStorage,
    LocalAudioStorage,
    {
      provide: AUDIO_STORAGE,
      useFactory: (
        config: ConfigService,
        localStorage: LocalAudioStorage,
        driveStorage: GoogleDriveAudioStorage,
      ) =>
        config.get('AUDIO_STORAGE_BACKEND', 'local') === 'google_drive'
          ? driveStorage
          : localStorage,
      inject: [ConfigService, LocalAudioStorage, GoogleDriveAudioStorage],
    },
    PrismaService,
    SqliteRepository,
    NotionContentPublisher,
    { provide: PLAN_REPOSITORY, useExisting: SqliteRepository },
    { provide: TOPIC_REPOSITORY, useExisting: SqliteRepository },
    { provide: SESSION_REPOSITORY, useExisting: SqliteRepository },
    GenerateStudyPlanUseCase,
    CreateStudyPlanUseCase,
    GetStudyPlanStatusUseCase,
    ArchiveStudyPlanUseCase,
    MarkTopicStudiedUseCase,
    GenerateNextStudySessionUseCase,
    ProgressStudyPlanUseCase,
    DiscordNotifier,
    PodcastScheduler,
    LocalProgressCron,
    RunTraceService,
  ],
})
export class AppModule {}
