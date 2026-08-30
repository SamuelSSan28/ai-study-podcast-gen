import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { validateEnvironment } from './config/env.schema';
import { AiModelConfig } from './config/ai-model.config';
import { GenerationTokenGuard } from './common/auth/generation-token.guard';
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
import { OpenAiConversationPlanner } from './conversation/conversation-planner';
import { OpenAiPodcastScriptGenerator } from './conversation/podcast-script-generator';
import { OpenAiDialoguePolisher } from './conversation/dialogue-polisher';
import { PodcastScriptValidator } from './conversation/podcast-script.validator';
import { ConfigurableAudioDirector } from './audio/audio-director';
import { TurnBasedTtsService } from './audio/turn-based-tts.service';
import { FfmpegAudioComposer } from './audio/audio-composer';
import { ProgressStudyPlanUseCase } from './application/progress-study-plan.use-case';
import { RunTraceService } from './observability/run-trace.service';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ScheduleModule.forRoot(),
  ],
  controllers: [StudyPlansController, StudySessionsController, AudioController],
  providers: [
    AiModelConfig,
    { provide: APP_GUARD, useClass: GenerationTokenGuard },
    LocalAudioService,
    GoogleDriveAudioStorage,
    { provide: AUDIO_STORAGE, useExisting: GoogleDriveAudioStorage },
    OpenAiGateway,
    OpenAiConversationPlanner,
    OpenAiPodcastScriptGenerator,
    OpenAiDialoguePolisher,
    PodcastScriptValidator,
    ConfigurableAudioDirector,
    TurnBasedTtsService,
    FfmpegAudioComposer,
    NotionRepository,
    { provide: PLAN_REPOSITORY, useExisting: NotionRepository },
    { provide: TOPIC_REPOSITORY, useExisting: NotionRepository },
    { provide: SESSION_REPOSITORY, useExisting: NotionRepository },
    GenerateStudyPlanUseCase,
    GenerateNextStudySessionUseCase,
    ProgressStudyPlanUseCase,
    DiscordNotifier,
    PodcastScheduler,
    RunTraceService,
  ],
})
export class AppModule {}
