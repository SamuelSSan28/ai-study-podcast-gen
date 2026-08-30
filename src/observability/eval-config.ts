export type EvalMode = 'baseline' | 'final' | 'experiment';

export interface EvalConfig {
  enabled: boolean;
  mode: EvalMode;
  runId?: string;
  caseId?: string;
  skipWebResearch: boolean;
  skipDuplicateCheck: boolean;
  skipPriorContext: boolean;
  skipValidator: boolean;
  skipAudio: boolean;
  skipNotification: boolean;
  injectFailureStage?: string;
  humanStepsRequired: number;
}

function readBool(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

export function loadEvalConfig(): EvalConfig {
  const mode = (process.env.EVAL_MODE as EvalMode | undefined) ?? 'final';
  const enabled = Boolean(process.env.EVAL_MODE || process.env.EVAL_RUN_ID || process.env.EVAL_CASE_ID);
  return {
    enabled,
    mode,
    runId: process.env.EVAL_RUN_ID,
    caseId: process.env.EVAL_CASE_ID,
    skipWebResearch: readBool('EVAL_SKIP_WEB_RESEARCH'),
    skipDuplicateCheck: readBool('EVAL_SKIP_DUPLICATE_CHECK'),
    skipPriorContext: readBool('EVAL_SKIP_PRIOR_CONTEXT'),
    skipValidator: readBool('EVAL_SKIP_VALIDATOR'),
    skipAudio: readBool('EVAL_SKIP_AUDIO', mode === 'baseline'),
    skipNotification: readBool('EVAL_SKIP_NOTIFICATION', true),
    injectFailureStage: process.env.EVAL_INJECT_FAILURE_STAGE,
    humanStepsRequired: mode === 'baseline' ? 5 : 0,
  };
}
