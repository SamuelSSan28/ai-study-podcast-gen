import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { EvalCase } from './eval-case.types';
import { EvalConfig } from '../observability/eval-config';
import { RunTraceService } from '../observability/run-trace.service';
import { scoreRun, persistScoredMetrics } from './score-rubric';
import { z } from 'zod';

const baselineScriptSchema = z.object({
  overview: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
    }),
  ),
  podcastTurns: z.array(
    z.object({
      speaker: z.string(),
      text: z.string(),
    }),
  ),
});

/**
 * Degraded baseline: one generic prompt produces content + script without orchestration.
 */
export async function runBaselineCase(
  evalCase: EvalCase,
  evalConfig: EvalConfig,
): Promise<string> {
  const trace = new RunTraceService({ ...evalConfig, enabled: true, mode: 'baseline' });
  const runId = evalConfig.runId ?? randomUUID();
  trace.beginRun({ runId, caseId: evalCase.id, mode: 'baseline' });

  const config = new ConfigService(process.env);
  const client = new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  const model = config.get<string>('ARTICLE_MODEL', 'gpt-5.6-terra');

  try {
    trace.startStage('generic_generation');
    const prompt = `Create study material and a short podcast script for this topic in ONE response.
Topic title: ${evalCase.topic.title}
Description: ${evalCase.topic.description}
Learning objectives: ${evalCase.topic.learningObjectives.join(', ')}
Goal context: ${evalCase.goal}
Do not use external tools. Return structured JSON only.`;

    const response = await client.responses.parse({
      model,
      input: prompt,
      text: { format: zodTextFormat(baselineScriptSchema, 'baseline_session') },
    });
    trace.recordOpenAiCall({
      model,
      name: 'baseline_session',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      webSearch: false,
    });
    trace.endStage('generic_generation');

    const parsed = baselineScriptSchema.parse(response.output_parsed);
    const contentText = JSON.stringify(parsed);

    if (!evalConfig.skipAudio) {
      trace.startStage('audio');
      trace.endStage('audio', { skipped: true, note: 'baseline uses no TTS pipeline' });
    }

    const metrics = trace.finishRun({ success: true });
    if (metrics) {
      const scored = scoreRun(metrics, evalCase, contentText);
      persistScoredMetrics(runId, scored);
    }
    return runId;
  } catch (error) {
    trace.finishRun({
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Baseline failed',
    });
    throw error;
  }
}
