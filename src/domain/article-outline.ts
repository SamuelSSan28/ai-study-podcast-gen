import {
  ArticleOutline,
  ArticleOutlineSection,
  StudyContent,
  StudyPlanTopic,
  TopicResearch,
} from './models';

export function seedArticleOutline(topic: Pick<StudyPlanTopic, 'learningObjectives' | 'title'>): ArticleOutline {
  const fromObjectives: ArticleOutlineSection[] = topic.learningObjectives.map((title, index) => ({
    id: `section-${index + 1}`,
    title,
    promptHint: `Cover learning objective: ${title}`,
  }));
  if (fromObjectives.length) return { sections: fromObjectives };

  return {
    sections: [
      {
        id: 'introduction',
        title: 'Introduction',
        promptHint: `Explain why "${topic.title}" matters and what the learner will understand`,
      },
      {
        id: 'core-concepts',
        title: 'Core concepts',
        promptHint: `Teach the essential concepts for "${topic.title}"`,
      },
      {
        id: 'application',
        title: 'Application',
        promptHint: `Apply the concepts from "${topic.title}" to a concrete example`,
      },
      {
        id: 'summary',
        title: 'Summary',
        promptHint: 'Recap the essential points and mental model',
      },
    ],
  };
}

export function enrichArticleOutline(
  topic: StudyPlanTopic,
  content?: StudyContent,
  research?: TopicResearch,
): ArticleOutline {
  const base = topic.articleOutline ?? seedArticleOutline(topic);
  const sourceHints = research?.sources.slice(0, 3).map((source) => `${source.title}: ${source.url}`);

  if (!content?.sections.length) {
    return {
      sections: base.sections.map((section) => ({
        ...section,
        sourceHints: sourceHints ?? section.sourceHints,
      })),
    };
  }

  return {
    sections: content.sections.map(({ id, title }) => ({
      id,
      title,
      promptHint: `Article section: ${title}`,
      sourceHints,
    })),
  };
}
