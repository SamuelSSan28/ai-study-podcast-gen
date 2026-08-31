import { LocalAudioStorage } from '../src/audio/local-audio.storage';
import { LocalAudioService } from '../src/audio/local-audio.service';

describe('LocalAudioStorage', () => {
  it('returns the local public URL for an uploaded session file', async () => {
    const localAudio = new LocalAudioService({
      getOrThrow: (key: string) =>
        key === 'AUDIO_STORAGE_PATH'
          ? './storage/podcasts'
          : key === 'AUDIO_PUBLIC_BASE_URL'
            ? 'http://localhost:3000/audio'
            : '',
    } as never);
    const storage = new LocalAudioStorage(localAudio);
    const result = await storage.upload({
      filePath: '/tmp/11111111-1111-1111-1111-111111111111.mp3',
      filename: 'kafka-foundations.mp3',
      folderPath: ['AI Study Podcasts', 'Plan'],
    });
    expect(result).toEqual({
      externalId: '11111111-1111-1111-1111-111111111111',
      listenUrl: 'http://localhost:3000/audio/11111111-1111-1111-1111-111111111111',
      downloadUrl: 'http://localhost:3000/audio/11111111-1111-1111-1111-111111111111',
    });
  });
});
