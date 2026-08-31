import { mergeSelectOptions } from '../src/persistence/notion-schema';

describe('mergeSelectOptions', () => {
  it('preserves existing options and appends missing names', () => {
    const existing = [
      { id: '1', name: 'ACTIVE', color: 'green' },
      { id: '2', name: 'COMPLETED', color: 'blue' },
    ];
    const merged = mergeSelectOptions(existing, ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']);
    expect(merged).toHaveLength(4);
    expect(merged[0]).toEqual({ id: '1', name: 'ACTIVE', color: 'green' });
    expect(merged.map((option) => option.name)).toEqual([
      'ACTIVE',
      'COMPLETED',
      'DRAFT',
      'PAUSED',
    ]);
  });

  it('returns a copy when all desired options already exist', () => {
    const existing = [{ name: 'TOPIC' }, { name: 'SESSION' }];
    const merged = mergeSelectOptions(existing, ['TOPIC', 'SESSION']);
    expect(merged).toHaveLength(2);
    expect(merged).not.toBe(existing);
  });
});
