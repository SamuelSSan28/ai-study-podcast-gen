import { splitSentences, segmentIntoChunks, endsWithQuestion } from '../src/audio/speech-segmenter';

describe('speech-segmenter', () => {
  it('splits on sentence boundaries', () => {
    expect(splitSentences('First idea. Second idea! Third?')).toEqual([
      'First idea.',
      'Second idea!',
      'Third?',
    ]);
  });

  it('groups sentences into semantic chunks', () => {
    const text = 'One. Two. Three. Four.';
    expect(segmentIntoChunks(text, 2)).toEqual(['One. Two.', 'Three. Four.']);
    expect(segmentIntoChunks(text, 1)).toEqual(['One.', 'Two.', 'Three.', 'Four.']);
  });

  it('detects question endings', () => {
    expect(endsWithQuestion('Where does this live?')).toBe(true);
    expect(endsWithQuestion('It lives in the URL.')).toBe(false);
  });
});
