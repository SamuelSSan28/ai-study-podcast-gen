import { createHash } from 'node:crypto';

export function normalizeGoal(value: string): string {
  return value.trim().toLowerCase();
}

export function buildIdempotencyKey(title: string, goal: string): string {
  const normalized = `${normalizeGoal(title)}|${normalizeGoal(goal)}`;
  return createHash('sha256').update(normalized).digest('hex');
}

export function goalsMatch(left: string, right: string): boolean {
  return normalizeGoal(left) === normalizeGoal(right);
}
