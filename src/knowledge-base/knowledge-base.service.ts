import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface KnowledgeDocument {
  path: string;
  tags: string[];
  content: string;
}
@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  constructor(private readonly config: ConfigService) {}
  async retrieve(tags: string[], includeProfile = false): Promise<string> {
    const root = path.resolve(this.config.get<string>('KNOWLEDGE_BASE_PATH', './knowledge'));
    const documents = await this.discover(root);
    const wanted = new Set(tags.map((tag) => tag.toLowerCase()));
    return documents
      .map((document) => ({
        document,
        score:
          document.tags.filter((tag) => wanted.has(tag)).length +
          (includeProfile && document.path.startsWith('profile/') ? 10 : 0),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ document }) => `SOURCE: ${document.path}\n${document.content}`)
      .join('\n\n')
      .slice(0, 60_000);
  }
  private async discover(root: string): Promise<KnowledgeDocument[]> {
    const result: KnowledgeDocument[] = [];
    const walk = async (directory: string): Promise<void> => {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(directory, { withFileTypes: true });
      } catch (error) {
        this.logger.warn(`Cannot read knowledge directory: ${String(error)}`);
        return;
      }
      for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await walk(absolute);
        else if (['.md', '.txt'].includes(path.extname(entry.name).toLowerCase())) {
          const stat = await fs.stat(absolute);
          if (stat.size > 1_000_000) {
            this.logger.warn(`Skipping oversized source ${entry.name}`);
            continue;
          }
          const content = (await fs.readFile(absolute, 'utf8')).replace(/\r\n/g, '\n').trim();
          const relative = path.relative(root, absolute).replaceAll(path.sep, '/');
          const headerTags =
            content
              .match(/^tags:\s*([^\n]+)$/im)?.[1]
              ?.split(',')
              .map((tag) => tag.trim().toLowerCase()) ?? [];
          const inferred = relative
            .toLowerCase()
            .replace(/\.(md|txt)$/, '')
            .split(/[/-]/);
          result.push({
            path: relative,
            tags: [...new Set([...headerTags, ...inferred])],
            content,
          });
        }
      }
    };
    await walk(root);
    return result;
  }
}
