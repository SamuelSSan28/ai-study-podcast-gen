import {
  mapProvisioningStatus,
  mapSessionStage,
  mapTopicStatus,
  sessionReadableBlocks,
  topicArticleBlocks,
} from '../src/persistence/notion-mappers';
import { StudyPlanTopic, StudySession } from '../src/domain/models';

describe('notion-mappers', () => {
  it('maps provisioning status to human labels', () => {
    expect(mapProvisioningStatus('CREATING')).toBe('Gerando');
    expect(mapProvisioningStatus('READY')).toBe('Pronto');
  });

  it('maps session stages without raw enum names', () => {
    expect(mapSessionStage('AUDIO_GENERATING')).toBe('Áudio');
    expect(mapSessionStage('COMPLETED')).toBe('Concluído');
    expect(mapSessionStage('FAILED')).toBe('Falhou');
  });

  it('maps topic status', () => {
    expect(mapTopicStatus('PLANNED')).toBe('Planejado');
    expect(mapTopicStatus('COMPLETED')).toBe('Concluído');
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
    expect(joined).toContain('Resumo da pesquisa');
    expect(joined).toContain('Roteiro do podcast');
    expect(joined).toContain('Host:');
    expect(joined).toContain('http://localhost:3000/?plan=plan-1');
  });

  it('builds topic article blocks with subtopic TOC', () => {
    const topic = {
      id: 't1',
      studyPlanId: 'p1',
      title: 'Kafka basics',
      slug: 'kafka',
      description: 'Intro',
      week: 1,
      sequence: 1,
      difficulty: 'FOUNDATIONAL',
      tags: [],
      learningObjectives: ['Understand brokers'],
      prerequisites: [],
      depthDelta: '',
      summary: 'Summary of kafka',
      status: 'PLANNED',
      order: 1,
      level: 'FOUNDATION',
      estimatedMinutes: 45,
      scheduledAt: '2026-01-01',
      studied: false,
      articleOutline: {
        sections: [{ id: 'overview', title: 'Visão geral', promptHint: 'Explain Kafka' }],
      },
    } as StudyPlanTopic;
    const blocks = topicArticleBlocks({
      topic,
      dashboardUrl: 'http://localhost:3000/?plan=p1',
    });
    const types = blocks.map((b) => b.type);
    expect(types).toContain('heading_2');
    expect(types).toContain('numbered_list_item');
    const headings = blocks
      .filter((b) => b.type === 'heading_2')
      .map((b) => ('heading_2' in b ? b.heading_2.rich_text[0].text.content : ''));
    expect(headings).toContain('Kafka basics');
    expect(headings).toContain('Neste artigo');
  });
});
