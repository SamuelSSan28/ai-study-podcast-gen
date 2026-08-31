import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { LocalAudioService } from './local-audio.service';

@Controller('audio')
export class AudioController {
  constructor(private readonly audio: LocalAudioService) {}

  @Get(':sessionId')
  stream(
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): void {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new NotFoundException();
    const file = this.audio.destination(sessionId);
    if (!existsSync(file)) throw new NotFoundException();

    const { size: fileSize } = statSync(file);
    const range = request.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
      if (!match) {
        response.status(416).end();
        return;
      }

      let start = match[1] ? Number.parseInt(match[1], 10) : 0;
      let end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize) {
        response.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      end = Math.min(end, fileSize - 1);
      if (start > end) {
        response.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      response.status(206);
      response.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'audio/mpeg',
      });
      createReadStream(file, { start, end }).pipe(response);
      return;
    }

    response.status(200);
    response.set({
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Content-Type': 'audio/mpeg',
    });
    createReadStream(file).pipe(response);
  }
}
