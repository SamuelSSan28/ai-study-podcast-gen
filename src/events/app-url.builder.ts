import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppUrlBuilder {
  constructor(private readonly config: ConfigService) {}

  plan(planId: string): string {
    return this.build(`/study-plans/${encodeURIComponent(planId)}`);
  }

  topic(planId: string, topicId: string): string {
    return this.build(
      `/study-plans/${encodeURIComponent(planId)}/topics/${encodeURIComponent(topicId)}`,
    );
  }

  session(planId: string, sessionId: string): string {
    return this.build(
      `/study-plans/${encodeURIComponent(planId)}/sessions/${encodeURIComponent(sessionId)}`,
    );
  }

  private build(path: string): string {
    const base = this.config.get<string>('DASHBOARD_PUBLIC_BASE_URL')?.replace(/\/$/, '') ??
      `http://localhost:${this.config.get<number>('PORT', 3000)}`;
    return new URL(path, `${base}/`).toString();
  }
}
