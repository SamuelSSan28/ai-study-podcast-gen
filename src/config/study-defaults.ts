import { Weekday } from '../domain/models';

export const STUDY_DEFAULTS = {
  schedule: {
    days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] as Weekday[],
    sessionsPerWeek: 3,
  },
  curriculum: { durationWeeks: 6 },
  session: { targetMinutes: 45, minMinutes: 30, maxMinutes: 60 },
  audio: { targetMinutes: 20, maxMinutes: 30 },
  article: { maxWords: 4000, readingWordsPerMinute: 220 },
  speech: { wordsPerMinute: 145 },
  podcast: { defaultMode: 'EXPLANATION' as const },
} as const;

export interface StudyPlanSettings {
  targetSessionMinutes?: number;
}

export interface ContentBudget {
  sessionMinutes: number;
  audioMinutes: number;
  articleMinutes: number;
  audioTargetWords: number;
  articleTargetWords: number;
}

export function contentBudget(
  target: number = STUDY_DEFAULTS.session.targetMinutes,
): ContentBudget {
  const sessionMinutes = Math.max(
    STUDY_DEFAULTS.session.minMinutes,
    Math.min(target, STUDY_DEFAULTS.session.maxMinutes),
  );
  const audioMinutes = Math.min(
    STUDY_DEFAULTS.audio.targetMinutes,
    STUDY_DEFAULTS.audio.maxMinutes,
  );
  const articleTargetWords = Math.min(
    (sessionMinutes - audioMinutes) * STUDY_DEFAULTS.article.readingWordsPerMinute,
    STUDY_DEFAULTS.article.maxWords,
  );
  return {
    sessionMinutes,
    audioMinutes,
    articleMinutes: Math.ceil(articleTargetWords / STUDY_DEFAULTS.article.readingWordsPerMinute),
    audioTargetWords: audioMinutes * STUDY_DEFAULTS.speech.wordsPerMinute,
    articleTargetWords,
  };
}
