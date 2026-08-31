import {
  mapProvisioningStatus,
  mapSessionStage,
  mapTopicStatus,
  sessionReadableBlocks,
} from '../src/persistence/notion-mappers';
import { StudySession } from '../src/domain/models';

describe('notion-mappers', () => {
  it('maps provisioning status to human labels', () => {
    expect(mapProvisioningStatus('CREATING')).toBe('Creating');
    expect(mapProvisioningStatus('READY')).toBe('Ready');
  });

  it('maps session stages without raw enum names', () => {
    expect(mapSessionStage('AUDIO_GENERATING')).toBe('Audio');
    expect(mapSessionStage('COMPLETED')).toBe('Done');
    expect(mapSessionStage('FAILED')).toBe('Failed');
  });

  it('maps topic status', () => {
    expect(mapTopicStatus('PLANNED')).toBe('Planned');
    expect(mapTopicStatus('COMPLETED')).toBe('Done');
  });

  it('builds readable session blocks without JSON prefixes', () => {
    const session = {
      id: 'sess-1',
      generationKey: 'key',
      studyPlanId: 'plan-1',
      topicId: 'topic-1',
      title: 'Episode',
      podcastMode: 'DISCUSSION',
      stage: 'COMPLETED',
      lastSuccessfulStage: 'COMPLETED',
      summary: 's',
      retryCount: 0,
      notificationStatus: 'PENDING',
      createdAt: '2026-01-01T00:00:00.000Z',
      research: {
        summary: 'Research summary text',
        keyConcepts: ['kafka'],
        sources: [{ title: 'Docs', url: 'https://example.com', publisher: null, type: 'OTHER' }],
      },
      script: {
        id: 'script-1',
        title: 'Episode',
        version: '1',
        estimatedDurationSeconds: 60,
        turns: [
          { id: 't1', sectionId: 's1', sequence: 1, speaker: 'HOST', text: 'Hello world' },
        ],
      },
      audioUrl: 'https://example.com/audio.mp3',
    } as StudySession;
    const blocks = sessionReadableBlocks(session, 'http://localhost:3000/?plan=plan-1');
    const joined = blocks.join('\n');
    expect(joined).not.toMatch(/_JSON:/);
    expect(joined).toContain('Research summary text');
    expect(joined).toContain('Podcast Script');
    expect(joined).toContain('Host:');
    expect(joined).toContain('http://localhost:3000/?plan=plan-1');
  });
});
