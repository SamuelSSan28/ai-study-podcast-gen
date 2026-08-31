import {
  SessionStage,
  StudyContent,
  StudyPlanProvisioningStatus,
  StudyPlanTopic,
  StudySession,
  TopicResearch,
} from '../domain/models';
import { contentLinesForKey, enrichArticleOutline, seedArticleOutline } from '../domain/article-outline';

export type NotionRichText = { type: 'text'; text: { content: string; link?: { url: string } | null } };
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
      type: 'divider';
      divider: Record<string, never>;
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

function text(content: string, link?: string): NotionRichText {
  return {
    type: 'text',
    text: {
      content: content.slice(0, 1900),
      ...(link ? { link: { url: link } } : {}),
    },
  };
}

function paragraph(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: content.trim() ? [text(content)] : [] },
  };
}

function heading2(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [text(content)] },
  };
}

function heading3(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [text(content)] },
  };
}

function bullet(content: string, link?: string): NotionBlock {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: [text(content, link)] },
  };
}

function numbered(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: { rich_text: [text(content)] },
  };
}

function divider(): NotionBlock {
  return { object: 'block', type: 'divider', divider: {} };
}

function pushParagraphs(blocks: NotionBlock[], value: string): void {
  for (const chunk of value.match(/[\s\S]{1,1900}/g) ?? []) {
    blocks.push(paragraph(chunk));
  }
}

export function planBodyBlocks(
  overview: string,
  topics: StudyPlanTopic[],
  dashboardUrl: string,
): NotionBlock[] {
  const blocks: NotionBlock[] = [heading2('Visão geral')];
  pushParagraphs(blocks, overview || 'Resumo pendente…');
  blocks.push(heading2('Currículo'));
  const ordered = [...topics].sort((a, b) => a.order - b.order);
  for (const topic of ordered) {
    blocks.push(bullet(`${topic.order}. ${topic.title}`));
  }
  if (!ordered.length) blocks.push(paragraph('Tópicos pendentes…'));
  blocks.push(divider(), paragraph(`Abrir no dashboard → ${dashboardUrl}`));
  return blocks;
}

export function topicArticleBlocks(options: {
  topic: StudyPlanTopic;
  content?: StudyContent;
  research?: TopicResearch;
  session?: StudySession;
  dashboardUrl: string;
}): NotionBlock[] {
  const { topic, content, research, session, dashboardUrl } = options;
  const outline = content
    ? enrichArticleOutline(topic, content, research)
    : (topic.articleOutline ?? seedArticleOutline(topic));
  const blocks: NotionBlock[] = [];

  blocks.push(heading2(topic.title));
  pushParagraphs(blocks, topic.summary || topic.description || 'Resumo do tópico pendente…');

  if (topic.description && topic.summary && topic.description !== topic.summary) {
    blocks.push(heading3('Contexto'));
    pushParagraphs(blocks, topic.description);
  }

  blocks.push(heading2('Neste artigo'));
  for (const section of outline.sections) {
    blocks.push(numbered(section.title));
  }

  if (content) {
    for (const section of outline.sections) {
      const key = section.id as keyof StudyContent;
      const lines = contentLinesForKey(content, key);
      if (!lines.length && section.id.startsWith('objective-')) continue;
      blocks.push(heading2(section.title));
      if (lines.length === 1) {
        pushParagraphs(blocks, lines[0]);
      } else if (lines.length > 1) {
        for (const line of lines) blocks.push(bullet(line));
      } else if (content.overview) {
        pushParagraphs(blocks, content.overview);
      }
      if (section.sourceHints?.length) {
        blocks.push(heading3('Fontes desta seção'));
        for (const hint of section.sourceHints) blocks.push(bullet(hint));
      }
    }
  } else {
    blocks.push(heading2('Conteúdo'));
    blocks.push(
      paragraph(
        'Artigo em geração — as seções serão preenchidas após a pesquisa e o conteúdo técnico.',
      ),
    );
    for (const section of outline.sections) {
      blocks.push(heading3(section.title));
      if (section.promptHint) pushParagraphs(blocks, section.promptHint);
    }
  }

  if (research) {
    blocks.push(divider(), heading2('Pesquisa e fontes'));
    pushParagraphs(blocks, research.summary);
    if (research.keyConcepts.length) {
      blocks.push(heading3('Conceitos-chave'));
      for (const concept of research.keyConcepts) blocks.push(bullet(concept));
    }
    if (research.sources.length) {
      blocks.push(heading3('Fontes'));
      for (const source of research.sources.slice(0, 8)) {
        blocks.push(
          bullet(
            `${source.title}${source.publisher ? ` — ${source.publisher}` : ''}`,
            source.url,
          ),
        );
      }
    }
  }

  if (session?.script?.turns.length) {
    blocks.push(divider(), heading2('Roteiro do podcast'));
    for (const turn of session.script.turns) {
      const speaker = turn.speaker[0] + turn.speaker.slice(1).toLowerCase();
      blocks.push(heading3(speaker));
      pushParagraphs(blocks, turn.text);
    }
  }

  if (session?.audioUrl) {
    blocks.push(divider(), heading2('Áudio'));
    blocks.push(paragraph(`Ouvir: ${session.audioUrl}`));
  }

  blocks.push(divider(), paragraph(`Abrir no dashboard → ${dashboardUrl}`));
  return blocks;
}

export function sessionReadableBlocks(session: StudySession, dashboardUrl: string): string[] {
  const lines: string[] = [];
  if (session.research) {
    lines.push('Resumo da pesquisa', ...researchLines(session.research), '');
  }
  if (session.script?.turns.length) {
    lines.push(
      'Roteiro do podcast',
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
    lines.push(`Áudio: ${session.audioUrl}`, '');
  }
  lines.push(`Abrir no dashboard → ${dashboardUrl}`);
  return lines.filter((line) => line !== undefined);
}

function researchLines(research: TopicResearch): string[] {
  const lines = [research.summary];
  if (research.keyConcepts.length) {
    lines.push('', 'Conceitos-chave:', ...research.keyConcepts.map((c) => `• ${c}`));
  }
  if (research.sources.length) {
    lines.push('', 'Fontes:', ...research.sources.slice(0, 5).map((s) => `• ${s.title}: ${s.url}`));
  }
  return lines;
}
