import { Injectable, Optional } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EvalConfig, EvalMode, loadEvalConfig } from './eval-config';
import {
  DuplicateCheckRecord,
  OpenAiCallRecord,
  RunMetrics,
  RunTrace,
  StageRecord,
  ValidationRecord,
} from './run-trace.types';

const WORKFLOW_VERSION = '1.0.0';
const TOKEN_COST_PER_1M = { input: 2.5, output: 10 };

@Injectable()
export class RunTraceService {
  private trace: RunTrace | null = null;
  private activeStage: StageRecord | null = null;
  private readonly config: EvalConfig;

  constructor(@Optional() config?: EvalConfig) {
    this.config = config ?? loadEvalConfig();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): EvalConfig {
    return this.config;
  }

  beginRun(input?: { runId?: string; caseId?: string; mode?: EvalMode }): RunTrace | null {
    if (!this.config.enabled && !input?.runId) return null;
    const runId = input?.runId ?? this.config.runId ?? randomUUID();
    this.trace = {
      runId,
      caseId: input?.caseId ?? this.config.caseId,
      mode: input?.mode ?? this.config.mode,
      workflowVersion: WORKFLOW_VERSION,
      startedAt: new Date().toISOString(),
      endToEndSuccess: false,
      retryCount: 0,
      stages: [],
      openAiCalls: [],
      duplicateChecks: [],
      validations: [],
      sourceCount: 0,
      humanStepsRequired: this.config.humanStepsRequired,
    };
    return this.trace;
  }

  startStage(stage: string, metadata?: Record<string, unknown>): void {
    if (!this.trace) return;
    this.activeStage = { stage, startedAt: new Date().toISOString(), metadata };
  }

  endStage(stage: string, metadata?: Record<string, unknown>): void {
    if (!this.trace || !this.activeStage || this.activeStage.stage !== stage) return;
    const endedAt = new Date().toISOString();
    const durationMs = Date.parse(endedAt) - Date.parse(this.activeStage.startedAt);
    this.trace.stages.push({
      ...this.activeStage,
      endedAt,
      durationMs,
      metadata: { ...this.activeStage.metadata, ...metadata },
    });
    this.activeStage = null;
  }

  recordOpenAiCall(record: Omit<OpenAiCallRecord, 'timestamp'>): void {
    if (!this.trace) return;
    this.trace.openAiCalls.push({ ...record, timestamp: new Date().toISOString() });
  }

  recordDuplicateCheck(record: Omit<DuplicateCheckRecord, 'timestamp'>): void {
    if (!this.trace) return;
    this.trace.duplicateChecks.push({ ...record, timestamp: new Date().toISOString() });
  }

  recordValidation(record: Omit<ValidationRecord, 'timestamp'>): void {
    if (!this.trace) return;
    this.trace.validations.push({ ...record, timestamp: new Date().toISOString() });
  }

  recordSourceCount(count: number): void {
    if (!this.trace) return;
    this.trace.sourceCount = count;
  }

  recordRetry(retryCount: number): void {
    if (!this.trace) return;
    this.trace.retryCount = retryCount;
  }

  finishRun(input: { success: boolean; failedStage?: string; errorMessage?: string }): RunMetrics | null {
    if (!this.trace) return null;
    if (this.activeStage) this.endStage(this.activeStage.stage);
    const completedAt = new Date().toISOString();
    this.trace.completedAt = completedAt;
    this.trace.totalWallClockMs = Date.parse(completedAt) - Date.parse(this.trace.startedAt);
    this.trace.endToEndSuccess = input.success;
    this.trace.failedStage = input.failedStage;
    this.trace.errorMessage = input.errorMessage;
    const metrics = this.buildMetrics(this.trace);
    this.persist(this.trace, metrics);
    return metrics;
  }

  getTrace(): RunTrace | null {
    return this.trace;
  }

  private buildMetrics(trace: RunTrace): RunMetrics {
    const stageTimingsMs: Record<string, number> = {};
    for (const stage of trace.stages) {
      if (stage.durationMs !== undefined) stageTimingsMs[stage.stage] = stage.durationMs;
    }
    let inputTokens = 0;
    let outputTokens = 0;
    for (const call of trace.openAiCalls) {
      inputTokens += call.inputTokens ?? 0;
      outputTokens += call.outputTokens ?? 0;
    }
    const estimatedCostUsd =
      (inputTokens / 1_000_000) * TOKEN_COST_PER_1M.input +
      (outputTokens / 1_000_000) * TOKEN_COST_PER_1M.output;
    const lastValidation = trace.validations.at(-1);
    return {
      runId: trace.runId,
      caseId: trace.caseId,
      mode: trace.mode,
      endToEndSuccess: trace.endToEndSuccess,
      wallClockMs: trace.totalWallClockMs ?? 0,
      stageTimingsMs,
      retryCount: trace.retryCount,
      validationPassed: lastValidation?.passed ?? false,
      sourceCount: trace.sourceCount,
      estimatedCostUsd,
      humanStepsRequired: trace.humanStepsRequired,
      inputTokens,
      outputTokens,
    };
  }

  private persist(trace: RunTrace, metrics: RunMetrics): void {
    const dir = join(process.cwd(), 'artifacts', 'runs', trace.runId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'trace.json'), JSON.stringify(trace, null, 2));
    writeFileSync(join(dir, 'metrics.json'), JSON.stringify(metrics, null, 2));
  }
}
