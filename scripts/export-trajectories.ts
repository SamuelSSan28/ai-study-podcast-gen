#!/usr/bin/env ts-node
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RunTrace } from '../src/observability/run-trace.types';
import { ScoredMetrics } from '../src/eval/score-rubric';

type TrajectoryKind = 'planning' | 'research' | 'session';

function pickBestRun(kind: TrajectoryKind, traces: Array<{ trace: RunTrace; metrics: ScoredMetrics }>) {
  const filtered = traces.filter(({ trace, metrics }) => {
    if (!metrics.endToEndSuccess) return false;
    if (kind === 'planning') return trace.stages.some((stage) => stage.stage === 'conversation_plan');
    if (kind === 'research') return trace.stages.some((stage) => stage.stage === 'research');
    return trace.mode === 'final';
  });
  return filtered.sort((a, b) => (b.metrics.rubricScore ?? 0) - (a.metrics.rubricScore ?? 0))[0];
}

function renderTrajectory(title: string, item?: { trace: RunTrace; metrics: ScoredMetrics }): string {
  if (!item) return `# ${title}\n\nNo successful run available yet. Run \`npm run eval:final\` first.\n`;
  const { trace, metrics } = item;
  return `# ${title}

Run: \`${trace.runId}\`  
Case: \`${trace.caseId ?? 'unknown'}\`  
Mode: \`${trace.mode}\`  
Rubric score: **${metrics.rubricScore ?? 'n/a'}**

## Flow

\`\`\`text
input/state
  ↓
stages: ${trace.stages.map((stage) => stage.stage).join(' → ')}
  ↓
validation: ${metrics.validationPassed ? 'passed' : 'failed'}
  ↓
final status: ${metrics.endToEndSuccess ? 'success' : 'failed'}
\`\`\`

## Stage timings (ms)

${Object.entries(metrics.stageTimingsMs)
  .map(([stage, ms]) => `- ${stage}: ${ms}`)
  .join('\n')}

## OpenAI calls

${trace.openAiCalls
  .map(
    (call) =>
      `- \`${call.name}\` model=\`${call.model}\` tokens=${call.inputTokens ?? 0}/${call.outputTokens ?? 0} webSearch=${call.webSearch}`,
  )
  .join('\n')}

## Duplicate checks

${trace.duplicateChecks
  .map((item) => `- topic \`${item.topicId}\` → ${item.classification}${item.rejectedReason ? ` (${item.rejectedReason})` : ''}`)
  .join('\n') || '- none recorded'}

## Validations

${trace.validations
  .map((item) => `- ${item.passed ? 'PASS' : 'FAIL'}: ${item.errors.join('; ') || 'ok'}`)
  .join('\n') || '- none recorded'}
`;
}

async function main(): Promise<void> {
  const runsDir = join(process.cwd(), 'artifacts', 'runs');
  const outDir = join(process.cwd(), 'docs', 'evaluation', 'trajectories');
  mkdirSync(outDir, { recursive: true });

  const traces: Array<{ trace: RunTrace; metrics: ScoredMetrics }> = [];
  if (existsSync(runsDir)) {
    for (const runId of readdirSync(runsDir)) {
      const tracePath = join(runsDir, runId, 'trace.json');
      const metricsPath = join(runsDir, runId, 'metrics.json');
      if (!existsSync(tracePath) || !existsSync(metricsPath)) continue;
      traces.push({
        trace: JSON.parse(readFileSync(tracePath, 'utf8')) as RunTrace,
        metrics: JSON.parse(readFileSync(metricsPath, 'utf8')) as ScoredMetrics,
      });
    }
  }

  writeFileSync(
    join(outDir, 'README.md'),
    `# Agent trajectories

Exported automatically by \`npm run eval:export-trajectories\`.

- [Planning example](./planning-example.md)
- [Research example](./research-example.md)
- [Session generation example](./session-generation-example.md)
`,
  );
  writeFileSync(
    join(outDir, 'planning-example.md'),
    renderTrajectory('Planning trajectory', pickBestRun('planning', traces)),
  );
  writeFileSync(
    join(outDir, 'research-example.md'),
    renderTrajectory('Research trajectory', pickBestRun('research', traces)),
  );
  writeFileSync(
    join(outDir, 'session-generation-example.md'),
    renderTrajectory('Session generation trajectory', pickBestRun('session', traces)),
  );
  console.log('Trajectories exported to docs/evaluation/trajectories/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
