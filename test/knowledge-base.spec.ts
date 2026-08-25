import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KnowledgeBaseService } from '../src/knowledge-base/knowledge-base.service';
describe('KnowledgeBaseService', () => {
  it('retrieves only relevant supported sources', async (): Promise<void> => {
    const root = await mkdtemp(path.join(tmpdir(), 'kb-'));
    await mkdir(path.join(root, 'backend'));
    await writeFile(
      path.join(root, 'backend', 'kafka.md'),
      'tags: kafka, backpressure\nKafka context',
    );
    await writeFile(path.join(root, 'backend', 'search.txt'), 'tags: search\nSearch context');
    const config = { get: (): string => root };
    const service = new KnowledgeBaseService(config as never);
    const result = await service.retrieve(['kafka']);
    expect(result).toContain('Kafka context');
    expect(result).not.toContain('Search context');
  });
});
