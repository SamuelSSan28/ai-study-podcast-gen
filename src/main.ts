import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

const LISTEN_RETRY_MS = 250;
const LISTEN_MAX_ATTEMPTS = 20;

async function listenWithRetry(
  app: Awaited<ReturnType<typeof NestFactory.create>>,
  port: number,
): Promise<void> {
  for (let attempt = 1; attempt <= LISTEN_MAX_ATTEMPTS; attempt++) {
    try {
      await app.listen(port);
      return;
    } catch (error) {
      const errno = (error as NodeJS.ErrnoException).code;
      if (errno !== 'EADDRINUSE' || attempt === LISTEN_MAX_ATTEMPTS) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, LISTEN_RETRY_MS));
    }
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await listenWithRetry(app, port);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void bootstrap();
