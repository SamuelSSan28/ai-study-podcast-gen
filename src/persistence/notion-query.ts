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
