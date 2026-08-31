import {
  ArticleOutline,
  ArticleOutlineSection,
  StudyContent,
  StudyPlanTopic,
  TopicResearch,
} from './models';

const CONTENT_SECTION_DEFS: Array<{ id: string; title: string; key: keyof StudyContent }> = [
  { id: 'overview', title: 'Visão geral', key: 'overview' },
  { id: 'businessContext', title: 'Contexto de negócio', key: 'businessContext' },
  { id: 'requirements', title: 'Requisitos', key: 'requirements' },
  { id: 'assumptions', title: 'Premissas', key: 'assumptions' },
  { id: 'architecture', title: 'Arquitetura', key: 'architecture' },
  { id: 'architectureEvolution', title: 'Evolução da arquitetura', key: 'architectureEvolution' },
  { id: 'decisions', title: 'Decisões de design', key: 'decisions' },
  { id: 'failureScenarios', title: 'Falhas e incidentes', key: 'failureScenarios' },
  { id: 'observability', title: 'Observabilidade', key: 'observability' },
  { id: 'slos', title: 'SLIs e SLOs', key: 'slos' },
  { id: 'tradeoffs', title: 'Trade-offs', key: 'tradeoffs' },
  { id: 'vocabulary', title: 'Vocabulário', key: 'vocabulary' },
  { id: 'reviewQuestions', title: 'Perguntas de revisão', key: 'reviewQuestions' },
  { id: 'challenge', title: 'Desafio prático', key: 'challenge' },
];

export function seedArticleOutline(topic: Pick<StudyPlanTopic, 'learningObjectives' | 'title'>): ArticleOutline {
  const fromObjectives: ArticleOutlineSection[] = topic.learningObjectives.map((title, index) => ({
    id: `objective-${index + 1}`,
    title,
    promptHint: `Cobrir objetivo de aprendizagem: ${title}`,
  }));
  if (fromObjectives.length) return { sections: fromObjectives };

  return {
    sections: CONTENT_SECTION_DEFS.slice(0, 6).map(({ id, title }) => ({
      id,
      title,
      promptHint: `Escrever seção didática "${title}" para o tópico "${topic.title}"`,
    })),
  };
}

export function enrichArticleOutline(
  topic: StudyPlanTopic,
  content?: StudyContent,
  research?: TopicResearch,
): ArticleOutline {
  const base = topic.articleOutline ?? seedArticleOutline(topic);
  if (!content) {
    return {
      sections: base.sections.map((section) => ({
        ...section,
        sourceHints: research?.sources.slice(0, 3).map((s) => s.url) ?? section.sourceHints,
      })),
    };
  }

  const sections: ArticleOutlineSection[] = CONTENT_SECTION_DEFS.filter(({ key }) => {
    const value = content[key];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
  }).map(({ id, title, key }) => ({
    id,
    title,
    promptHint: `Expandir seção ${key} para ${topic.title}`,
    sourceHints: research?.sources.slice(0, 3).map((s) => `${s.title}: ${s.url}`),
  }));

  return { sections: sections.length ? sections : base.sections };
}

export function contentLinesForKey(content: StudyContent, key: keyof StudyContent): string[] {
  const value = content[key];
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String);
  const text = String(value).trim();
  return text ? [text] : [];
}

export { CONTENT_SECTION_DEFS };
