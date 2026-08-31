import { Client } from '@notionhq/client';

type RecordType = 'TOPIC' | 'SESSION';

export async function findPageByAppId(
  client: Client,
  databaseId: string,
  appId: string,
  recordType?: RecordType,
): Promise<{ id: string; url?: string } | null> {
  const filters: object[] = [{ property: 'App ID', rich_text: { equals: appId } }];
  if (recordType) {
    filters.push({ property: 'Record Type', select: { equals: recordType } });
  }
  const filter = filters.length === 1 ? filters[0] : { and: filters };
  const response = await client.databases.query({
    database_id: databaseId,
    filter: filter as never,
    page_size: 1,
  });
  const page = response.results[0];
  if (!page || !('id' in page)) return null;
  return {
    id: page.id,
    url: 'url' in page ? page.url : undefined,
  };
}

export async function findChildPageByTitle(
  client: Client,
  parentPageId: string,
  titlePrefix: string,
): Promise<{ id: string; url?: string } | null> {
  let cursor: string | undefined;
  do {
    const response = await client.blocks.children.list({
      block_id: parentPageId,
      start_cursor: cursor,
    });
      for (const block of response.results) {
        if (!('type' in block) || block.type !== 'child_page') continue;
      const page = await client.pages.retrieve({ page_id: block.id });
      if (!('properties' in page)) continue;
      const titleProp = page.properties.Name ?? page.properties.title;
      if (!titleProp || titleProp.type !== 'title') continue;
      const title = titleProp.title.map((part) => part.plain_text).join('');
      if (title.startsWith(titlePrefix)) {
        return { id: page.id, url: 'url' in page ? page.url : undefined };
      }
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return null;
}
