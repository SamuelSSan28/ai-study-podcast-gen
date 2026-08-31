#!/usr/bin/env ts-node
/**
 * Archive study plans that share a duplicated title (same name appears 2+ times).
 * By default removes ALL plans in each duplicate title group (keeps none).
 *
 * Usage:
 *   npm run remove:duplicates
 *   npm run remove:duplicates -- --apply
 *   npm run remove:duplicates -- --apply --title "React State*"
 *   npm run remove:duplicates -- --apply --keep-one        # keep newest instead
 *   npm run remove:duplicates -- --apply --keep-one oldest
 */
import 'dotenv/config';
import { Client } from '@notionhq/client';
import { normalizeNotionPageId } from '../src/config/notion-page-id';
import { NOTION_DATABASE_NAMES } from '../src/persistence/notion-schema';

interface StudyPlanRow {
  id: string;
  title: string;
  goal: string;
  createdAt: string;
  notionPageId?: string;
  notionUrl?: string;
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function titleMatches(planTitle: string, pattern: string): boolean {
  const escaped = pattern.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(planTitle.trim());
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const titleFilter = readFlagValue(args, '--title');
  const keepOne = args.includes('--keep-one');
  const keep =
    keepOne && readFlagValue(args, '--keep-one') === 'oldest' ? 'oldest' : 'newest';

  const baseUrl = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  const token = process.env.STUDY_PLAN_CREATE_TOKEN;
  const notionKey = process.env.NOTION_API_KEY;
  const parentPageId = normalizeNotionPageId(process.env.NOTION_PARENT_PAGE_ID ?? '');

  if (!token) throw new Error('STUDY_PLAN_CREATE_TOKEN missing in .env');
  if (!notionKey) throw new Error('NOTION_API_KEY missing in .env');
  if (!parentPageId) throw new Error('NOTION_PARENT_PAGE_ID missing in .env');

  const response = await fetch(`${baseUrl}/study-plans?token=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error(`GET /study-plans failed: HTTP ${response.status}`);

  const plans = (await response.json()) as StudyPlanRow[];
  const groups = new Map<string, StudyPlanRow[]>();

  for (const plan of plans) {
    const key = plan.title.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), plan]);
  }

  let duplicateGroups = [...groups.entries()].filter(([, items]) => items.length > 1);
  if (titleFilter) {
    duplicateGroups = duplicateGroups.filter(([key]) =>
      titleMatches(groups.get(key)![0]!.title, titleFilter),
    );
  }

  if (!duplicateGroups.length) {
    console.log(
      titleFilter
        ? `No duplicate title groups matched --title "${titleFilter}".`
        : 'No duplicate plan titles found.',
    );
    return;
  }

  const client = new Client({ auth: notionKey });
  const topicsDbId = await findDatabase(client, parentPageId, NOTION_DATABASE_NAMES.records);

  console.log(`Mode: ${apply ? 'APPLY (will archive)' : 'DRY-RUN'}`);
  console.log(
    keepOne
      ? `Strategy: keep ${keep} plan per duplicate title group`
      : 'Strategy: remove ALL plans in each duplicate title group',
  );
  if (titleFilter) console.log(`Title filter: "${titleFilter}"`);
  console.log('');

  for (const [, items] of duplicateGroups) {
    const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const keepPlan = keepOne ? (keep === 'oldest' ? sorted[0]! : sorted.at(-1)!) : undefined;
    const removePlans = keepPlan ? sorted.filter((plan) => plan.id !== keepPlan.id) : sorted;

    console.log(`Title: "${sorted[0]!.title}" (${sorted.length} copies)`);
    if (keepPlan) console.log(`  KEEP  → ${keepPlan.id} (${keepPlan.createdAt})`);

    for (const plan of removePlans) {
      console.log(`  REMOVE → ${plan.id} (${plan.createdAt})`);
      if (!apply) continue;
      await archivePlanTree(client, topicsDbId, plan);
      console.log('         archived');
    }
    console.log('');
  }

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply to archive in Notion.');
  }
}

async function findDatabase(
  client: Client,
  parentPageId: string,
  title: string,
): Promise<string> {
  let cursor: string | undefined;
  do {
    const response = await client.search({
      query: title,
      filter: { property: 'object', value: 'database' },
      start_cursor: cursor,
    });
    for (const result of response.results) {
      if (result.object !== 'database' || !('title' in result)) continue;
      const db = result as {
        id: string;
        parent: { type: string; page_id?: string };
        title: Array<{ plain_text: string }>;
      };
      if (
        db.parent.type === 'page_id' &&
        db.parent.page_id === parentPageId &&
        db.title.map((part) => part.plain_text).join('') === title
      ) {
        return db.id;
      }
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);
  throw new Error(`Database not found: ${title}`);
}

async function archivePlanTree(
  client: Client,
  topicsDbId: string,
  plan: StudyPlanRow,
): Promise<void> {
  const related = await queryAllPages(client, topicsDbId, {
    property: 'Plan ID',
    rich_text: { equals: plan.id },
  });

  for (const page of related) {
    await client.pages.update({ page_id: page.id, archived: true });
  }

  if (plan.notionPageId) {
    await archiveChildPages(client, plan.notionPageId);
    await client.pages.update({ page_id: plan.notionPageId, archived: true });
  }
}

async function archiveChildPages(client: Client, blockId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const response = await client.blocks.children.list({ block_id: blockId, start_cursor: cursor });
    for (const block of response.results) {
      if ('type' in block && block.type === 'child_page' && 'id' in block) {
        await client.pages.update({ page_id: block.id, archived: true });
      }
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);
}

async function queryAllPages(
  client: Client,
  databaseId: string,
  filter: object,
): Promise<Array<{ id: string }>> {
  const pages: Array<{ id: string }> = [];
  let cursor: string | undefined;
  do {
    const response = await client.databases.query({
      database_id: databaseId,
      filter: filter as never,
      start_cursor: cursor,
    });
    pages.push(...response.results.filter((r): r is typeof r & { id: string } => 'id' in r));
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
