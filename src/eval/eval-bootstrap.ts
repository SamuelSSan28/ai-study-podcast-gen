import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../config/env.schema';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import { OpenAiGateway } from '../ai/openai.gateway';
import { AiModelConfig } from '../config/ai-model.config';
import { LocalAudioService } from '../audio/local-audio.service';
import { DiscordNotifier } from '../notifications/discord.notifier';
import { OpenAiConversationPlanner } from '../conversation/conversation-planner';
import { OpenAiPodcastScriptGenerator } from '../conversation/podcast-script-generator';
import { OpenAiDialoguePolisher } from '../conversation/dialogue-polisher';
import { PodcastScriptValidator } from '../conversation/podcast-script.validator';
import { ConfigurableAudioDirector } from '../audio/audio-director';
import { TurnBasedTtsService } from '../audio/turn-based-tts.service';
import { FfmpegAudioComposer } from '../audio/audio-composer';
import { RunTraceService } from '../observability/run-trace.service';
import { EvalConfig } from '../observability/eval-config';
import { AUDIO_STORAGE, PLAN_REPOSITORY, SESSION_REPOSITORY, TOPIC_REPOSITORY } from '../application/ports';
import { EvalAudioStorage, InMemoryStudyRepository } from './memory.repository';

export async function createEvalModule(
  evalConfig: EvalConfig,
  repo: InMemoryStudyRepository,
): Promise<TestingModule> {
  const trace = new RunTraceService(evalConfig);
  return Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
    providers: [
      AiModelConfig,
      { provide: RunTraceService, useValue: trace },
      LocalAudioService,
      EvalAudioStorage,
      { provide: AUDIO_STORAGE, useExisting: EvalAudioStorage },
      { provide: PLAN_REPOSITORY, useValue: repo },
      { provide: TOPIC_REPOSITORY, useValue: repo },
      { provide: SESSION_REPOSITORY, useValue: repo },
      OpenAiGateway,
      OpenAiConversationPlanner,
      OpenAiPodcastScriptGenerator,
      OpenAiDialoguePolisher,
      PodcastScriptValidator,
      ConfigurableAudioDirector,
      TurnBasedTtsService,
      FfmpegAudioComposer,
      DiscordNotifier,
      GenerateNextStudySessionUseCase,
    ],
  }).compile();
}
