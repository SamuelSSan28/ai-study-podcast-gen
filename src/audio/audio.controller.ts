import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { LocalAudioService } from './local-audio.service';
@Controller('audio')
export class AudioController {
  constructor(private readonly audio: LocalAudioService) {}
  @Get(':sessionId') stream(
    @Param('sessionId') sessionId: string,
    @Res() response: Response,
  ): void {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new NotFoundException();
    const file = this.audio.destination(sessionId);
    if (!existsSync(file)) throw new NotFoundException();
    response.type('audio/mpeg');
    createReadStream(file).pipe(response);
  }
}
