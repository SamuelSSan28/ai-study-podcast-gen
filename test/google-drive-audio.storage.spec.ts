import { ConfigService } from '@nestjs/config';
import { GoogleDriveAudioStorage } from '../src/audio/google-drive-audio.storage';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('GoogleDriveAudioStorage', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates the folder hierarchy, uploads audio and returns public links', async () => {
    const directory = await fs.mkdtemp(join(tmpdir(), 'drive-storage-'));
    const filePath = join(directory, 'episode.mp3');
    await fs.writeFile(filePath, Buffer.from('audio'));
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access' }))
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'root-folder', name: 'Podcasts' }))
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'plan-folder', name: 'Plan' }))
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'week-folder', name: 'Week 01' }))
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'audio-id', name: 'topic.mp3' }))
      .mockResolvedValueOnce(jsonResponse({ permissions: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'permission-id' }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'audio-id',
          name: 'topic.mp3',
          webViewLink: 'https://drive.google.com/listen',
          webContentLink: 'https://drive.google.com/download',
        }),
      );

    const config = new ConfigService({
      GOOGLE_DRIVE_CLIENT_ID: 'client',
      GOOGLE_DRIVE_CLIENT_SECRET: 'secret',
      GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh',
      GOOGLE_DRIVE_PUBLIC_SHARING: true,
    });
    const storage = new GoogleDriveAudioStorage(config);

    await expect(
      storage.upload({
        filePath,
        filename: 'topic.mp3',
        folderPath: ['Podcasts', 'Plan', 'Week 01'],
      }),
    ).resolves.toEqual({
      externalId: 'audio-id',
      listenUrl: 'https://drive.google.com/listen',
      downloadUrl: 'https://drive.google.com/download',
    });
    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(fetchMock.mock.calls[8][1]).toMatchObject({ method: 'POST' });
    await fs.rm(directory, { recursive: true });
  });

  it('surfaces a safe Google API error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'invalid refresh token' } }, 400));
    const storage = new GoogleDriveAudioStorage(
      new ConfigService({
        GOOGLE_DRIVE_CLIENT_ID: 'client',
        GOOGLE_DRIVE_CLIENT_SECRET: 'secret',
        GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh',
      }),
    );

    await expect(
      storage.upload({ filePath: 'unused', filename: 'unused', folderPath: [] }),
    ).rejects.toThrow('Failed to refresh Google OAuth token: invalid refresh token');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
