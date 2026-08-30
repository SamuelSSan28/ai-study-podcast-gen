#!/usr/bin/env ts-node
import { randomUUID } from 'node:crypto';
import { loadEvalCases, filterCases } from '../src/eval/case-loader';
import { runBaselineCase } from '../src/eval/baseline-runner';
import { loadEvalConfig } from '../src/observability/eval-config';
import { parseArg } from './lib/cli';

async function main(): Promise<void> {
  const caseFilter = parseArg('case');
  const pilot = process.argv.includes('--pilot');
  let cases = filterCases(loadEvalCases(), caseFilter);
  if (pilot) cases = cases.slice(0, 3);

  process.env.EVAL_MODE = 'baseline';
  process.env.EVAL_SKIP_AUDIO = process.env.EVAL_SKIP_AUDIO ?? 'true';
  process.env.EVAL_SKIP_NOTIFICATION = 'true';

  console.log(`Running baseline eval on ${cases.length} case(s)...`);
  for (const evalCase of cases) {
    const runId = randomUUID();
    process.env.EVAL_RUN_ID = runId;
    process.env.EVAL_CASE_ID = evalCase.id;
    const config = loadEvalConfig();
    console.log(`  [baseline] ${evalCase.id} → run ${runId}`);
    try {
      await runBaselineCase(evalCase, config);
      console.log(`    ✓ completed`);
    } catch (error) {
      console.error(`    ✗ failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
