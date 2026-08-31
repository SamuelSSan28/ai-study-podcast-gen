import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';
import { StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import { NotionSchemaProvisioner } from './notion-schema';

type Page = { id: string; url: string; properties: Record<string, unknown> };

@Injectable()
export class NotionContentPublisher implements OnModuleInit {
  private readonly logger = new Logger(NotionContentPublisher.name);
  private readonly client: Client;
  private readonly provisioner: NotionSchemaProvisioner;
  private plansDb!: string;
  private sessionsDb!: string;
  private ready?: Promise<void>;

  constructor(config: ConfigService) {
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
        children: this.blocks([`Goal: ${plan.goal}`, 'Plan generation in progress…']),
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
      await this.client.blocks.children.append({
        block_id: plan.notionPageId,
        children: this.blocks([plan.overview]),
      });
      for (const topic of topics) await this.createTopic(topic);
      await this.createWeekPages(plan.notionPageId, topics);
    } catch (error) {
      this.logger.warn(
        `Notion publish finalized plan failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async publishSession(session: StudySession): Promise<StudySession> {
    await this.ensureReady();
    try {
      if (!session.notionPageId) {
        const page = await this.client.pages.create({
          parent: { database_id: this.sessionsDb },
          properties: this.sessionProperties(session) as never,
        });
        session.notionPageId = page.id;
        session.notionUrl = 'url' in page ? page.url : undefined;
        return session;
      }
      await this.client.pages.update({
        page_id: session.notionPageId,
        properties: this.sessionProperties(session) as never,
      });
      const blocks: string[] = [];
      if (session.content) blocks.push(`STUDY_CONTENT_JSON:${JSON.stringify(session.content)}`);
      if (session.research) blocks.push(`RESEARCH_JSON:${JSON.stringify(session.research)}`);
      if (session.conversationPlan)
        blocks.push(`CONVERSATION_PLAN_JSON:${JSON.stringify(session.conversationPlan)}`);
      if (session.rawScript) blocks.push(`RAW_SCRIPT_JSON:${JSON.stringify(session.rawScript)}`);
      if (session.script) {
        blocks.push(`SCRIPT_JSON:${JSON.stringify(session.script)}`);
        blocks.push(
          `Podcast Script\n${session.script.turns.map((turn) => `${turn.speaker[0] + turn.speaker.slice(1).toLowerCase()}:\n${turn.text}`).join('\n\n')}`,
        );
      }
      if (session.audioUrl) blocks.push(`AUDIO\n${session.audioUrl}`);
      if (blocks.length) {
        await this.client.blocks.children.append({
          block_id: session.notionPageId,
          children: this.blocks(blocks),
        });
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
      children: this.blocks([topic.description, ...topic.learningObjectives]),
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
      Goal: this.text(p.goal),
      Status: { select: { name: p.status } },
      'Idempotency Key': this.text(p.idempotencyKey),
      'Preferred Days': { multi_select: p.preferredDays.map((name) => ({ name })) },
      'Session Duration': { number: p.targetSessionMinutes },
      'Current Topic ID': this.text(p.currentTopicId ?? ''),
      Metadata: this.text(JSON.stringify(p)),
    };
  }

  private topicProperties(t: StudyPlanTopic): Record<string, object> {
    return {
      Name: this.title(t.title),
      'App ID': this.text(t.id),
      'Plan ID': this.text(t.studyPlanId),
      'Record Type': { select: { name: 'TOPIC' } },
      Status: { select: { name: t.status } },
      Order: { number: t.order },
      Level: { select: { name: t.level } },
      Studied: { checkbox: t.studied },
      'Scheduled At': { date: { start: t.scheduledAt } },
      'Estimated Time': { number: t.estimatedMinutes },
      Week: { number: t.week },
      Sequence: { number: t.sequence },
      Slug: this.text(t.slug),
      Tags: { multi_select: t.tags.slice(0, 20).map((name) => ({ name: name.slice(0, 100) })) },
      Metadata: this.text(JSON.stringify(t)),
    };
  }

  private sessionProperties(s: StudySession): Record<string, object> {
    const metadata = { ...s };
    delete metadata.content;
    delete metadata.script;
    delete metadata.rawScript;
    delete metadata.conversationPlan;
    return {
      Name: this.title(s.title),
      'App ID': this.text(s.id),
      'Plan ID': this.text(s.studyPlanId),
      'Record Type': { select: { name: 'SESSION' } },
      Status: { select: { name: s.stage } },
      'Generation Key': this.text(s.generationKey),
      'Audio URL': { url: s.audioUrl ?? null },
      Metadata: this.text(JSON.stringify(metadata)),
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
