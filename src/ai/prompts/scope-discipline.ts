import { CreateConversationPlanInput, StudyContent, StudyPlanTopic } from '../../domain/models';

/** Article generation: stay inside the current topic and learning objectives. */
export const ARTICLE_SCOPE_DISCIPLINE = `SCOPE DISCIPLINE

The article must stay strictly inside the topic and learning objectives provided.

Do not introduce adjacent libraries, tools, patterns, architecture topics,
or future curriculum concepts unless they are required to explain the current topic.

Do not preview later lessons.
Do not expand the article just because a related concept exists.

Every section must directly contribute to the learning objective of this topic.
If a piece of information does not help teach the current objective, omit it.

Before introducing a related technology, library, pattern, or architectural concern, ask whether
the learner needs it to understand the current learning objective. If not, omit it. Cover the topic,
the objectives, and source-supported concepts necessary to teach them — not everything related to
the topic.

Depth is preferred over breadth.`;

/** Podcast script: transform article content for spoken delivery without expanding scope. */
export const SCRIPT_TRANSFORM_RULES = `The source article is the canonical teaching source.

Do not introduce concepts, libraries, examples, or recommendations
that are not present in the source article.

Preserve the same conceptual order and learning progression.

You may:
- simplify explanations for spoken delivery;
- turn examples into dialogue;
- ask questions;
- add pauses and recap moments;
- make transitions more natural.

You may not:
- expand the scope;
- add adjacent technologies;
- introduce future lessons;
- create new technical claims;
- reorder the content in a way that changes the teaching progression.

Transform, do not expand.`;

/** Conversation plan: derive spoken structure from the article without expanding scope. */
export const PLANNER_ARTICLE_FIDELITY = `ARTICLE FIDELITY

The source article is the canonical teaching source for this episode.

Derive every plan section, concept, example, scenario, and tension strictly from the article.
Do not introduce libraries, tools, patterns, architecture topics, or future curriculum concepts
unless they appear in the source article.

Preserve the article's conceptual order and learning progression.
Map each plan section to one or more article sections.

Study plan context and previous sessions are background only — do not expand scope because of them.`;

export function formatLearningObjectives(topic: StudyPlanTopic): string {
  if (topic.learningObjectives.length === 0) {
    return `- Teach "${topic.title}" as described`;
  }
  return topic.learningObjectives.map((objective) => `- ${objective}`).join('\n');
}

export function formatTopicBlock(topic: StudyPlanTopic): string {
  return `TOPIC
${JSON.stringify({ title: topic.title, description: topic.description })}

LEARNING OBJECTIVES
${formatLearningObjectives(topic)}`;
}

export function formatPlannerSourceArticle(input: CreateConversationPlanInput): string {
  return `${formatTopicBlock(input.topic)}

SOURCE ARTICLE
${JSON.stringify(input.technicalContent)}`;
}

export function formatScriptSourceContext(topic: StudyPlanTopic, content: StudyContent): string {
  return `${formatTopicBlock(topic)}

SOURCE ARTICLE
${JSON.stringify(content)}`;
}
