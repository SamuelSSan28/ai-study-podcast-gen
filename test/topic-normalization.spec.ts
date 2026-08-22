import { normalizeTopicTitle, tagOverlap, topicSlug } from '../src/domain/topic-normalization';
describe('topic normalization', () => {
  it('normalizes accents, punctuation, and whitespace', () => {
    expect(normalizeTopicTitle('  Café: Kafka — Pipeline! ')).toBe('cafe kafka pipeline');
    expect(topicSlug('Café: Kafka Pipeline')).toBe('cafe-kafka-pipeline');
  });
  it('computes Jaccard tag overlap', () => {
    expect(tagOverlap(['Kafka', 'Backpressure'], ['kafka', 'SLO'])).toBeCloseTo(1 / 3);
    expect(tagOverlap([], [])).toBe(0);
  });
});
