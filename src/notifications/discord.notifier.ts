import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyPlanTopic, StudySession } from '../domain/models';
@Injectable()
export class DiscordNotifier {
  constructor(private readonly config: ConfigService) {}
  async notify(session: StudySession, topic: StudyPlanTopic): Promise<void> {
    const response = await fetch(this.config.getOrThrow<string>('DISCORD_WEBHOOK_URL'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: `🎧 **New Backend Study Session Ready**\n\n**${session.title}**\nWeek ${String(topic.week).padStart(2, '0')} · Session ${String(topic.sequence).padStart(2, '0')}\n\n📖 Read: ${session.notionUrl}\n🎙 Listen: ${session.audioUrl}${session.audioDownloadUrl ? `\n⬇️ Download: ${session.audioDownloadUrl}` : ''}\n\nFocus: ${topic.tags.join(' · ')}`,
      }),
    });
    if (!response.ok) throw new Error(`Discord webhook returned ${response.status}`);
  }
}
