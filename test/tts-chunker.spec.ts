import { buildTtsChunks } from '../src/audio/tts-chunker';

describe('buildTtsChunks', () => {
  it('splits only at sentence boundaries and retains the speaker', () => {
    const chunks = buildTtsChunks(
      [{ speaker: 'CANDIDATE', text: 'First sentence. Second sentence.' }],
      18,
    );
    expect(chunks).toEqual([
      { speaker: 'CANDIDATE', text: 'First sentence.' },
      { speaker: 'CANDIDATE', text: 'Second sentence.' },
    ]);
  });
});
