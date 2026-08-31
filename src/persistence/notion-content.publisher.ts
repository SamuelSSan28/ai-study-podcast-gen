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
  topicArticleBlocks,
} from './notion-mappers';
import { notionBlockRenderer } from './notion-block.renderer';
import { findChildPageByTitle, findPageByAppId } from './notion-query';
import { NotionSchemaProvisioner } from './notion-schema';

const PAGE_LIKE_BLOCK_TYPES = new Set(['child_page', 'child_database']);
const SCRIPT_PAGE_PREFIX = 'Script — ';

@Injectable()
export class NotionContentPublisher implements OnModuleInit {
  private readonly logger = new Logger(NotionContentPublisher.name);
  private readonly client: Client;
  private readonly provisioner: NotionSchemaProvisioner;
  private plansDb!: string;
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
    this.ready ??= this.provisioner.provision().then(({ plans }) => {
      this.plansDb = plans;
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
      ]) as never,
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

    await this.syncPlanPageBody(plan);

    plan.notionTopicsDbId = await this.provisioner.ensurePlanTopicsDatabase(plan.notionPageId);

    for (const topic of topics) {
      await this.upsertTopic(plan, topic);
    }

    return { plan, topics };
  }

  async publishSession(
    plan: StudyPlan,
    session: StudySession,
    topic?: StudyPlanTopic,
  ): Promise<{ plan: StudyPlan; session: StudySession; topic?: StudyPlanTopic }> {
    await this.ensureReady();
    if (!plan.notionPageId) {
      throw new Error('Plan has no Notion page for session publish');
    }

    if (topic) {
      if (!topic.articleOutline) topic.articleOutline = seedArticleOutline(topic);
      await this.upsertTopic(plan, topic, session);
    }

    return { plan, session, topic };
  }

  async publishTopicUpdate(topic: StudyPlanTopic, plan: StudyPlan): Promise<void> {
    await this.ensureReady();
    await this.upsertTopic(plan, topic);
  }

  async archivePlan(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<void> {
    await this.ensureReady();
    for (const topic of topics) {
      if (topic.notionPageId) {
        const scriptPage = await findChildPageByTitle(
          this.client,
          topic.notionPageId,
          SCRIPT_PAGE_PREFIX,
        );
        if (scriptPage) {
          await this.client.pages.update({ page_id: scriptPage.id, archived: true });
        }
        await this.client.pages.update({ page_id: topic.notionPageId, archived: true });
      }
    }
    if (plan.notionTopicsDbId) {
      await this.client.databases.update({
        database_id: plan.notionTopicsDbId,
        archived: true,
      } as never);
    }
    if (plan.notionPageId) {
      await this.client.pages.update({ page_id: plan.notionPageId, archived: true });
    }
  }

  private async syncPlanPageBody(plan: StudyPlan): Promise<void> {
    if (!plan.notionPageId) return;
    await this.replacePageBodyBlocks(
      plan.notionPageId,
      planBodyBlocks(plan.overview, this.planDashboardUrl(plan.id)),
    );
  }

  private async resolveTopicsDb(plan: StudyPlan): Promise<string> {
    if (plan.notionTopicsDbId) return plan.notionTopicsDbId;
    if (!plan.notionPageId) {
      throw new Error('Plan has no Notion page to resolve Topics database');
    }
    plan.notionTopicsDbId = await this.provisioner.ensurePlanTopicsDatabase(plan.notionPageId);
    return plan.notionTopicsDbId;
  }

  private async upsertTopic(
    plan: StudyPlan,
    topic: StudyPlanTopic,
    session?: StudySession,
  ): Promise<void> {
    if (!topic.articleOutline) topic.articleOutline = seedArticleOutline(topic);
    const topicsDbId = await this.resolveTopicsDb(plan);

    if (!topic.notionPageId) {
      const existing = await findPageByAppId(this.client, topicsDbId, topic.id, 'TOPIC');
      if (existing) {
        topic.notionPageId = existing.id;
        topic.notionUrl = existing.url ?? topic.notionUrl;
      }
    }

    let scriptPageUrl: string | undefined;
    if (session?.script?.turns.length && topic.notionPageId) {
      scriptPageUrl = await this.upsertScriptSubPage(topic, session);
    }

    const article = topicArticleBlocks({
      topic,
      content: session?.content,
      research: session?.research,
      session,
      dashboardUrl: this.planDashboardUrl(topic.studyPlanId),
      scriptPageUrl,
    });

    if (topic.notionPageId) {
      await this.client.pages.update({
        page_id: topic.notionPageId,
        properties: this.topicProperties(topic, session) as never,
      });
      await this.replacePageBodyBlocks(topic.notionPageId, article);
      if (!topic.notionUrl) {
        const page = await this.client.pages.retrieve({ page_id: topic.notionPageId });
        topic.notionUrl = 'url' in page ? page.url : undefined;
      }
    } else {
      const page = await this.client.pages.create({
        parent: { database_id: topicsDbId },
        properties: this.topicProperties(topic, session) as never,
        children: article.slice(0, 100) as never,
      });
      topic.notionPageId = page.id;
      topic.notionUrl = 'url' in page ? page.url : undefined;
      if (article.length > 100) {
        await this.replacePageBodyBlocks(topic.notionPageId, article);
      }
    }

    if (session?.script?.turns.length) {
      scriptPageUrl = await this.upsertScriptSubPage(topic, session);
      if (scriptPageUrl) {
        const articleWithLink = topicArticleBlocks({
          topic,
          content: session.content,
          research: session.research,
          session,
          dashboardUrl: this.planDashboardUrl(topic.studyPlanId),
          scriptPageUrl,
        });
        await this.replacePageBodyBlocks(topic.notionPageId, articleWithLink);
      }
    }
  }

  private async upsertScriptSubPage(
    topic: StudyPlanTopic,
    session: StudySession,
  ): Promise<string | undefined> {
    if (!topic.notionPageId || !session.script?.turns.length) return undefined;

    const title = `${SCRIPT_PAGE_PREFIX}${topic.title}`;
    const blocks = notionBlockRenderer.renderScript(session);

    if (!session.notionScriptPageId) {
      const existing = await findChildPageByTitle(
        this.client,
        topic.notionPageId,
        SCRIPT_PAGE_PREFIX,
      );
      if (existing) {
        session.notionScriptPageId = existing.id;
      }
    }

    if (session.notionScriptPageId) {
      await this.client.pages.update({
        page_id: session.notionScriptPageId,
        properties: { title: this.title(title) } as never,
      });
      await this.replacePageBodyBlocks(session.notionScriptPageId, blocks);
      const page = await this.client.pages.retrieve({ page_id: session.notionScriptPageId });
      return 'url' in page ? page.url : undefined;
    }

    const page = await this.client.pages.create({
      parent: { page_id: topic.notionPageId },
      properties: { title: this.title(title) } as never,
      children: blocks.slice(0, 100) as never,
    });
    session.notionScriptPageId = page.id;
    if (blocks.length > 100) {
      await this.replacePageBodyBlocks(session.notionScriptPageId, blocks);
    }
    return 'url' in page ? page.url : undefined;
  }

  private async replacePageBodyBlocks(
    pageId: string,
    children: NotionBlock[],
    options?: { skipClear?: boolean },
  ): Promise<void> {
    if (!options?.skipClear) {
      await this.clearPageContent(pageId, { preserveChildren: true });
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

  private async clearPageContent(
    pageId: string,
    options?: { preserveChildren?: boolean },
  ): Promise<void> {
    const preserveChildren = options?.preserveChildren ?? false;
    let cursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      });
      for (const block of response.results) {
        if (!('id' in block) || !('type' in block)) continue;
        if ('archived' in block && block.archived) continue;
        if (preserveChildren && PAGE_LIKE_BLOCK_TYPES.has(block.type)) continue;
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

  private topicProperties(t: StudyPlanTopic, session?: StudySession): Record<string, object> {
    const status = session ? mapSessionStage(session.stage) : mapTopicStatus(t.status);
    return {
      Name: this.title(t.title),
      'App ID': this.text(t.id),
      'Record Type': { select: { name: 'TOPIC' } },
      Status: { select: { name: status } },
      Order: { number: t.order },
      Level: { select: { name: t.level } },
      Studied: { checkbox: t.studied },
      'Scheduled At': { date: { start: t.scheduledAt } },
      'Estimated Time': { number: t.estimatedMinutes },
      Week: { number: t.week },
      Sequence: { number: t.sequence },
      Tags: { multi_select: t.tags.slice(0, 20).map((name) => ({ name: name.slice(0, 100) })) },
      'Audio URL': { url: session?.audioUrl ?? null },
      'Dashboard URL': { url: this.planDashboardUrl(t.studyPlanId) },
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
