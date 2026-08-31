import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AiGateway, GeneratedPlan, PlanGenerationInput } from '../application/ports';
import {
  ArticleReview,
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
import { KokoroTtsClient } from '../audio/kokoro-tts.client';
import { LocalAudioService } from '../audio/local-audio.service';
import { buildContentPrompt, buildPlanPrompt } from './prompts/prompts';
import { resolvePrompt } from './prompts/prompt.factory';
import {
  articleReviewSchema,
  contentSchema,
  duplicateSchema,
  generatedPlanSchema,
  normalizedPlanInputSchema,
  topicResearchSchema,
} from './schemas';
import { RunTraceService } from '../observability/run-trace.service';
import {
  buildArticleReviewPrompt,
  buildArticleRevisionPrompt,
} from './prompts/article-review.prompt';

@Injectable()
export class OpenAiGateway implements AiGateway {
  private readonly client: OpenAI;
  constructor(
    config: ConfigService,
    private readonly models: AiModelConfig,
    private readonly audio: LocalAudioService,
    private readonly kokoro: KokoroTtsClient,
    @Optional() private readonly trace?: RunTraceService,
  ) {
    this.client = new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }
  async generatePlan(input: PlanGenerationInput): Promise<GeneratedPlan> {
    const normalized = await this.normalizePlanInput(input);
    return this.json(
      this.models.roadmap,
      buildPlanPrompt(normalized),
      'study_plan',
      generatedPlanSchema,
    );
  }
  async validateDuplicate(
    candidate: StudyPlanTopic,
    history: StudyPlanTopic[],
  ): Promise<'NEW' | 'RELATED_BUT_DEEPER' | 'DUPLICATE'> {
    const prompt = `Classify the candidate as NEW, RELATED_BUT_DEEPER, or DUPLICATE. Preserve legitimate progression. Candidate: ${JSON.stringify(candidate)} Summary history: ${JSON.stringify(history.map(({ title, summary, tags, depthDelta }) => ({ title, summary, tags, depthDelta })))}`;
    return (
      await this.json(this.models.aux, prompt, 'duplicate_validation', duplicateSchema)
    ).classification;
  }
  async generateContent(topic: StudyPlanTopic, context: string): Promise<StudyContent> {
    return this.json(
      this.models.article,
      buildContentPrompt(topic, context),
      'study_content',
      contentSchema,
    );
  }
  async reviewArticle(
    topic: StudyPlanTopic,
    research: TopicResearch,
    article: StudyContent,
  ): Promise<ArticleReview> {
    return this.json(
      this.models.article,
      buildArticleReviewPrompt(topic, research, article),
      'article_review',
      articleReviewSchema,
    );
  }
  async reviseArticle(
    topic: StudyPlanTopic,
    research: TopicResearch,
    article: StudyContent,
    review: ArticleReview,
  ): Promise<StudyContent> {
    return this.json(
      this.models.article,
      buildArticleRevisionPrompt(topic, research, article, review),
      'article_revision',
      contentSchema,
    );
  }
  async researchTopic(topic: StudyPlanTopic): Promise<TopicResearch> {
    const prompt = `Research the study topic ${JSON.stringify({ title: topic.title, description: topic.description, objectives: topic.learningObjectives })}. Use web search to produce a current, concise factual base for the article on this topic only. Stay inside the topic scope — do not research adjacent libraries, tools, or future curriculum concepts. The podcast script will derive solely from the generated article. Prefer primary, authoritative sources: official documentation, standards, original papers, books, and first-hand engineering publications. Each source must have been returned by search, use its canonical URL, and directly support the research. Do not rely on model memory for facts that may have changed and never invent, guess, or reconstruct a URL.`;
    const research = await this.json(
      this.models.article,
      prompt,
      'topic_research',
      topicResearchSchema,
      true,
    );
    return {
      ...research,
      sources: research.sources.filter((source) => {
        try {
          const parsed = new URL(source.url);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      }),
    };
  }
  async createConversationPlan(
    input: CreateConversationPlanInput,
    mode: PodcastMode,
  ): Promise<ConversationPlan> {
    const resolved = resolvePrompt({ stage: 'conversation-plan', mode, value: input });
    return this.json(
      this.models.script,
      resolved.prompt,
      'conversation_plan',
      resolved.schema,
    );
  }
  async generateScript(
    topic: StudyPlanTopic,
    content: StudyContent,
    plan: ConversationPlan,
    mode: PodcastMode,
  ): Promise<RawPodcastScript> {
    const resolved = resolvePrompt({
      stage: 'podcast-script',
      mode,
      value: { topic, content, plan },
    });
    return this.json(this.models.script, resolved.prompt, 'podcast_script', resolved.schema);
  }
  async polishDialogue(
    script: RawPodcastScript,
    mode: PodcastMode,
    context?: { article: StudyContent; plan: ConversationPlan },
  ): Promise<PodcastScript> {
    const resolved = resolvePrompt({
      stage: 'dialogue-polisher',
      mode,
      value: context ? { ...context, rawScript: script } : script,
    });
    return this.json(this.models.script, resolved.prompt, 'polished_dialogue', resolved.schema);
  }
  async generateSpeech(
    text: string,
    voice: string,
    instructions: string | undefined,
    destination: string,
    speed?: number,
  ): Promise<void> {
    if (this.models.ttsProvider === 'kokoro') {
      const audio = await this.kokoro.synthesize(text, voice, speed);
      await this.audio.save(destination, [audio]);
      return;
    }
    const speech = await this.client.audio.speech.create({
      model: this.models.openAiTtsModel,
      voice: voice as 'alloy',
      input: text,
      instructions,
      response_format: 'mp3',
    });
    await this.audio.save(destination, [Buffer.from(await speech.arrayBuffer())]);
  }
  private async normalizePlanInput(input: PlanGenerationInput): Promise<PlanGenerationInput> {
    const prompt = `Normalize this study plan request into a clear title and a concrete learning goal. Preserve the learner's intent, fix typos, and clarify vague goals without changing scope. Input: ${JSON.stringify({ title: input.title, goal: input.goal })}`;
    const normalized = await this.json(
      this.models.aux,
      prompt,
      'normalized_plan_input',
      normalizedPlanInputSchema,
    );
    return { ...input, title: normalized.title, goal: normalized.goal };
  }
  private async json<T>(
    model: string,
    input: string,
    name: string,
    schema: z.ZodType<T>,
    webSearch = false,
  ): Promise<T> {
    const attempts = [model, model, this.models.fallback];
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts.length; attempt++) {
      const currentModel = attempts[attempt]!;
      try {
        return await this.callJson(currentModel, input, name, schema, webSearch);
      } catch (error) {
        lastError = error;
        if (attempt === attempts.length - 1) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`OpenAI ${name} failed`);
  }
  private async callJson<T>(
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
