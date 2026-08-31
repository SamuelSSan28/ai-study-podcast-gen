import { Client } from '@notionhq/client';

export const NOTION_DATABASE_NAMES = {
  plans: 'Study Plans',
  planTopics: 'Topics',
} as const;

const richText = { rich_text: {} } as const;
const select = { select: {} } as const;

export const NOTION_DATABASE_PROPERTIES = {
  plans: {
    Name: { title: {} },
    'App ID': richText,
    Goal: richText,
    Status: select,
    Provisioning: select,
    'Dashboard URL': { url: {} },
    'Idempotency Key': richText,
    'Preferred Days': { multi_select: {} },
    'Session Duration': { number: { format: 'number' } },
    'Current Topic ID': richText,
    Metadata: richText,
  },
  planTopics: {
    Name: { title: {} },
    'App ID': richText,
    Slug: richText,
    'Generation Key': richText,
    Metadata: richText,
    'Record Type': select,
    Status: select,
    Topic: richText,
    'Dashboard URL': { url: {} },
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
    Provisioning: ['Gerando', 'Pronto', 'Falhou'],
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
  planTopics: {
    'Record Type': ['TOPIC', 'SESSION'],
    Status: [
      'Planejado',
      'Gerando',
      'Pronto',
      'Concluído',
      'Falhou',
      'Pesquisa',
      'Roteiro',
      'Áudio',
      'Envio',
    ],
    Level: ['FOUNDATION', 'CORE', 'INTERMEDIATE', 'ADVANCED', 'APPLIED'],
  },
} as const;

export type NotionSelectOption = { id?: string; name: string; color?: string };

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

/**
 * Merges desired select options into existing ones.
 * Notion treats option names as case-insensitive unique — so `PLANNED` and
 * `Planned` collide. When they match case-insensitively, keep the existing
 * option id and force the display name to the desired (new) label.
 */
export function mergeSelectOptions(
  existing: NotionSelectOption[],
  desired: readonly string[],
): NotionSelectOption[] {
  const byLower = new Map(existing.map((option) => [option.name.toLowerCase(), option]));
  const merged: NotionSelectOption[] = [];
  const used = new Set<string>();

  for (const name of desired) {
    const key = name.toLowerCase();
    const prev = byLower.get(key);
    if (prev) {
      merged.push({ ...prev, name });
      used.add(key);
    } else {
      merged.push({ name });
    }
  }

  for (const option of existing) {
    const key = option.name.toLowerCase();
    if (!used.has(key)) merged.push(option);
  }

  return merged;
}

export function selectOptionsNeedUpdate(
  existing: NotionSelectOption[],
  merged: NotionSelectOption[],
): boolean {
  if (existing.length !== merged.length) return true;
  const existingKeys = new Set(existing.map((option) => `${option.id ?? ''}:${option.name}`));
  return merged.some((option) => !existingKeys.has(`${option.id ?? ''}:${option.name}`));
}

/** Creates and repairs the global Study Plans database below the parent page. */
export class NotionSchemaProvisioner {
  constructor(
    private readonly client: Client,
    private readonly parentPageId: string,
  ) {}

  async provision(): Promise<{ plans: string }> {
    return { plans: await this.ensureDatabase('plans') };
  }

  /** Ensures a per-plan Topics database exists inline on the plan page. */
  async ensurePlanTopicsDatabase(planPageId: string): Promise<string> {
    const existing = await this.findChildDatabase(planPageId, NOTION_DATABASE_NAMES.planTopics);
    const databaseId = existing
      ? await this.repairDatabase('planTopics', existing)
      : await this.createPlanTopicsDatabase(planPageId);
    await this.ensurePlanTopicsDatabaseInline(databaseId);
    await this.ensureSelectOptions('planTopics', databaseId);
    return databaseId;
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
        if (selectOptionsNeedUpdate(existing, merged)) {
          updates[propertyName] = { select: { options: merged } };
        }
      }

      if (property.type === 'multi_select') {
        const existing = property.multi_select?.options ?? [];
        const merged = mergeSelectOptions(existing, optionNames);
        if (selectOptionsNeedUpdate(existing, merged)) {
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

  private async findChildDatabase(
    parentPageId: string,
    title: string,
  ): Promise<SearchDatabase | undefined> {
    let cursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({
        block_id: parentPageId,
        start_cursor: cursor,
      });
      for (const block of response.results) {
        if (!('type' in block) || block.type !== 'child_database') continue;
        const database = (await this.client.databases.retrieve({
          database_id: block.id,
        })) as SearchDatabase;
        const blockTitle = database.title.map((part) => part.plain_text).join('');
        if (blockTitle === title) return database;
      }
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

  private async createPlanTopicsDatabase(planPageId: string): Promise<string> {
    const database = await this.client.databases.create({
      parent: { type: 'page_id', page_id: planPageId },
      title: [{ type: 'text', text: { content: NOTION_DATABASE_NAMES.planTopics } }],
      is_inline: true,
      properties: NOTION_DATABASE_PROPERTIES.planTopics,
    } as never);
    return database.id;
  }

  /** Topics should render inside the plan page, not as a separate sub-page. */
  private async ensurePlanTopicsDatabaseInline(databaseId: string): Promise<void> {
    const database = (await this.client.databases.retrieve({
      database_id: databaseId,
    })) as { is_inline?: boolean };
    if (database.is_inline === true) return;
    await this.client.databases.update({
      database_id: databaseId,
      is_inline: true,
    } as never);
  }
}
