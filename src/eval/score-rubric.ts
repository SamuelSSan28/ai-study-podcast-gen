import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EvalCase } from './eval-case.types';
import { RunMetrics } from '../observability/run-trace.types';

interface RubricWeights {
  objective_coverage: number;
  grounding: number;
  structural_validity: number;
  completion: number;
  efficiency: number;
}

interface RubricFile {
  weights: RubricWeights;
}

export interface ScoredMetrics extends RunMetrics {
  rubricScore: number;
  rubricBreakdown: Record<string, number>;
}

function loadRubric(): RubricFile {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'evaluation', 'rubrics', 'session-quality.json'), 'utf8'),
  ) as RubricFile;
}

function normalizeText(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

export function scoreRun(
  metrics: RunMetrics,
  evalCase: EvalCase,
  contentText?: string,
): ScoredMetrics {
  const rubric = loadRubric();
  const haystack = normalizeText(contentText ?? '');
  const matched = evalCase.expectedObjectives.filter((objective) =>
    haystack.includes(objective.toLowerCase()),
  );
  const objectiveCoverage =
    evalCase.expectedObjectives.length === 0
      ? 1
      : matched.length / evalCase.expectedObjectives.length;

  let grounding = 1;
  if (metrics.mode === 'final') {
    if (metrics.sourceCount >= 2) grounding = 1;
    else if (metrics.sourceCount === 1) grounding = 0.5;
    else grounding = 0;
  }

  const structuralValidity = metrics.validationPassed ? 1 : 0;
  const completion = metrics.endToEndSuccess ? 1 : 0;
  const maxMs = 30 * 60 * 1000;
  const efficiency = Math.max(0, Math.min(1, 1 - metrics.wallClockMs / maxMs));

  const rubricBreakdown = {
    objective_coverage: objectiveCoverage,
    grounding,
    structural_validity: structuralValidity,
    completion,
    efficiency,
  };

  let rubricScore = 0;
  for (const [key, weight] of Object.entries(rubric.weights) as Array<
    [keyof RubricWeights, number]
  >) {
    rubricScore += (rubricBreakdown[key] ?? 0) * weight;
  }

  return {
    ...metrics,
    rubricScore: Number(rubricScore.toFixed(4)),
    rubricBreakdown: Object.fromEntries(
      Object.entries(rubricBreakdown).map(([key, value]) => [key, Number(value.toFixed(4))]),
    ),
  };
}

export function persistScoredMetrics(runId: string, scored: ScoredMetrics): void {
  const path = join(process.cwd(), 'artifacts', 'runs', runId, 'metrics.json');
  writeFileSync(path, JSON.stringify(scored, null, 2));
}
