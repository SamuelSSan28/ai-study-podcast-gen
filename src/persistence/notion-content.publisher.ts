import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';
import { StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import {
  mapProvisioningStatus,
  mapSessionStage,
  mapTopicStatus,
  sessionReadableBlocks,
} from './notion-mappers';
import { NotionSchemaProvisioner } from './notion-schema';

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
    await this.ensureReady();
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
    try {
      const page = await this.client.pages.create({
        parent: { database_id: this.plansDb },
        properties: this.planProperties(plan) as never,
        children: this.blocks([
          'Plan generation in progress…',
          `Open in dashboard → ${this.planDashboardUrl(plan.id)}`,
        ]),
      });
      plan.notionPageId = page.id;
      plan.notionUrl = 'url' in page ? page.url : undefined;
    } catch (error) {
      this.logger.warn(
        `Notion publish pending plan failed: ${error instanceof Error ? error.message : error}`,
      );
    }
    return plan;
  }

  async publishFinalizedPlan(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<void> {
    await this.ensureReady();
    try {
      if (!plan.notionPageId) {
        plan = await this.publishPendingPlan(plan);
      }
      if (!plan.notionPageId) return;
      await this.client.pages.update({
        page_id: plan.notionPageId,
        properties: this.planProperties(plan) as never,
      });
      await this.replacePageBody(plan.notionPageId, [
        plan.overview || 'Overview pending…',
        '',
        `Open in dashboard → ${this.planDashboardUrl(plan.id)}`,
      ]);
      for (const topic of topics) await this.createTopic(topic);
      await this.createWeekPages(plan.notionPageId, topics);
    } catch (error) {
      this.logger.warn(
        `Notion publish finalized plan failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async publishSession(session: StudySession, topicTitle?: string): Promise<StudySession> {
    await this.ensureReady();
    try {
      if (!session.notionPageId) {
        const page = await this.client.pages.create({
          parent: { database_id: this.sessionsDb },
          properties: this.sessionProperties(session, topicTitle) as never,
        });
        session.notionPageId = page.id;
        session.notionUrl = 'url' in page ? page.url : undefined;
      } else {
        await this.client.pages.update({
          page_id: session.notionPageId,
          properties: this.sessionProperties(session, topicTitle) as never,
        });
      }
      const body = sessionReadableBlocks(session, this.sessionDashboardUrl(session));
      if (body.length) {
        await this.replacePageBody(session.notionPageId!, body);
      }
    } catch (error) {
      this.logger.warn(
        `Notion publish session failed: ${error instanceof Error ? error.message : error}`,
      );
    }
    return session;
  }

  async publishTopicUpdate(topic: StudyPlanTopic): Promise<void> {
    await this.ensureReady();
    if (!topic.notionPageId) return;
    try {
      await this.client.pages.update({
        page_id: topic.notionPageId,
        properties: this.topicProperties(topic) as never,
      });
    } catch (error) {
      this.logger.warn(
        `Notion publish topic update failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async archivePlan(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<void> {
    await this.ensureReady();
    try {
      for (const topic of topics) {
        if (topic.notionPageId) {
          await this.client.pages.update({ page_id: topic.notionPageId, archived: true });
        }
      }
      if (plan.notionPageId) {
        await this.archiveChildPages(plan.notionPageId);
        await this.client.pages.update({ page_id: plan.notionPageId, archived: true });
      }
    } catch (error) {
      this.logger.warn(
        `Notion archive plan failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async createTopic(topic: StudyPlanTopic): Promise<void> {
    const page = await this.client.pages.create({
      parent: { database_id: this.sessionsDb },
      properties: this.topicProperties(topic) as never,
      children: this.blocks([
        topic.description,
        ...topic.learningObjectives,
        '',
        `Open in dashboard → ${this.planDashboardUrl(topic.studyPlanId)}`,
      ]),
    });
    topic.notionPageId = page.id;
  }

  private async createWeekPages(planPageId: string, topics: StudyPlanTopic[]): Promise<void> {
    const weeks = new Map<number, StudyPlanTopic[]>();
    for (const topic of topics) weeks.set(topic.week, [...(weeks.get(topic.week) ?? []), topic]);
    for (const [week, weekTopics] of [...weeks].sort(([a], [b]) => a - b)) {
      await this.client.pages.create({
        parent: { type: 'page_id', page_id: planPageId },
        properties: { title: this.title(`Week ${week.toString().padStart(2, '0')}`) },
        children: weekTopics
          .sort((a, b) => a.sequence - b.sequence)
          .map((topic) => ({
            object: 'block',
            type: 'link_to_page',
            link_to_page: { type: 'page_id', page_id: topic.notionPageId },
          })),
      } as never);
    }
  }

  private async replacePageBody(pageId: string, lines: string[]): Promise<void> {
    await this.archiveChildBlocks(pageId);
    const children = this.blocks(lines);
    if (children.length) {
      await this.client.blocks.children.append({ block_id: pageId, children });
    }
  }

  private async archiveChildBlocks(blockId: string): Promise<void> {
    let cursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
      });
      for (const block of response.results) {
        if ('id' in block) {
          await this.client.blocks.update({ block_id: block.id, archived: true });
        }
      }
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  private async archiveChildPages(blockId: string): Promise<void> {
    let cursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
      });
      for (const block of response.results) {
        if ('type' in block && block.type === 'child_page' && 'id' in block) {
          await this.client.pages.update({ page_id: block.id, archived: true });
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

  private blocks(lines: string[]): Array<{
    object: 'block';
    type: 'paragraph';
    paragraph: { rich_text: Array<{ type: 'text'; text: { content: string } }> };
  }> {
    return lines
      .flatMap((line) => line.match(/[\s\S]{1,1900}/g) ?? [])
      .map((content) => ({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content } }] },
      }));
  }
}
