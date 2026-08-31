import { StudyPlanTopic } from '../src/domain/models';
import {
  isBlockedByPrerequisites,
  isWaitingForPrerequisites,
  selectNextTopic,
} from '../src/domain/next-topic-policy';

function topic(overrides: Partial<StudyPlanTopic> = {}): StudyPlanTopic {
  return {
    id: 'topic-1',
    studyPlanId: 'plan-1',
    title: 'Kafka Foundations',
    slug: 'kafka-foundations',
    description: 'Build a reliable event pipeline',
    week: 1,
    sequence: 1,
    difficulty: 'FOUNDATIONAL',
    tags: ['kafka'],
    learningObjectives: [],
    prerequisites: [],
    depthDelta: 'Introduces the foundation',
    summary: 'Kafka fundamentals',
    status: 'PLANNED',
    order: 1,
    level: 'FOUNDATION',
    estimatedMinutes: 45,
    scheduledAt: '2026-08-26T12:00:00.000Z',
    studied: false,
    ...overrides,
  };
}

describe('next topic policy', () => {
  it('preserves roadmap order and skips topics with unmet prerequisites', async () => {
    const validate = jest.fn().mockResolvedValue('NEW');
    const result = await selectNextTopic(
      [
        topic({ id: 'advanced', prerequisites: ['Consumer Groups'] }),
        topic({
          id: 'foundation',
          sequence: 2,
          title: 'Consumer Groups',
          slug: 'consumer-groups',
        }),
      ],
      [],
      validate,
    );

    expect(result.topic?.id).toBe('foundation');
    expect(result.rejected).toEqual([{ topicId: 'advanced', reason: 'PREREQUISITES_NOT_READY' }]);
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('checks every deterministic candidate before semantic validation', async () => {
    const completed = topic({ status: 'READY' });
    const validate = jest.fn().mockResolvedValue('RELATED_BUT_DEEPER');
    const deeper = topic({
      id: 'deeper',
      title: 'Kafka Recovery',
      slug: 'kafka-recovery',
      sequence: 2,
      depthDelta: 'Adds recovery under downstream saturation',
    });
    const result = await selectNextTopic([topic(), deeper], [completed], validate);

    expect(result.topic).toBe(deeper);
    expect(result.rejected[0]).toEqual({
      topicId: 'topic-1',
      reason: 'DETERMINISTIC_DUPLICATE',
    });
    expect(validate).toHaveBeenCalledWith(deeper, [completed]);
  });

  it('continues in roadmap order after a semantic duplicate', async () => {
    const first = topic({ id: 'first' });
    const second = topic({ id: 'second', sequence: 2, title: 'Kafka Operations' });
    const validate = jest.fn().mockResolvedValueOnce('DUPLICATE').mockResolvedValueOnce('NEW');
    const result = await selectNextTopic([second, first], [], validate);

    expect(result.topic).toBe(second);
    expect(result.rejected).toContainEqual({
      topicId: 'first',
      reason: 'SEMANTIC_DUPLICATE',
    });
  });

  it('detects when all candidates are blocked by prerequisites', async () => {
    const completed = topic({ status: 'READY', title: 'Done Topic', slug: 'done-topic' });
    const blocked = topic({
      id: 'blocked',
      sequence: 2,
      title: 'Next Topic',
      prerequisites: ['Missing Prerequisite'],
    });
    const result = await selectNextTopic([blocked], [completed], jest.fn());

    expect(isWaitingForPrerequisites(result)).toBe(true);
    expect(isBlockedByPrerequisites([blocked], [completed])).toBe(true);
    expect(isBlockedByPrerequisites([topic()], [])).toBe(false);
  });
});
