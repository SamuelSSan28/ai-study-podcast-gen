import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EvalCase } from './eval-case.types';
import { EvalConfig } from '../observability/eval-config';
import { createEvalModule } from './eval-bootstrap';
import { InMemoryStudyRepository } from './memory.repository';
import { seedEvalCase } from './seed-case';
import { GenerateNextStudySessionUseCase } from '../application/generate-next-session.use-case';
import { scoreRun, persistScoredMetrics } from './score-rubric';
import { RunMetrics } from '../observability/run-trace.types';

export async function runFinalCase(evalCase: EvalCase, evalConfig: EvalConfig): Promise<string> {
  const runId = evalConfig.runId ?? randomUUID();
  const config: EvalConfig = { ...evalConfig, enabled: true, runId, caseId: evalCase.id, mode: 'final' };
  const repo = new InMemoryStudyRepository();
  const { planId } = seedEvalCase(repo, evalCase);
  const moduleRef = await createEvalModule(config, repo);
  const useCase = moduleRef.get(GenerateNextStudySessionUseCase);

  try {
    const session = await useCase.execute(planId, 'DISCUSSION');
    const contentText = JSON.stringify(session.content ?? {});
    const metricsFile = join(process.cwd(), 'artifacts', 'runs', runId, 'metrics.json');
    let metrics: RunMetrics;
    if (existsSync(metricsFile)) {
      metrics = JSON.parse(readFileSync(metricsFile, 'utf8')) as RunMetrics;
    } else {
      metrics = {
        runId,
        caseId: evalCase.id,
        mode: 'final',
        endToEndSuccess: session.stage === 'COMPLETED',
        wallClockMs: 0,
        stageTimingsMs: {},
        retryCount: session.retryCount,
        validationPassed: session.stage === 'COMPLETED',
        sourceCount: session.research?.sources.length ?? 0,
        humanStepsRequired: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    }
    persistScoredMetrics(runId, scoreRun(metrics, evalCase, contentText));
    return runId;
  } finally {
    await moduleRef.close();
  }
}
