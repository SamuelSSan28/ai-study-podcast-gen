import { Client } from '@notionhq/client';

export const NOTION_DATABASE_NAMES = {
  plans: 'Study Plans',
  records: 'Topics & Sessions',
} as const;

const richText = { rich_text: {} } as const;
const select = { select: {} } as const;

export const NOTION_DATABASE_PROPERTIES = {
  plans: {
    Name: { title: {} },
    'App ID': richText,
    Goal: richText,
    Status: select,
    Metadata: richText,
  },
  records: {
    Name: { title: {} },
    'App ID': richText,
    'Plan ID': richText,
    Slug: richText,
    'Generation Key': richText,
    Metadata: richText,
    'Record Type': select,
    Status: select,
    Week: { number: { format: 'number' } },
    Sequence: { number: { format: 'number' } },
    Tags: { multi_select: {} },
    'Audio URL': { url: {} },
  },
} as const;

type DatabaseKind = keyof typeof NOTION_DATABASE_NAMES;
type SearchDatabase = {
  id: string;
  object: 'database';
  parent: { type: string; page_id?: string };
  title: Array<{ plain_text: string }>;
  properties: Record<string, { type: string }>;
};

/** Creates and repairs the application's Notion databases below one shared page. */
export class NotionSchemaProvisioner {
  constructor(
    private readonly client: Client,
    private readonly parentPageId: string,
  ) {}

  async provision(): Promise<{ plans: string; records: string }> {
    return {
      plans: await this.ensureDatabase('plans'),
      records: await this.ensureDatabase('records'),
    };
  }

  private async ensureDatabase(kind: DatabaseKind): Promise<string> {
    const existing = await this.findDatabase(NOTION_DATABASE_NAMES[kind]);
    if (!existing) return this.createDatabase(kind);

    const desired = NOTION_DATABASE_PROPERTIES[kind];
    const missing = Object.fromEntries(
      Object.entries(desired).filter(([name]) => !(name in existing.properties)),
    );
    if (Object.keys(missing).length) {
      await this.client.databases.update({
        database_id: existing.id,
        properties: missing,
      } as never);
    }
    return existing.id;
  }

  private async findDatabase(title: string): Promise<SearchDatabase | undefined> {
    let cursor: string | undefined;
    do {
      const response = await this.client.search({
        query: title,
        filter: { property: 'object', value: 'database' },
        start_cursor: cursor,
      });
      const match = response.results.find((result) => {
        if (result.object !== 'database' || !('title' in result)) return false;
        const database = result as SearchDatabase;
        return (
          database.parent.type === 'page_id' &&
          database.parent.page_id === this.parentPageId &&
          database.title.map((part) => part.plain_text).join('') === title
        );
      });
      if (match) return match as SearchDatabase;
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return undefined;
  }

  private async createDatabase(kind: DatabaseKind): Promise<string> {
    const database = await this.client.databases.create({
      parent: { type: 'page_id', page_id: this.parentPageId },
      title: [{ type: 'text', text: { content: NOTION_DATABASE_NAMES[kind] } }],
      properties: NOTION_DATABASE_PROPERTIES[kind],
    } as never);
    return database.id;
  }
}
