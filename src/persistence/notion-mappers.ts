import {
  SessionStage,
  StudyPlanProvisioningStatus,
  StudyPlanTopic,
  StudySession,
} from '../domain/models';
import { notionBlockRenderer, ArticleRenderInput } from './notion-block.renderer';

export type NotionRichText = {
  type: 'text';
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
};

export type NotionBlock =
  | {
      object: 'block';
      type: 'paragraph';
      paragraph: { rich_text: NotionRichText[] };
    }
  | {
      object: 'block';
      type: 'heading_2';
      heading_2: { rich_text: NotionRichText[] };
    }
  | {
      object: 'block';
      type: 'heading_3';
      heading_3: { rich_text: NotionRichText[] };
    }
  | {
      object: 'block';
      type: 'bulleted_list_item';
      bulleted_list_item: { rich_text: NotionRichText[] };
    }
  | {
      object: 'block';
      type: 'numbered_list_item';
      numbered_list_item: { rich_text: NotionRichText[] };
    }
  | {
      object: 'block';
      type: 'quote';
      quote: { rich_text: NotionRichText[] };
    }
  | {
      object: 'block';
      type: 'divider';
      divider: Record<string, never>;
    }
  | {
      object: 'block';
      type: 'code';
      code: { rich_text: NotionRichText[]; language: string };
    }
  | {
      object: 'block';
      type: 'callout';
      callout: {
        rich_text: NotionRichText[];
        icon: { type: 'emoji'; emoji: string };
      };
    };

export function mapProvisioningStatus(status: StudyPlanProvisioningStatus): string {
  const map: Record<StudyPlanProvisioningStatus, string> = {
    CREATING: 'Gerando',
    GENERATING: 'Gerando',
    READY: 'Pronto',
    FAILED: 'Falhou',
  };
  return map[status];
}

export function mapTopicStatus(status: StudyPlanTopic['status']): string {
  const map: Record<StudyPlanTopic['status'], string> = {
    PLANNED: 'Planejado',
    GENERATING: 'Gerando',
    READY: 'Pronto',
    COMPLETED: 'Concluído',
    FAILED: 'Falhou',
    SKIPPED: 'Concluído',
  };
  return map[status] ?? 'Planejado';
}

export function mapSessionStage(stage: SessionStage): string {
  if (stage === 'FAILED') return 'Falhou';
  if (stage === 'COMPLETED' || stage === 'UPLOADED') return 'Concluído';
  if (
    stage === 'CONTENT_PENDING' ||
    stage === 'CONTENT_READY' ||
    stage === 'CONVERSATION_PLAN_PENDING' ||
    stage === 'CONVERSATION_PLAN_READY'
  ) {
    return 'Pesquisa';
  }
  if (stage === 'SCRIPT_PENDING' || stage === 'SCRIPT_READY') return 'Roteiro';
  if (stage === 'DIALOGUE_POLISH_PENDING' || stage === 'DIALOGUE_READY') return 'Roteiro';
  if (stage === 'AUDIO_PENDING' || stage === 'AUDIO_GENERATING' || stage === 'AUDIO_READY') {
    return 'Áudio';
  }
  if (stage === 'UPLOAD_PENDING') return 'Envio';
  return 'Gerando';
}

export function planBodyBlocks(overview: string, dashboardUrl: string): NotionBlock[] {
  return notionBlockRenderer.renderPlanOverview(overview, dashboardUrl);
}

export function topicArticleBlocks(input: ArticleRenderInput): NotionBlock[] {
  return notionBlockRenderer.renderArticle(input);
}

export function scriptPageBlocks(session: StudySession): NotionBlock[] {
  return notionBlockRenderer.renderScript(session);
}

export function sessionReadableBlocks(session: StudySession, dashboardUrl: string): string[] {
  const lines: string[] = [];
  if (session.script?.turns.length) {
    lines.push(
      'Podcast script',
      session.script.turns
        .map(
          (turn) =>
            `${turn.speaker[0] + turn.speaker.slice(1).toLowerCase()}:\n${turn.text}`,
        )
        .join('\n\n'),
      '',
    );
  }
  if (session.audioUrl) {
    lines.push(`Audio: ${session.audioUrl}`, '');
  }
  lines.push(`Open in dashboard → ${dashboardUrl}`);
  return lines.filter((line) => line !== undefined);
}
