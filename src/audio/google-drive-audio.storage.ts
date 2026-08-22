import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { AudioStorage } from '../application/ports';

interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
}

@Injectable()
export class GoogleDriveAudioStorage implements AudioStorage {
  private readonly apiBase = 'https://www.googleapis.com/drive/v3';
  private readonly uploadBase = 'https://www.googleapis.com/upload/drive/v3';

  constructor(private readonly config: ConfigService) {}

  async upload(input: {
    filePath: string;
    filename: string;
    folderPath: string[];
  }): Promise<{ externalId: string; listenUrl: string; downloadUrl?: string }> {
    const accessToken = await this.accessToken();
    let parentId = 'root';
    for (const folder of input.folderPath) {
      parentId = await this.findOrCreateFolder(folder, parentId, accessToken);
    }

    const existing = await this.findFile(input.filename, parentId, accessToken);
    const file = await this.putFile(input.filePath, input.filename, parentId, existing?.id, accessToken);
    if (this.config.get<boolean>('GOOGLE_DRIVE_PUBLIC_SHARING', true)) {
      await this.makePublic(file.id, accessToken);
    }
    const linked = await this.getFile(file.id, accessToken);
    if (!linked.webViewLink) throw new Error('Google Drive did not return a webViewLink');
    return {
      externalId: linked.id,
      listenUrl: linked.webViewLink,
      downloadUrl: linked.webContentLink,
    };
  }

  private async accessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_DRIVE_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('GOOGLE_DRIVE_CLIENT_SECRET'),
      refresh_token: this.config.getOrThrow<string>('GOOGLE_DRIVE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = (await this.json(response, 'refresh Google OAuth token')) as {
      access_token?: string;
    };
    if (!payload.access_token) throw new Error('Google OAuth response did not contain an access token');
    return payload.access_token;
  }

  private async findOrCreateFolder(name: string, parentId: string, token: string): Promise<string> {
    const existing = await this.findFile(name, parentId, token, true);
    if (existing) return existing.id;
    const response = await fetch(`${this.apiBase}/files?fields=id,name`, {
      method: 'POST',
      headers: this.headers(token, true),
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });
    return ((await this.json(response, `create Drive folder ${name}`)) as DriveFile).id;
  }

  private async findFile(
    name: string,
    parentId: string,
    token: string,
    folder = false,
  ): Promise<DriveFile | undefined> {
    const escapedName = name.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
    const q = [
      `'${parentId}' in parents`,
      `name = '${escapedName}'`,
      'trashed = false',
      folder
        ? "mimeType = 'application/vnd.google-apps.folder'"
        : "mimeType != 'application/vnd.google-apps.folder'",
    ].join(' and ');
    const params = new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '1' });
    const response = await fetch(`${this.apiBase}/files?${params}`, { headers: this.headers(token) });
    const payload = (await this.json(response, `find Drive item ${name}`)) as { files: DriveFile[] };
    return payload.files[0];
  }

  private async putFile(
    filePath: string,
    filename: string,
    parentId: string,
    existingId: string | undefined,
    token: string,
  ): Promise<DriveFile> {
    const boundary = `study-podcast-${randomUUID()}`;
    const metadata = existingId ? { name: filename } : { name: filename, parents: [parentId] };
    const audio = await readFile(filePath);
    const prefix = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: audio/mpeg\r\n\r\n`,
    );
    const suffix = Buffer.from(`\r\n--${boundary}--`);
    const path = existingId ? `/files/${existingId}` : '/files';
    const response = await fetch(`${this.uploadBase}${path}?uploadType=multipart&fields=id,name`, {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/related; boundary=${boundary}`,
      },
      body: Buffer.concat([prefix, audio, suffix]),
    });
    return (await this.json(response, `upload ${filename} to Drive`)) as DriveFile;
  }

  private async makePublic(fileId: string, token: string): Promise<void> {
    const existingResponse = await fetch(
      `${this.apiBase}/files/${fileId}/permissions?fields=permissions(id,type,role)`,
      { headers: this.headers(token) },
    );
    const existing = (await this.json(existingResponse, 'read Drive sharing permissions')) as {
      permissions: Array<{ type: string; role: string }>;
    };
    if (existing.permissions.some(({ type, role }) => type === 'anyone' && role === 'reader')) {
      return;
    }
    const response = await fetch(`${this.apiBase}/files/${fileId}/permissions`, {
      method: 'POST',
      headers: this.headers(token, true),
      body: JSON.stringify({ type: 'anyone', role: 'reader' }),
    });
    await this.json(response, 'configure Drive public sharing');
  }

  private async getFile(fileId: string, token: string): Promise<DriveFile> {
    const response = await fetch(
      `${this.apiBase}/files/${fileId}?fields=id,name,webViewLink,webContentLink`,
      { headers: this.headers(token) },
    );
    return (await this.json(response, 'read Drive file links')) as DriveFile;
  }

  private headers(token: string, json = false): Record<string, string> {
    return {
      authorization: `Bearer ${token}`,
      ...(json ? { 'content-type': 'application/json' } : {}),
    };
  }

  private async json(response: Response, operation: string): Promise<unknown> {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(`Failed to ${operation}: ${payload.error?.message ?? `HTTP ${response.status}`}`);
    }
    return payload;
  }
}
