import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';
import {
  StudyPlanRepository,
  StudySessionRepository,
  StudyTopicRepository,
} from '../application/ports';
import { StudyPlan, StudyPlanTopic, StudySession } from '../domain/models';
import { NotionSchemaProvisioner } from './notion-schema';

type Page = { id: string; url: string; properties: Record<string, unknown> };
@Injectable()
export class NotionRepository
  implements StudyPlanRepository, StudyTopicRepository, StudySessionRepository, OnModuleInit
{
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
  async create(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<StudyPlan> {
    await this.ensureReady();
    const page = await this.client.pages.create({
      parent: { database_id: this.plansDb },
      properties: this.planProperties(plan),
      children: this.blocks([`Goal: ${plan.goal}`, plan.overview]),
    });
    plan.notionPageId = page.id;
    plan.notionUrl = 'url' in page ? page.url : undefined;
    for (const topic of topics) await this.createTopic(topic);
    await this.createWeekPages(page.id, topics);
    return plan;
  }
  async findAll(): Promise<StudyPlan[]> {
    await this.ensureReady();
    return (await this.query(this.plansDb)).map((page) => this.planFromPage(page));
  }
  async findActive(): Promise<StudyPlan[]> {
    await this.ensureReady();
    return (
      await this.query(this.plansDb, { property: 'Status', select: { equals: 'ACTIVE' } })
    ).map((page) => this.planFromPage(page));
  }
  async findById(id: string): Promise<StudyPlan | null> {
    await this.ensureReady();
    const page = (
      await this.query(this.plansDb, { property: 'App ID', rich_text: { equals: id } })
    )[0];
    return page ? this.planFromPage(page) : null;
  }
  async findPlanned(planId: string): Promise<StudyPlanTopic[]> {
    await this.ensureReady();
    return (
      await this.query(this.sessionsDb, {
        and: [
          { property: 'Record Type', select: { equals: 'TOPIC' } },
          { property: 'Plan ID', rich_text: { equals: planId } },
          { property: 'Status', select: { equals: 'PLANNED' } },
        ],
      })
    )
      .map((page) => this.topicFromPage(page))
      .sort((a, b) => a.week - b.week || a.sequence - b.sequence);
  }
  async findTopicById(id: string): Promise<StudyPlanTopic | null> {
    await this.ensureReady();
    const page = (
      await this.query(this.sessionsDb, {
        and: [
          { property: 'Record Type', select: { equals: 'TOPIC' } },
          { property: 'App ID', rich_text: { equals: id } },
        ],
      })
    )[0];
    return page ? this.topicFromPage(page) : null;
  }
  async findReady(planId: string): Promise<StudyPlanTopic[]> {
    await this.ensureReady();
    return (
      await this.query(this.sessionsDb, {
        and: [
          { property: 'Record Type', select: { equals: 'TOPIC' } },
          { property: 'Plan ID', rich_text: { equals: planId } },
          { property: 'Status', select: { equals: 'READY' } },
        ],
      })
    ).map((page) => this.topicFromPage(page));
  }
  async update(topic: StudyPlanTopic): Promise<void> {
    await this.updateTopic(topic);
  }
  async createSession(session: StudySession): Promise<StudySession> {
    await this.ensureReady();
    const page = await this.client.pages.create({
      parent: { database_id: this.sessionsDb },
      properties: this.sessionProperties(session),
    });
    session.notionPageId = page.id;
    session.notionUrl = 'url' in page ? page.url : undefined;
    return session;
  }
  async findByGenerationKey(key: string): Promise<StudySession | null> {
    await this.ensureReady();
    const page = (
      await this.query(this.sessionsDb, { property: 'Generation Key', rich_text: { equals: key } })
    )[0];
    return page ? this.sessionFromPage(page) : null;
  }
  async findByPlan(planId: string): Promise<StudySession[]> {
    await this.ensureReady();
    return Promise.all(
      (
        await this.query(this.sessionsDb, {
          and: [
            { property: 'Record Type', select: { equals: 'SESSION' } },
            { property: 'Plan ID', rich_text: { equals: planId } },
          ],
        })
      ).map((page) => this.sessionFromPage(page)),
    );
  }
  async findSessionById(id: string): Promise<StudySession | null> {
    await this.ensureReady();
    const page = (
      await this.query(this.sessionsDb, {
        and: [
          { property: 'Record Type', select: { equals: 'SESSION' } },
          { property: 'App ID', rich_text: { equals: id } },
        ],
      })
    )[0];
    return page ? this.sessionFromPage(page) : null;
  }
  async updateSession(session: StudySession): Promise<void> {
    if (!session.notionPageId) throw new Error('Session has no Notion page');
    await this.client.pages.update({
      page_id: session.notionPageId,
      properties: this.sessionProperties(session),
    });
    const blocks: string[] = [];
    if (session.content) blocks.push(`STUDY_CONTENT_JSON:${JSON.stringify(session.content)}`);
    if (session.script) blocks.push(`SCRIPT_JSON:${JSON.stringify(session.script)}`);
    if (session.audioUrl) blocks.push(`AUDIO\n${session.audioUrl}`);
    if (blocks.length)
      await this.client.blocks.children.append({
        block_id: session.notionPageId,
        children: this.blocks(blocks),
      });
  }
  private async createTopic(topic: StudyPlanTopic): Promise<void> {
    const page = await this.client.pages.create({
      parent: { database_id: this.sessionsDb },
      properties: this.topicProperties(topic),
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
        properties: {
          title: this.title(`Week ${week.toString().padStart(2, '0')}`),
        },
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
  private async updateTopic(topic: StudyPlanTopic): Promise<void> {
    if (!topic.notionPageId) throw new Error('Topic has no Notion page');
    await this.client.pages.update({
      page_id: topic.notionPageId,
      properties: this.topicProperties(topic),
    });
  }
  private async query(databaseId: string, filter?: object): Promise<Page[]> {
    const pages: Page[] = [];
    let cursor: string | undefined;
    do {
      const response = await this.client.databases.query({
        database_id: databaseId,
        filter: filter as never,
        start_cursor: cursor,
      });
      pages.push(
        ...response.results
          .filter((item): item is typeof item & Page => 'properties' in item)
          .map((item) => item as Page),
      );
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return pages;
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
  private metadata<T>(p: Page): T {
    const property = p.properties['Metadata'] as { rich_text?: Array<{ plain_text: string }> };
    return JSON.parse(property.rich_text?.map((part) => part.plain_text).join('') ?? '{}') as T;
  }
  private planFromPage(p: Page): StudyPlan {
    return { ...this.metadata<StudyPlan>(p), notionPageId: p.id, notionUrl: p.url };
  }
  private topicFromPage(p: Page): StudyPlanTopic {
    return { ...this.metadata<StudyPlanTopic>(p), notionPageId: p.id };
  }
  private async sessionFromPage(p: Page): Promise<StudySession> {
    const session = { ...this.metadata<StudySession>(p), notionPageId: p.id, notionUrl: p.url };
    const text = await this.readBlockText(p.id);
    const content = [
      ...text.matchAll(
        /STUDY_CONTENT_JSON:(\{[^]*?\})(?=STUDY_CONTENT_JSON:|SCRIPT_JSON:|AUDIO\n|$)/g,
      ),
    ].at(-1)?.[1];
    const script = [
      ...text.matchAll(/SCRIPT_JSON:(\[[^]*?\])(?=STUDY_CONTENT_JSON:|SCRIPT_JSON:|AUDIO\n|$)/g),
    ].at(-1)?.[1];
    if (content) session.content = JSON.parse(content);
    if (script) session.script = JSON.parse(script);
    return session;
  }
  private async readBlockText(blockId: string): Promise<string> {
    const parts: string[] = [];
    let cursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
      });
      for (const block of response.results) {
        if ('paragraph' in block)
          parts.push(block.paragraph.rich_text.map((item) => item.plain_text).join(''));
      }
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return parts.join('');
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
