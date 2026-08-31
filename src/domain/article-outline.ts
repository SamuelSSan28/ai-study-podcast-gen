import {
  ArticleOutline,
  StudyContent,
  StudyPlanTopic,
  TopicResearch,
} from './models';

export function seedArticleOutline(topic: Pick<StudyPlanTopic, 'learningObjectives' | 'title'>): ArticleOutline {
  return {
    sections: [
      {
        id: 'opening',
        title: 'Opening / motivation',
        promptHint: `Establish the problem that makes "${topic.title}" useful`,
      },
      {
        id: 'conceptual-progression',
        title: 'Progressive conceptual explanation',
        promptHint: `Build the concepts for "${topic.title}" in dependency order`,
      },
      {
        id: 'practical-demonstration',
        title: 'Relevant practical demonstration',
        promptHint: 'Use an example or code only where it materially improves understanding',
      },
      {
        id: 'boundary',
        title: 'Important boundary or misconception',
        promptHint: 'Clarify only the distinctions needed by the current lesson',
      },
      {
        id: 'mental-model',
        title: 'Closing mental model',
        promptHint: 'Reinforce the reusable mental model the learner should retain',
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
