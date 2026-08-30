import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AiGateway, GeneratedPlan, PlanGenerationInput } from '../application/ports';
import {
  ConversationPlan,
  CreateConversationPlanInput,
  PodcastMode,
  PodcastScript,
  RawPodcastScript,
  StudyContent,
  StudyPlanTopic,
  TopicResearch,
} from '../domain/models';
import { AiModelConfig } from '../config/ai-model.config';
import { LocalAudioService } from '../audio/local-audio.service';
import { buildContentPrompt, buildPlanPrompt } from './prompts/prompts';
import { resolvePrompt } from './prompts/prompt.factory';
import {
  contentSchema,
  duplicateSchema,
  generatedPlanSchema,
  topicResearchSchema,
} from './schemas';
import { RunTraceService } from '../observability/run-trace.service';

@Injectable()
export class OpenAiGateway implements AiGateway {
  private readonly client: OpenAI;
  constructor(
    config: ConfigService,
    private readonly models: AiModelConfig,
    private readonly audio: LocalAudioService,
    @Optional() private readonly trace?: RunTraceService,
  ) {
    this.client = new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }
  async generatePlan(input: PlanGenerationInput): Promise<GeneratedPlan> {
    return this.json(
      this.models.planning,
      buildPlanPrompt(input),
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
  async researchTopic(topic: StudyPlanTopic): Promise<TopicResearch> {
    const prompt = `Research the study topic ${JSON.stringify({ title: topic.title, description: topic.description, objectives: topic.learningObjectives })}. Use web search to produce a current, concise factual foundation shared by the article and podcast. Prefer primary and authoritative sources: official documentation, standards, original papers, books, and first-party engineering publications. Every source must have been returned by web search, use its canonical URL, and directly support the research. Do not rely on model memory for facts that may have changed and never invent, guess, or reconstruct a URL.`;
    return this.json(this.models.content, prompt, 'topic_research', topicResearchSchema, true);
  }
  async createConversationPlan(
    input: CreateConversationPlanInput,
    mode: PodcastMode,
  ): Promise<ConversationPlan> {
    const resolved = resolvePrompt({ stage: 'conversation-plan', mode, value: input });
    return this.json(
      this.models.conversationPlan,
      resolved.prompt,
      'conversation_plan',
      resolved.schema,
    );
  }
  async generateScript(
    content: StudyContent,
    plan: ConversationPlan,
    mode: PodcastMode,
  ): Promise<RawPodcastScript> {
    const resolved = resolvePrompt({ stage: 'podcast-script', mode, value: { content, plan } });
    return this.json(this.models.podcast, resolved.prompt, 'podcast_script', resolved.schema);
  }
  async polishDialogue(script: RawPodcastScript, mode: PodcastMode): Promise<PodcastScript> {
    const resolved = resolvePrompt({ stage: 'dialogue-polisher', mode, value: script });
    return this.json(this.models.polish, resolved.prompt, 'polished_dialogue', resolved.schema);
  }
  async generateSpeech(
    text: string,
    voice: string,
    instructions: string | undefined,
    destination: string,
  ): Promise<void> {
    const speech = await this.client.audio.speech.create({
      model: this.models.tts,
      voice,
      input: text,
      instructions,
      response_format: 'mp3',
    });
    await this.audio.save(destination, [Buffer.from(await speech.arrayBuffer())]);
  }
  private async json<T>(
    model: string,
    input: string,
    name: string,
    schema: z.ZodType<T>,
    webSearch = false,
  ): Promise<T> {
    const response = await this.client.responses.parse({
      model,
      input,
      text: { format: zodTextFormat(schema, name) },
      ...(webSearch
        ? {
            tools: [{ type: 'web_search' as const }],
            tool_choice: 'required' as const,
          }
        : {}),
    });
    this.trace?.recordOpenAiCall({
      model,
      name,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      webSearch,
    });
    if (!response.output_parsed) throw new Error(`OpenAI returned no parsed ${name} output`);
    return schema.parse(response.output_parsed);
  }
}
