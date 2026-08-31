import { Client } from '@notionhq/client';

export const NOTION_DATABASE_NAMES = {
  plans: 'Study Plans',
  records: 'Topics',
} as const;

const richText = { rich_text: {} } as const;
const select = { select: {} } as const;

export const NOTION_DATABASE_PROPERTIES = {
  plans: {
    Name: { title: {} },
    'App ID': richText,
    Goal: richText,
    Status: select,
    'Idempotency Key': richText,
    'Preferred Days': { multi_select: {} },
    'Session Duration': { number: { format: 'number' } },
    'Current Topic ID': richText,
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
    Order: { number: { format: 'number' } },
    Level: select,
    Studied: { checkbox: {} },
    'Scheduled At': { date: {} },
    'Estimated Time': { number: { format: 'number' } },
    Week: { number: { format: 'number' } },
    Sequence: { number: { format: 'number' } },
    Tags: { multi_select: {} },
    'Audio URL': { url: {} },
  },
} as const;

export const NOTION_SELECT_OPTIONS = {
  plans: {
    Status: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'],
    'Preferred Days': [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ],
  },
  records: {
    'Record Type': ['TOPIC', 'SESSION'],
    Status: [
      'PLANNED',
      'GENERATING',
      'READY',
      'COMPLETED',
      'FAILED',
      'SKIPPED',
      'CONTENT_PENDING',
      'CONTENT_READY',
      'CONVERSATION_PLAN_PENDING',
      'CONVERSATION_PLAN_READY',
      'SCRIPT_PENDING',
      'SCRIPT_READY',
      'DIALOGUE_POLISH_PENDING',
      'DIALOGUE_READY',
      'AUDIO_PENDING',
      'AUDIO_GENERATING',
      'AUDIO_READY',
      'UPLOAD_PENDING',
      'UPLOADED',
    ],
    Level: ['FOUNDATION', 'CORE', 'INTERMEDIATE', 'ADVANCED', 'APPLIED'],
  },
} as const;

export type NotionSelectOption = { id?: string; name: string; color?: string };

export function mergeSelectOptions(
  existing: NotionSelectOption[],
  desired: readonly string[],
): NotionSelectOption[] {
  const byName = new Map(existing.map((option) => [option.name, option]));
  const merged = [...existing];
  for (const name of desired) {
    if (!byName.has(name)) merged.push({ name });
  }
  return merged;
}

type DatabaseKind = keyof typeof NOTION_DATABASE_NAMES;
type SearchDatabase = {
  id: string;
  object: 'database';
  parent: { type: string; page_id?: string };
  title: Array<{ plain_text: string }>;
  properties: Record<
    string,
    {
      type: string;
      select?: { options?: NotionSelectOption[] };
      multi_select?: { options?: NotionSelectOption[] };
    }
  >;
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
    const databaseId = existing
      ? await this.repairDatabase(kind, existing)
      : await this.createDatabase(kind);
    await this.ensureSelectOptions(kind, databaseId);
    return databaseId;
  }

  private async repairDatabase(kind: DatabaseKind, existing: SearchDatabase): Promise<string> {
    const desired = NOTION_DATABASE_PROPERTIES[kind];
    const missing = Object.fromEntries(
      Object.entries(desired).filter(([name]) => !(name in existing.properties)),
    );
    if (Object.keys(missing).length) {
      await this.client.databases.update({
        database_id: existing.id,
        properties: missing,
      });
    }
    return existing.id;
  }

  private async ensureSelectOptions(kind: DatabaseKind, databaseId: string): Promise<void> {
    const database = (await this.client.databases.retrieve({
      database_id: databaseId,
    })) as SearchDatabase;
    const desiredOptions = NOTION_SELECT_OPTIONS[kind];
    const updates: Record<string, object> = {};

    for (const propertyName of Object.keys(desiredOptions) as Array<
      keyof (typeof NOTION_SELECT_OPTIONS)[typeof kind]
    >) {
      const optionNames = desiredOptions[propertyName];
      const property = database.properties[propertyName as string];
      if (!property) continue;

      if (property.type === 'select') {
        const existing = property.select?.options ?? [];
        const merged = mergeSelectOptions(existing, optionNames);
        if (merged.length !== existing.length) {
          updates[propertyName] = { select: { options: merged } };
        }
      }

      if (property.type === 'multi_select') {
        const existing = property.multi_select?.options ?? [];
        const merged = mergeSelectOptions(existing, optionNames);
        if (merged.length !== existing.length) {
          updates[propertyName] = { multi_select: { options: merged } };
        }
      }
    }

    if (Object.keys(updates).length) {
      await this.client.databases.update({
        database_id: databaseId,
        properties: updates as never,
      });
    }
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
