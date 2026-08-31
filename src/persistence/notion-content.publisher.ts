import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';
import { StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import { seedArticleOutline } from '../domain/article-outline';
import {
  mapProvisioningStatus,
  mapSessionStage,
  mapTopicStatus,
  NotionBlock,
  planBodyBlocks,
  sessionReadableBlocks,
  topicArticleBlocks,
} from './notion-mappers';
import { findPageByAppId } from './notion-query';
import { NotionSchemaProvisioner } from './notion-schema';

const PAGE_LIKE_BLOCK_TYPES = new Set(['child_page', 'child_database']);

@Injectable()
export class NotionContentPublisher implements OnModuleInit {
  private readonly logger = new Logger(NotionContentPublisher.name);
  private readonly client: Client;
  private readonly provisioner: NotionSchemaProvisioner;
  private plansDb!: string;
  private sessionsDb!: string;
  private ready?: Promise<void>;

  constructor(private readonly config: ConfigService) {
    this.client = new Client({ auth: config.getOrThrow<string>('NOTION_API_KEY') });
    this.provisioner = new NotionSchemaProvisioner(
      this.client,
      config.getOrThrow<string>('NOTION_PARENT_PAGE_ID'),
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      this.logger.error(
        `Notion schema provision failed (app continues; publishes may no-op): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async ensureReady(): Promise<void> {
    this.ready ??= this.provisioner.provision().then(({ plans, records }) => {
      this.plansDb = plans;
      this.sessionsDb = records;
    });
    await this.ready;
  }

  async publishPendingPlan(plan: StudyPlan): Promise<StudyPlan> {
    await this.ensureReady();
    if (plan.notionPageId) return plan;

    const existing = await findPageByAppId(this.client, this.plansDb, plan.id);
    if (existing) {
      plan.notionPageId = existing.id;
      plan.notionUrl = existing.url;
      await this.client.pages.update({
        page_id: existing.id,
        properties: this.planProperties(plan) as never,
      });
      return plan;
    }

    const page = await this.client.pages.create({
      parent: { database_id: this.plansDb },
      properties: this.planProperties(plan) as never,
      children: this.plainBlocks([
        'Plan generation in progress…',
        `Open in dashboard → ${this.planDashboardUrl(plan.id)}`,
      ]),
    });
    plan.notionPageId = page.id;
    plan.notionUrl = 'url' in page ? page.url : undefined;
    return plan;
  }

  async publishFinalizedPlan(
    plan: StudyPlan,
    topics: StudyPlanTopic[],
  ): Promise<{ plan: StudyPlan; topics: StudyPlanTopic[] }> {
    await this.ensureReady();
    if (!plan.notionPageId) {
      plan = await this.publishPendingPlan(plan);
    }
    if (!plan.notionPageId) {
      throw new Error('Notion plan page could not be created or resolved');
    }

    await this.client.pages.update({
      page_id: plan.notionPageId,
      properties: this.planProperties(plan) as never,
    });

    await this.clearPageContent(plan.notionPageId);
    await this.replacePageBodyBlocks(
      plan.notionPageId,
      planBodyBlocks(plan.overview, topics, this.planDashboardUrl(plan.id)),
      { skipClear: true },
    );

    for (const topic of topics) {
      await this.upsertTopic(topic);
    }

    return { plan, topics };
  }

  async publishSession(
    session: StudySession,
    topic?: StudyPlanTopic,
  ): Promise<{ session: StudySession; topic?: StudyPlanTopic }> {
    await this.ensureReady();
    if (!session.notionPageId) {
      const existing = await findPageByAppId(this.client, this.sessionsDb, session.id, 'SESSION');
      if (existing) {
        session.notionPageId = existing.id;
        session.notionUrl = existing.url;
      }
    }

    if (!session.notionPageId) {
      const page = await this.client.pages.create({
        parent: { database_id: this.sessionsDb },
        properties: this.sessionProperties(session, topic?.title) as never,
      });
      session.notionPageId = page.id;
      session.notionUrl = 'url' in page ? page.url : undefined;
    } else {
      await this.client.pages.update({
        page_id: session.notionPageId,
        properties: this.sessionProperties(session, topic?.title) as never,
      });
    }

    const body = sessionReadableBlocks(session, this.sessionDashboardUrl(session));
    if (body.length) {
      await this.replacePageBody(session.notionPageId!, body);
    }

    if (topic) {
      if (!topic.articleOutline) topic.articleOutline = seedArticleOutline(topic);
      await this.upsertTopic(topic, session);
    }

    return { session, topic };
  }

  async publishTopicUpdate(topic: StudyPlanTopic): Promise<void> {
    await this.ensureReady();
    if (!topic.notionPageId) return;
    await this.client.pages.update({
      page_id: topic.notionPageId,
      properties: this.topicProperties(topic) as never,
    });
  }

  async archivePlan(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<void> {
    await this.ensureReady();
    for (const topic of topics) {
      if (topic.notionPageId) {
        await this.client.pages.update({ page_id: topic.notionPageId, archived: true });
      }
    }
    if (plan.notionPageId) {
      await this.clearPageContent(plan.notionPageId);
      await this.client.pages.update({ page_id: plan.notionPageId, archived: true });
    }
  }

  private async upsertTopic(topic: StudyPlanTopic, session?: StudySession): Promise<void> {
    if (!topic.articleOutline) topic.articleOutline = seedArticleOutline(topic);
    const article = topicArticleBlocks({
      topic,
      content: session?.content,
      research: session?.research,
      session,
      dashboardUrl: this.planDashboardUrl(topic.studyPlanId),
    });

    if (!topic.notionPageId) {
      const existing = await findPageByAppId(this.client, this.sessionsDb, topic.id, 'TOPIC');
      if (existing) {
        topic.notionPageId = existing.id;
      }
    }

    if (topic.notionPageId) {
      await this.client.pages.update({
        page_id: topic.notionPageId,
        properties: this.topicProperties(topic) as never,
      });
      await this.replacePageBodyBlocks(topic.notionPageId, article);
      return;
    }

    const page = await this.client.pages.create({
      parent: { database_id: this.sessionsDb },
      properties: this.topicProperties(topic) as never,
      children: article.slice(0, 100) as never,
    });
    topic.notionPageId = page.id;
    if (article.length > 100) {
      await this.replacePageBodyBlocks(topic.notionPageId, article);
    }
  }

  private async replacePageBody(pageId: string, lines: string[]): Promise<void> {
    await this.replacePageBodyBlocks(pageId, this.plainBlocks(lines));
  }

  private async replacePageBodyBlocks(
    pageId: string,
    children: NotionBlock[],
    options?: { skipClear?: boolean },
  ): Promise<void> {
    if (!options?.skipClear) {
      await this.clearPageContent(pageId);
    }
    for (let i = 0; i < children.length; i += 100) {
      const chunk = children.slice(i, i + 100);
      if (chunk.length) {
        await this.client.blocks.children.append({
          block_id: pageId,
          children: chunk as never,
        });
      }
    }
  }

  private async clearPageContent(pageId: string): Promise<void> {
    let cursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      });
      for (const block of response.results) {
        if (!('id' in block) || !('type' in block)) continue;
        if ('archived' in block && block.archived) continue;
        try {
          if (PAGE_LIKE_BLOCK_TYPES.has(block.type)) {
            await this.client.pages.update({ page_id: block.id, archived: true });
          } else {
            await this.client.blocks.update({ block_id: block.id, archived: true });
          }
        } catch (error) {
          this.logger.warn(
            `Notion archive block ${block.id} (${block.type}) failed: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  private planDashboardUrl(planId: string): string {
    const url = new URL('/', `${this.dashboardBase()}/`);
    url.searchParams.set('plan', planId);
    return url.toString();
  }

  private sessionDashboardUrl(session: StudySession): string {
    const url = new URL('/', `${this.dashboardBase()}/`);
    url.searchParams.set('plan', session.studyPlanId);
    url.searchParams.set('session', session.id);
    return url.toString();
  }

  private dashboardBase(): string {
    return (
      this.config.get<string>('DASHBOARD_PUBLIC_BASE_URL')?.replace(/\/$/, '') ??
      `http://localhost:${this.config.get<number>('PORT', 3000)}`
    );
  }

  private text(value: string): object {
    return { rich_text: [{ text: { content: value.slice(0, 1900) } }] };
  }

  private title(value: string): object {
    return { title: [{ text: { content: value.slice(0, 1900) } }] };
  }

  private planProperties(p: StudyPlan): Record<string, object> {
    return {
      Name: this.title(p.title),
      'App ID': this.text(p.id),
      Status: { select: { name: p.status } },
      Provisioning: { select: { name: mapProvisioningStatus(p.provisioningStatus) } },
      'Dashboard URL': { url: this.planDashboardUrl(p.id) },
    };
  }

  private topicProperties(t: StudyPlanTopic): Record<string, object> {
    return {
      Name: this.title(t.title),
      'App ID': this.text(t.id),
      'Plan ID': this.text(t.studyPlanId),
      'Record Type': { select: { name: 'TOPIC' } },
      Status: { select: { name: mapTopicStatus(t.status) } },
      Order: { number: t.order },
      Level: { select: { name: t.level } },
      Studied: { checkbox: t.studied },
      'Scheduled At': { date: { start: t.scheduledAt } },
      'Estimated Time': { number: t.estimatedMinutes },
      Week: { number: t.week },
      Sequence: { number: t.sequence },
      Tags: { multi_select: t.tags.slice(0, 20).map((name) => ({ name: name.slice(0, 100) })) },
      'Dashboard URL': { url: this.planDashboardUrl(t.studyPlanId) },
    };
  }

  private sessionProperties(s: StudySession, topicTitle?: string): Record<string, object> {
    return {
      Name: this.title(s.title),
      'App ID': this.text(s.id),
      'Plan ID': this.text(s.studyPlanId),
      'Record Type': { select: { name: 'SESSION' } },
      Status: { select: { name: mapSessionStage(s.stage) } },
      Topic: this.text(topicTitle ?? s.title),
      'Audio URL': { url: s.audioUrl ?? null },
      'Dashboard URL': { url: this.sessionDashboardUrl(s) },
    };
  }

  private plainBlocks(lines: string[]): NotionBlock[] {
    return lines
      .flatMap((line) => line.match(/[\s\S]{1,1900}/g) ?? [])
      .map((content) => ({
        object: 'block' as const,
        type: 'paragraph' as const,
        paragraph: { rich_text: [{ type: 'text' as const, text: { content } }] },
      }));
  }
}
