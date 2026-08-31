import { ConfigService } from '@nestjs/config';
import { PodcastAudioRenderer } from '../src/audio/podcast-audio.renderer';
import { PodcastScript } from '../src/domain/models';

describe('PodcastAudioRenderer', () => {
  const config = new ConfigService({
    PODCAST_INSTRUCTOR_VOICE: 'af_heart',
    PODCAST_HOST_VOICE: 'af_heart',
    PODCAST_CO_HOST_VOICE: 'am_adam',
    PODCAST_ENGINEER_B_VOICE: 'am_adam',
    KOKORO_TTS_SPEED: 0.94,
    TTS_PROVIDER: 'kokoro',
  });
  const renderer = new PodcastAudioRenderer(config);

  it('splits a long turn into multiple TTS chunks with breathing pauses', () => {
    const script: PodcastScript = {
      id: 's',
      title: 'State',
      version: '1',
      estimatedDurationSeconds: 120,
      turns: [
        {
          id: 't0',
          speaker: 'INSTRUCTOR',
          role: 'EXPLAIN',
          text: 'Server state is different. It comes from your backend. The data can become stale. Requests can fail.',
          sectionId: 'discovery',
          sequence: 0,
          delivery: { style: 'reflective' },
        },
      ],
    };

    const jobs = renderer.buildJobs(script);
    expect(jobs.length).toBeGreaterThan(1);
    expect(jobs.every((job) => job.chunkCount === jobs.length)).toBe(true);
    expect(jobs.slice(0, -1).every((job) => job.pauseAfterMs >= 180)).toBe(true);
    expect(jobs[0].speed).toBeLessThan(0.94);
  });

  it('adds speaker-change pause on the first chunk of a new speaker', () => {
    const script: PodcastScript = {
      id: 's',
      title: 'State',
      version: '1',
      estimatedDurationSeconds: 60,
      turns: [
        {
          id: 't0',
          speaker: 'INSTRUCTOR',
          text: 'Who owns this value?',
          sectionId: 'q',
          sequence: 0,
          role: 'QUESTION',
        },
        {
          id: 't1',
          speaker: 'CO_HOST',
          text: 'Probably Zustand.',
          sectionId: 'q',
          sequence: 1,
          delivery: { style: 'conversational' },
        },
      ],
    };

    const jobs = renderer.buildJobs(script);
    expect(jobs).toHaveLength(2);
    expect(jobs[1].pauseBeforeMs).toBeGreaterThanOrEqual(250);
    expect(jobs[0].pauseAfterMs).toBeGreaterThanOrEqual(450);
  });

  it('honours explicit delivery.pauseBeforeMs on the first chunk', () => {
    const interviewerConfig = new ConfigService({
      PODCAST_INTERVIEWER_VOICE: 'echo',
      PODCAST_CANDIDATE_VOICE: 'coral',
      KOKORO_TTS_SPEED: 0.94,
      TTS_PROVIDER: 'kokoro',
    });
    const script: PodcastScript = {
      id: 's',
      title: 'T',
      version: '1',
      estimatedDurationSeconds: 30,
      turns: [
        {
          id: 't0',
          speaker: 'INTERVIEWER',
          text: 'Why?',
          sectionId: 'o',
          sequence: 0,
          delivery: { tone: 'skeptical', pauseBeforeMs: 200, pauseAfterMs: 400 },
        },
      ],
    };

    const jobs = new PodcastAudioRenderer(interviewerConfig).buildJobs(script);
    expect(jobs[0]).toMatchObject({
      pauseBeforeMs: 200,
      pauseAfterMs: 400,
      text: 'Why?',
    });
    expect(jobs[0].instructions).toBeUndefined();
  });
});
