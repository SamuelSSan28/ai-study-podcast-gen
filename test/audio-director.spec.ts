import { ConfigService } from '@nestjs/config';
import { ConfigurableAudioDirector } from '../src/audio/audio-director';
import { PodcastScript } from '../src/domain/models';

describe('ConfigurableAudioDirector', () => {
  it('maps speaker voices and explicit delivery overrides via PodcastAudioRenderer', () => {
    const config = new ConfigService({
      PODCAST_INTERVIEWER_VOICE: 'echo',
      PODCAST_CANDIDATE_VOICE: 'coral',
      PODCAST_HOST_VOICE: 'alloy',
      KOKORO_TTS_SPEED: 0.94,
      TTS_PROVIDER: 'kokoro',
    });
    const script: PodcastScript = {
      id: 's',
      title: 'Title',
      version: '1',
      estimatedDurationSeconds: 60,
      turns: [
        {
          id: 't0',
          speaker: 'INTERVIEWER',
          text: 'Why?',
          sectionId: 'opening',
          sequence: 0,
          delivery: { tone: 'skeptical', pauseBeforeMs: 200, pauseAfterMs: 400 },
        },
        { id: 't1', speaker: 'CANDIDATE', text: 'Because.', sectionId: 'opening', sequence: 1 },
      ],
    };
    const jobs = new ConfigurableAudioDirector(config).buildJobs(script);
    expect(jobs[0]).toMatchObject({ voice: 'echo', pauseBeforeMs: 200, pauseAfterMs: 400 });
    expect(jobs[1]).toMatchObject({ voice: 'coral', pauseBeforeMs: expect.any(Number) });
    expect(jobs[1].pauseBeforeMs).toBeGreaterThanOrEqual(250);
  });
});
