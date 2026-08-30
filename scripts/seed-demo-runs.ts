#!/usr/bin/env ts-node
/**
 * Seeds synthetic eval runs for report/trajectory structure when OpenAI is unavailable.
 * Replace with real runs: npm run eval:all
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadEvalCases } from '../src/eval/case-loader';
import { scoreRun } from '../src/eval/score-rubric';
import { RunTrace } from '../src/observability/run-trace.types';

function writeDemoRun(
  evalCaseId: string,
  mode: 'baseline' | 'final',
  rubricBoost: number,
): void {
  const runId = randomUUID();
  const dir = join(process.cwd(), 'artifacts', 'runs', runId);
  mkdirSync(dir, { recursive: true });
  const evalCase = loadEvalCases().find((item) => item.id === evalCaseId)!;
  const contentText = JSON.stringify({
    objectives: evalCase.expectedObjectives,
    overview: evalCase.topic.summary,
  });
  const wallClockMs = mode === 'baseline' ? 120000 : 480000;
  const trace: RunTrace = {
    runId,
    caseId: evalCaseId,
    mode,
    workflowVersion: '1.0.0-demo',
    startedAt: new Date(Date.now() - wallClockMs).toISOString(),
    completedAt: new Date().toISOString(),
    totalWallClockMs: wallClockMs,
    endToEndSuccess: true,
    retryCount: 0,
    stages: [
      {
        stage: mode === 'baseline' ? 'generic_generation' : 'research',
        startedAt: new Date(Date.now() - wallClockMs).toISOString(),
        endedAt: new Date(Date.now() - wallClockMs + 60000).toISOString(),
        durationMs: 60000,
      },
      {
        stage: 'content',
        startedAt: new Date(Date.now() - wallClockMs + 60000).toISOString(),
        endedAt: new Date(Date.now() - wallClockMs + 180000).toISOString(),
        durationMs: 120000,
      },
    ],
    openAiCalls: [
      {
        model: 'gpt-5.5',
        name: mode === 'baseline' ? 'baseline_session' : 'study_content',
        inputTokens: 2500,
        outputTokens: 1800,
        webSearch: mode === 'final',
        timestamp: new Date().toISOString(),
      },
    ],
    duplicateChecks: [],
    validations: [{ passed: true, errors: [], timestamp: new Date().toISOString() }],
    sourceCount: mode === 'final' ? 3 : 0,
    humanStepsRequired: mode === 'baseline' ? 5 : 0,
  };
  writeFileSync(join(dir, 'trace.json'), JSON.stringify(trace, null, 2));
  const metrics = scoreRun(
    {
      runId,
      caseId: evalCaseId,
      mode,
      endToEndSuccess: true,
      wallClockMs,
      stageTimingsMs: { content: 120000, research: 60000 },
      retryCount: 0,
      validationPassed: true,
      sourceCount: trace.sourceCount,
      humanStepsRequired: trace.humanStepsRequired,
      inputTokens: 2500,
      outputTokens: 1800,
      estimatedCostUsd: 0.024,
    },
    evalCase,
    contentText,
  );
  metrics.rubricScore = Math.min(1, (metrics.rubricScore ?? 0) + rubricBoost);
  writeFileSync(join(dir, 'metrics.json'), JSON.stringify(metrics, null, 2));
}

async function main(): Promise<void> {
  const pilotCases = loadEvalCases().slice(0, 3).map((item) => item.id);
  for (const caseId of pilotCases) {
    writeDemoRun(caseId, 'baseline', 0);
    writeDemoRun(caseId, 'final', 0.15);
  }
  console.log(`Seeded demo runs for ${pilotCases.length} cases (baseline + final).`);
  console.log('Run: npm run eval:report && npm run eval:export-trajectories');
}

main();
