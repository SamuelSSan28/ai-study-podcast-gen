import { mergeSelectOptions, selectOptionsNeedUpdate } from '../src/persistence/notion-schema';

describe('mergeSelectOptions', () => {
  it('preserves existing options and appends missing names', () => {
    const existing = [
      { id: '1', name: 'ACTIVE', color: 'green' },
      { id: '2', name: 'COMPLETED', color: 'blue' },
    ];
    const merged = mergeSelectOptions(existing, ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']);
    expect(merged).toHaveLength(4);
    expect(merged.find((option) => option.id === '1')).toEqual({
      id: '1',
      name: 'ACTIVE',
      color: 'green',
    });
    expect(merged.map((option) => option.name)).toEqual([
      'DRAFT',
      'ACTIVE',
      'PAUSED',
      'COMPLETED',
    ]);
  });

  it('returns a copy when all desired options already exist', () => {
    const existing = [{ name: 'TOPIC' }, { name: 'SESSION' }];
    const merged = mergeSelectOptions(existing, ['TOPIC', 'SESSION']);
    expect(merged).toHaveLength(2);
    expect(merged).not.toBe(existing);
  });

  it('forces case-insensitive matches to the desired new label', () => {
    const existing = [
      { id: 'a', name: 'PLANNED', color: 'gray' },
      { id: 'b', name: 'READY', color: 'green' },
      { id: 'c', name: 'CONTENT_PENDING' },
    ];
    const merged = mergeSelectOptions(existing, [
      'Planned',
      'Generating',
      'Ready',
      'Done',
      'Failed',
    ]);
    expect(merged.find((o) => o.id === 'a')).toEqual({
      id: 'a',
      name: 'Planned',
      color: 'gray',
    });
    expect(merged.find((o) => o.id === 'b')?.name).toBe('Ready');
    expect(merged.map((o) => o.name)).toEqual([
      'Planned',
      'Generating',
      'Ready',
      'Done',
      'Failed',
      'CONTENT_PENDING',
    ]);
    expect(selectOptionsNeedUpdate(existing, merged)).toBe(true);
  });

  it('does not treat COMPLETED and Done as the same option', () => {
    const existing = [{ id: '1', name: 'COMPLETED' }];
    const merged = mergeSelectOptions(existing, ['Done']);
    expect(merged).toEqual([
      { name: 'Done' },
      { id: '1', name: 'COMPLETED' },
    ]);
  });
});
