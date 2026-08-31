import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import {
  NOTION_QUEUE,
  QueueService,
  STUDY_PLANS_QUEUE,
  STUDY_PROGRESS_QUEUE,
  STUDY_SESSIONS_QUEUE,
} from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379') },
      }),
    }),
    BullModule.registerQueue(
      { name: STUDY_PLANS_QUEUE },
      { name: STUDY_SESSIONS_QUEUE },
      { name: STUDY_PROGRESS_QUEUE },
      { name: NOTION_QUEUE },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
