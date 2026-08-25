import { contentBudget, STUDY_DEFAULTS } from '../src/config/study-defaults';
import { calculateStudyDates } from '../src/domain/study-schedule';

describe('automatic study defaults', () => {
  it('keeps article plus audio inside the session budget and caps article length', () => {
    expect(contentBudget()).toEqual({
      sessionMinutes: 45,
      audioMinutes: 20,
      articleMinutes: 19,
      audioTargetWords: 2900,
      articleTargetWords: 4000,
    });
    expect(contentBudget(200).sessionMinutes).toBe(STUDY_DEFAULTS.session.maxMinutes);
    expect(contentBudget(1).sessionMinutes).toBe(STUDY_DEFAULTS.session.minMinutes);
  });

  it('schedules sessions on Monday, Wednesday, and Friday in UTC', () => {
    expect(
      calculateStudyDates(new Date('2026-08-25T08:00:00Z'), STUDY_DEFAULTS.schedule.days, 4),
    ).toEqual([
      '2026-08-26T12:00:00.000Z',
      '2026-08-28T12:00:00.000Z',
      '2026-08-31T12:00:00.000Z',
      '2026-09-02T12:00:00.000Z',
    ]);
  });
});
