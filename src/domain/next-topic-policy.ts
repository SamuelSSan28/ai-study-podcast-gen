import { StudyPlanTopic } from './models';
import { normalizeTopicTitle, tagOverlap, topicSlug } from './topic-normalization';

export type DuplicateDecision = 'NEW' | 'RELATED_BUT_DEEPER' | 'DUPLICATE';

export interface TopicSelectionResult {
  topic?: StudyPlanTopic;
  rejected: Array<{
    topicId: string;
    reason: 'PREREQUISITES_NOT_READY' | 'DETERMINISTIC_DUPLICATE' | 'SEMANTIC_DUPLICATE';
  }>;
}

/**
 * Selects the first eligible roadmap topic without allowing AI to reorder the plan.
 * Semantic validation is only called after deterministic and prerequisite checks.
 */
export async function selectNextTopic(
  candidates: StudyPlanTopic[],
  history: StudyPlanTopic[],
  validateDuplicate: (
    candidate: StudyPlanTopic,
    history: StudyPlanTopic[],
  ) => Promise<DuplicateDecision>,
): Promise<TopicSelectionResult> {
  const rejected: TopicSelectionResult['rejected'] = [];
  const ordered = [...candidates].sort((a, b) => a.week - b.week || a.sequence - b.sequence);
  const completedNames = new Set(
    history.flatMap((topic) => [normalizeTopicTitle(topic.title), topic.slug]),
  );

  for (const candidate of ordered) {
    const prerequisitesReady = candidate.prerequisites.every((prerequisite) => {
      const normalized = normalizeTopicTitle(prerequisite);
      return completedNames.has(normalized) || completedNames.has(topicSlug(prerequisite));
    });
    if (!prerequisitesReady) {
      rejected.push({ topicId: candidate.id, reason: 'PREREQUISITES_NOT_READY' });
      continue;
    }

    const deterministicDuplicate = history.some(
      (previous) =>
        previous.slug === candidate.slug ||
        normalizeTopicTitle(previous.title) === normalizeTopicTitle(candidate.title) ||
        (tagOverlap(previous.tags, candidate.tags) > 0.85 &&
          candidate.depthDelta.trim().length < 10),
    );
    if (deterministicDuplicate) {
      rejected.push({ topicId: candidate.id, reason: 'DETERMINISTIC_DUPLICATE' });
      continue;
    }

    const decision = await validateDuplicate(candidate, history);
    if (decision === 'DUPLICATE') {
      rejected.push({ topicId: candidate.id, reason: 'SEMANTIC_DUPLICATE' });
      continue;
    }
    return { topic: candidate, rejected };
  }

  return { rejected };
}
