import { EvalMode } from './eval-config';

export interface OpenAiCallRecord {
  model: string;
  name: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  webSearch: boolean;
  timestamp: string;
}

export interface StageRecord {
  stage: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface DuplicateCheckRecord {
  topicId: string;
  classification: string;
  rejectedReason?: string;
  timestamp: string;
}

export interface ValidationRecord {
  passed: boolean;
  errors: string[];
  timestamp: string;
}

export interface RunTrace {
  runId: string;
  caseId?: string;
  mode: EvalMode;
  workflowVersion: string;
  startedAt: string;
  completedAt?: string;
  totalWallClockMs?: number;
  endToEndSuccess: boolean;
  failedStage?: string;
  errorMessage?: string;
  retryCount: number;
  stages: StageRecord[];
  openAiCalls: OpenAiCallRecord[];
  duplicateChecks: DuplicateCheckRecord[];
  validations: ValidationRecord[];
  sourceCount: number;
  humanStepsRequired: number;
}

export interface RunMetrics {
  runId: string;
  caseId?: string;
  mode: EvalMode;
  endToEndSuccess: boolean;
  wallClockMs: number;
  stageTimingsMs: Record<string, number>;
  retryCount: number;
  validationPassed: boolean;
  sourceCount: number;
  rubricScore?: number;
  rubricBreakdown?: Record<string, number>;
  estimatedCostUsd?: number;
  humanStepsRequired: number;
  inputTokens: number;
  outputTokens: number;
}
