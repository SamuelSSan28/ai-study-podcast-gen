#!/usr/bin/env ts-node
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ScoredMetrics } from '../src/eval/score-rubric';

interface AggregateResult {
  mode: string;
  runCount: number;
  successRate: number;
  avgRubricScore: number;
  avgWallClockMs: number;
  avgCostUsd: number;
  avgHumanSteps: number;
  runs: Array<{ runId: string; caseId?: string; rubricScore: number; success: boolean }>;
}

function aggregate(mode: string, metrics: ScoredMetrics[]): AggregateResult {
  const runs = metrics.map((item) => ({
    runId: item.runId,
    caseId: item.caseId,
    rubricScore: item.rubricScore ?? 0,
    success: item.endToEndSuccess,
  }));
  const count = metrics.length || 1;
  return {
    mode,
    runCount: metrics.length,
    successRate: Number(
      (metrics.filter((item) => item.endToEndSuccess).length / count).toFixed(4),
    ),
    avgRubricScore: Number(
      (metrics.reduce((sum, item) => sum + (item.rubricScore ?? 0), 0) / count).toFixed(4),
    ),
    avgWallClockMs: Math.round(
      metrics.reduce((sum, item) => sum + item.wallClockMs, 0) / count,
    ),
    avgCostUsd: Number(
      (metrics.reduce((sum, item) => sum + (item.estimatedCostUsd ?? 0), 0) / count).toFixed(4),
    ),
    avgHumanSteps: Number(
      (metrics.reduce((sum, item) => sum + item.humanStepsRequired, 0) / count).toFixed(2),
    ),
    runs,
  };
}

function loadScoredMetrics(): ScoredMetrics[] {
  const runsDir = join(process.cwd(), 'artifacts', 'runs');
  if (!existsSync(runsDir)) return [];
  const results: ScoredMetrics[] = [];
  for (const runId of readdirSync(runsDir)) {
    const path = join(runsDir, runId, 'metrics.json');
    if (!existsSync(path)) continue;
    results.push(JSON.parse(readFileSync(path, 'utf8')) as ScoredMetrics);
  }
  return results;
}

function renderReport(baseline: AggregateResult, final: AggregateResult): string {
  const delta = (final.avgRubricScore - baseline.avgRubricScore).toFixed(4);
  const deltaPct =
    baseline.avgRubricScore === 0
      ? 'n/a'
      : `${(((final.avgRubricScore - baseline.avgRubricScore) / baseline.avgRubricScore) * 100).toFixed(1)}%`;

  return `# Evaluation Report

Generated automatically from \`artifacts/runs/*/metrics.json\`. Do not edit raw run files manually.

## Summary

| Metric | Baseline | Final workflow | Change |
|---|---:|---:|---:|
| Primary metric (avg rubric score) | ${baseline.avgRubricScore} | ${final.avgRubricScore} | ${delta} (${deltaPct}) |
| End-to-end success rate | ${baseline.successRate} | ${final.successRate} | ${(final.successRate - baseline.successRate).toFixed(4)} |
| Avg wall clock (ms) | ${baseline.avgWallClockMs} | ${final.avgWallClockMs} | ${final.avgWallClockMs - baseline.avgWallClockMs} |
| Avg estimated cost (USD) | ${baseline.avgCostUsd} | ${final.avgCostUsd} | ${(final.avgCostUsd - baseline.avgCostUsd).toFixed(4)} |
| Human steps required | ${baseline.avgHumanSteps} | ${final.avgHumanSteps} | ${(final.avgHumanSteps - baseline.avgHumanSteps).toFixed(2)} |

## Baseline runs (${baseline.runCount})

${baseline.runs.map((run) => `- \`${run.runId}\` case \`${run.caseId}\` score=${run.rubricScore} success=${run.success}`).join('\n')}

## Final runs (${final.runCount})

${final.runs.map((run) => `- \`${run.runId}\` case \`${run.caseId}\` score=${run.rubricScore} success=${run.success}`).join('\n')}

## Reproduce

\`\`\`bash
npm run eval:baseline -- --pilot
npm run eval:final -- --pilot
npm run eval:score
npm run eval:report
\`\`\`
`;
}

async function main(): Promise<void> {
  const all = loadScoredMetrics();
  const baseline = aggregate(
    'baseline',
    all.filter((item) => item.mode === 'baseline'),
  );
  const final = aggregate(
    'final',
    all.filter((item) => item.mode === 'final'),
  );

  const resultsDir = join(process.cwd(), 'evaluation', 'results');
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, 'baseline.json'), JSON.stringify(baseline, null, 2));
  writeFileSync(join(resultsDir, 'final.json'), JSON.stringify(final, null, 2));
  writeFileSync(join(resultsDir, 'report.md'), renderReport(baseline, final));
  console.log('Report written to evaluation/results/report.md');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
