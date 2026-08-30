#!/usr/bin/env ts-node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEvalCases } from '../src/eval/case-loader';
import { scoreRun, persistScoredMetrics } from '../src/eval/score-rubric';
import { RunMetrics } from '../src/observability/run-trace.types';

async function main(): Promise<void> {
  const runsDir = join(process.cwd(), 'artifacts', 'runs');
  if (!existsSync(runsDir)) {
    console.log('No runs found.');
    return;
  }
  const cases = loadEvalCases();
  const caseMap = new Map(cases.map((item) => [item.id, item]));
  let scored = 0;
  for (const runId of readdirSync(runsDir)) {
    const metricsPath = join(runsDir, runId, 'metrics.json');
    if (!existsSync(metricsPath)) continue;
    const metrics = JSON.parse(readFileSync(metricsPath, 'utf8')) as RunMetrics & {
      rubricScore?: number;
    };
    if (metrics.rubricScore !== undefined) continue;
    const evalCase = metrics.caseId ? caseMap.get(metrics.caseId) : undefined;
    if (!evalCase) continue;
    persistScoredMetrics(runId, scoreRun(metrics, evalCase));
    scored += 1;
  }
  console.log(`Scored ${scored} run(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
