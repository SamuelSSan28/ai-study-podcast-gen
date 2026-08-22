import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AiGateway, GeneratedPlan, PlanGenerationInput } from '../application/ports';
import { ScriptTurn, StudyContent, StudyPlanTopic } from '../domain/models';
import { AiModelConfig } from '../config/ai-model.config';
import { LocalAudioService } from '../audio/local-audio.service';
import { buildTtsChunks } from '../audio/tts-chunker';
import { buildContentPrompt, buildPlanPrompt, buildScriptPrompt } from './prompts/prompts';
import { contentSchema, duplicateSchema, generatedPlanSchema, scriptSchema } from './schemas';

@Injectable()
export class OpenAiGateway implements AiGateway {
  private readonly client: OpenAI;
  constructor(
    config: ConfigService,
    private readonly models: AiModelConfig,
    private readonly audio: LocalAudioService,
  ) {
    this.client = new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }
  async generatePlan(input: PlanGenerationInput, context: string): Promise<GeneratedPlan> {
    return this.json(
      this.models.planning,
      buildPlanPrompt(input, context),
      'study_plan',
      generatedPlanSchema,
    );
  }
  async validateDuplicate(
    candidate: StudyPlanTopic,
    history: StudyPlanTopic[],
  ): Promise<'NEW' | 'RELATED_BUT_DEEPER' | 'DUPLICATE'> {
    const prompt = `Classify candidate as NEW, RELATED_BUT_DEEPER, or DUPLICATE. Preserve legitimate progression. Candidate: ${JSON.stringify(candidate)} History summaries: ${JSON.stringify(history.map(({ title, summary, tags, depthDelta }) => ({ title, summary, tags, depthDelta })))}`;
    return (
      await this.json(this.models.validation, prompt, 'duplicate_validation', duplicateSchema)
    ).classification;
  }
  async generateContent(topic: StudyPlanTopic, context: string): Promise<StudyContent> {
    return this.json(
      this.models.content,
      buildContentPrompt(topic, context),
      'study_content',
      contentSchema,
    );
  }
  async generateScript(
    topic: StudyPlanTopic,
    content: StudyContent,
    minutes: number,
  ): Promise<ScriptTurn[]> {
    return (
      await this.json(
        this.models.podcast,
        buildScriptPrompt(topic, content, minutes),
        'podcast_script',
        scriptSchema,
      )
    ).turns;
  }
  async generateSpeech(turns: ScriptTurn[], destination: string): Promise<void> {
    const chunks: Buffer[] = [];
    for (const turn of buildTtsChunks(turns)) {
      const voice = turn.speaker === 'CANDIDATE' ? 'coral' : 'alloy';
      const speech = await this.client.audio.speech.create({
        model: this.models.tts,
        voice,
        input: `${turn.speaker}: ${turn.text}`,
        response_format: 'mp3',
      });
      chunks.push(Buffer.from(await speech.arrayBuffer()));
    }
    await this.audio.save(destination, chunks);
  }
  private async json<T>(
    model: string,
    input: string,
    name: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const response = await this.client.responses.parse({
      model,
      input,
      text: { format: zodTextFormat(schema, name) },
    });
    if (!response.output_parsed) throw new Error(`OpenAI returned no parsed ${name} output`);
    return schema.parse(response.output_parsed);
  }
}
