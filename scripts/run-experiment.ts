#!/usr/bin/env ts-node
/**
 * Run a targeted experiment by setting eval toggles and re-running final eval.
 * Usage: npm run eval:experiment -- --toggle=skip-web-research --pilot
 */
import { randomUUID } from 'node:crypto';
import { loadEvalCases, filterCases } from '../src/eval/case-loader';
import { runFinalCase } from '../src/eval/final-runner';
import { loadEvalConfig } from '../src/observability/eval-config';
import { parseArg } from './lib/cli';

const TOGGLE_MAP: Record<string, Record<string, string>> = {
  'skip-web-research': { EVAL_SKIP_WEB_RESEARCH: 'true' },
  'skip-duplicate-check': { EVAL_SKIP_DUPLICATE_CHECK: 'true' },
  'skip-prior-context': { EVAL_SKIP_PRIOR_CONTEXT: 'true' },
  'skip-validator': { EVAL_SKIP_VALIDATOR: 'true' },
  'inject-script-failure': { EVAL_INJECT_FAILURE_STAGE: 'SCRIPT_READY' },
};

async function main(): Promise<void> {
  const toggle = parseArg('toggle');
  if (!toggle || !TOGGLE_MAP[toggle]) {
    console.error(`Provide --toggle= one of: ${Object.keys(TOGGLE_MAP).join(', ')}`);
    process.exit(1);
  }
  Object.assign(process.env, TOGGLE_MAP[toggle]);
  process.env.EVAL_MODE = 'experiment';

  const caseFilter = parseArg('case');
  const pilot = process.argv.includes('--pilot');
  let cases = filterCases(loadEvalCases(), caseFilter);
  if (pilot) cases = cases.slice(0, 3);

  process.env.EVAL_SKIP_AUDIO = process.env.EVAL_SKIP_AUDIO ?? 'true';
  process.env.EVAL_SKIP_NOTIFICATION = 'true';

  console.log(`Running experiment toggle=${toggle} on ${cases.length} case(s)...`);
  for (const evalCase of cases) {
    const runId = randomUUID();
    process.env.EVAL_RUN_ID = runId;
    process.env.EVAL_CASE_ID = evalCase.id;
    const config = loadEvalConfig();
    console.log(`  [experiment:${toggle}] ${evalCase.id} → run ${runId}`);
    try {
      await runFinalCase(evalCase, config);
      console.log(`    ✓ completed`);
    } catch (error) {
      console.error(`    ✗ failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log('Run npm run eval:report to compare metrics.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
