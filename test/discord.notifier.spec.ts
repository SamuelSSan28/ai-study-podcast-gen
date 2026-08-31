import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiscordNotifier } from '../src/notifications/discord.notifier';
import { AppUrlBuilder } from '../src/events/app-url.builder';
import { LocalAudioService } from '../src/audio/local-audio.service';
import { StudyPlanTopic, StudySession, StudyPlan } from '../src/domain/models';

describe('DiscordNotifier', () => {
  const successWebhookUrl = 'https://discord.com/api/webhooks/1/success-token';
  const errorsWebhookUrl = 'https://discord.com/api/webhooks/2/errors-token';
  const session: StudySession = {
    id: '11111111-1111-1111-1111-111111111111',
    generationKey: 'key',
    studyPlanId: 'plan',
    topicId: 'topic',
    title: 'Kafka Foundations',
    podcastMode: 'DISCUSSION',
    stage: 'COMPLETED',
    lastSuccessfulStage: 'COMPLETED',
    summary: 'summary',
    notionUrl: 'https://notion.so/session',
    audioUrl: 'http://localhost:3000/audio/11111111-1111-1111-1111-111111111111',
    retryCount: 0,
    notificationStatus: 'PENDING',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const topic: StudyPlanTopic = {
    id: 'topic',
    studyPlanId: 'plan',
    title: 'Kafka Foundations',
    slug: 'kafka-foundations',
    description: 'desc',
    week: 1,
    sequence: 1,
    difficulty: 'INTERMEDIATE',
    tags: ['kafka'],
    learningObjectives: ['obj'],
    prerequisites: [],
    depthDelta: 'same',
    summary: 'summary',
    level: 'INTERMEDIATE',
    estimatedMinutes: 45,
    status: 'READY',
    studied: false,
    order: 1,
    scheduledAt: '2026-01-01',
  };

  let fetchMock: jest.Mock;
  let audioDir: string;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock;
    audioDir = mkdtempSync(join(tmpdir(), 'discord-audio-'));
  });

  function notifier(maxBytes = 25 * 1024 * 1024): DiscordNotifier {
    const config = {
      getOrThrow: (key: string) => {
        if (key === 'DISCORD_WEBHOOK_URL') return successWebhookUrl;
        if (key === 'DISCORD_WEBHOOK_ERRORS_URL') return errorsWebhookUrl;
        return undefined;
      },
      get: (key: string, defaultValue?: unknown) =>
        key === 'DISCORD_MAX_ATTACHMENT_BYTES' ? maxBytes : defaultValue,
    };
    const localAudio = new LocalAudioService({
      getOrThrow: (key: string) =>
        key === 'AUDIO_STORAGE_PATH'
          ? audioDir
          : key === 'AUDIO_PUBLIC_BASE_URL'
            ? 'http://localhost:3000/audio'
            : '',
    } as never);
    return new DiscordNotifier(config as never, localAudio, new AppUrlBuilder(config as never));
  }

  it('attaches audio when the file is within the Discord limit', async () => {
    const filePath = join(audioDir, `${session.id}.mp3`);
    writeFileSync(filePath, Buffer.alloc(1024));
    await notifier().notify({ ...session, audioPath: filePath }, topic);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(successWebhookUrl);
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toBeUndefined();
  });

  it('sends a local-only notice when the file exceeds the Discord limit', async () => {
    const filePath = join(audioDir, `${session.id}.mp3`);
    writeFileSync(filePath, Buffer.alloc(1024));
    await notifier(512).notify({ ...session, audioPath: filePath }, topic);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(successWebhookUrl);
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    const body = JSON.parse(String(init.body)) as { content: string };
    expect(body.content).toContain('Saved locally only');
    expect(body.content).toContain('http://localhost:3000/audio/11111111-1111-1111-1111-111111111111');
  });

  it('falls back to a text message when no audio file path is available', async () => {
    await notifier().notify(session, topic);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(successWebhookUrl);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { content: string };
    expect(body.content).toContain('Listen: http://localhost:3000/audio/');
  });

  it('sends failure alerts to the errors webhook', async () => {
    const plan = {
      id: 'plan-1',
      title: 'Backend Mastery',
      goal: 'goal',
      level: 'adaptive',
      durationWeeks: 6,
      sessionsPerWeek: 3,
      preferredDays: ['MONDAY'],
      startDate: '2026-01-01',
      endDate: '2026-02-01',
      status: 'ACTIVE',
      overview: 'overview',
      createdAt: '2026-01-01T00:00:00.000Z',
      targetSessionMinutes: 45,
    } as StudyPlan;
    await notifier().notifyFailure({
      session: {
        ...session,
        stage: 'FAILED',
        failedStage: 'AUDIO_GENERATING',
        lastSuccessfulStage: 'DIALOGUE_READY',
        retryCount: 2,
        audioSegments: [{ sequence: 3, path: '/tmp/3.mp3', status: 'FAILED', lastError: 'TTS timeout' }],
      },
      topic,
      plan,
      error: new Error('ffmpeg exited with code 1'),
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(errorsWebhookUrl);
    const body = JSON.parse(String(init.body)) as { content: string };
    expect(body.content).toContain('Session Generation Failed');
    expect(body.content).toContain('Failed at:** AUDIO_GENERATING');
    expect(body.content).toContain('ffmpeg exited with code 1');
    expect(body.content).toContain('TTS segment failures');
    expect(body.content).toContain('/sessions/11111111-1111-1111-1111-111111111111/retry');
  });

  it('sends plan started to the success webhook', async () => {
    const plan = {
      id: 'plan-1',
      title: 'React Mastery',
      goal: 'Learn React',
    } as StudyPlan;
    await notifier().notifyPlanStarted(plan);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(successWebhookUrl);
    const body = JSON.parse(String(init.body)) as { content: string };
    expect(body.content).toContain('Study plan started');
    expect(body.content).toContain('React Mastery');
  });
});
