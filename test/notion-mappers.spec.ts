import {
  mapProvisioningStatus,
  mapSessionStage,
  mapTopicStatus,
  planBodyBlocks,
  scriptPageBlocks,
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
      podcastMode: 'EXPLANATION',
      stage: 'COMPLETED',
      lastSuccessfulStage: 'COMPLETED',
      summary: 's',
      retryCount: 0,
      notificationStatus: 'PENDING',
      createdAt: '2026-01-01T00:00:00.000Z',
      script: {
        id: 'script-1',
        title: 'Episode',
        version: '1',
        estimatedDurationSeconds: 60,
        turns: [
          {
            id: 't1',
            sectionId: 's1',
            sequence: 0,
            speaker: 'INSTRUCTOR',
            text: 'Hello world',
          },
        ],
      },
      audioUrl: 'https://example.com/audio.mp3',
    } as StudySession;
    const blocks = sessionReadableBlocks(session, 'http://localhost:3000/?plan=plan-1');
    const joined = blocks.join('\n');
    expect(joined).not.toMatch(/_JSON:/);
    expect(joined).toContain('Podcast script');
    expect(joined).toContain('Instructor:');
    expect(joined).toContain('http://localhost:3000/?plan=plan-1');
  });

  it('builds plan page blocks with overview only', () => {
    const blocks = planBodyBlocks('AI overview text', 'http://localhost:3000/?plan=p1');
    expect(blocks.filter((b) => b.type === 'bulleted_list_item')).toHaveLength(0);
    const headings = blocks
      .filter((b) => b.type === 'heading_2')
      .map((b) => ('heading_2' in b ? b.heading_2.rich_text[0].text.content : ''));
    expect(headings).toContain('Overview');
    expect(headings).not.toContain('Goal');
    expect(headings).not.toContain('Topics');
  });

  it('builds topic article blocks with script link', () => {
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
        sections: [{ id: 'overview', title: 'Overview', promptHint: 'Explain Kafka' }],
      },
    } as StudyPlanTopic;
    const blocks = topicArticleBlocks({
      topic,
      dashboardUrl: 'http://localhost:3000/?plan=p1',
      scriptPageUrl: 'https://notion.so/script-page',
    });
    const headings = blocks
      .filter((b) => b.type === 'heading_2')
      .map((b) => ('heading_2' in b ? b.heading_2.rich_text[0].text.content : ''));
    expect(headings).toContain('Podcast script');
    expect(headings).not.toContain('Kafka basics');
  });

  it('builds script sub-page blocks with quote formatting', () => {
    const session = {
      id: 'sess-1',
      title: 'Kafka basics',
      summary: 'Lesson on Kafka',
      script: {
        id: 'script-1',
        title: 'Kafka basics',
        version: '1',
        estimatedDurationSeconds: 600,
        turns: [
          {
            id: 't1',
            sectionId: 'intro',
            sequence: 0,
            speaker: 'INSTRUCTOR',
            text: 'Kafka is a distributed log.',
          },
        ],
      },
    } as StudySession;
    const blocks = scriptPageBlocks(session);
    expect(blocks.some((b) => b.type === 'quote')).toBe(true);
    const headings = blocks
      .filter((b) => b.type === 'heading_2')
      .map((b) => ('heading_2' in b ? b.heading_2.rich_text[0].text.content : ''));
    expect(headings).toContain('Overview');
    expect(headings).toContain('Intro');
  });
});
