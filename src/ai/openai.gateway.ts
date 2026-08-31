import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { AiGateway, GeneratedPlan, PlanGenerationInput } from '../application/ports';
import {
  ArticleReview,
  ArticleGenerationState,
  ConversationPlan,
  CreateConversationPlanInput,
  PodcastMode,
  PodcastScript,
  PodcastGenerationState,
  RawPodcastScript,
  StudyContent,
  StudyPlanTopic,
  TopicResearch,
} from '../domain/models';
import { AiModelConfig } from '../config/ai-model.config';
import { KokoroTtsClient } from '../audio/kokoro-tts.client';
import { LocalAudioService } from '../audio/local-audio.service';
import { buildPlanPrompt } from './prompts/prompts';
import { resolvePrompt } from './prompts/prompt.factory';
import {
  articleReviewSchema,
  articleLessonPlanSchema,
  articleSectionGenerationSchema,
  contentSchema,
  duplicateSchema,
  generatedPlanSchema,
  normalizedPlanInputSchema,
  explanationSectionGenerationSchema,
  sectionReviewSchema,
  topicResearchSchema,
} from './schemas';
import { RunTraceService } from '../observability/run-trace.service';
import {
  buildArticleReviewPrompt,
  buildArticleRevisionPrompt,
} from './prompts/article-review.prompt';
import {
  buildArticlePlannerPrompt,
  buildArticleSectionPrompt,
  buildArticleSectionReviewPrompt,
  buildArticleSectionRevisionPrompt,
} from './prompts/article-generation.prompt';
import { buildExplanationSectionAdapterPrompt } from './prompts/explanation/section-adapter.prompt';

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
    return (await this.json(this.models.aux, prompt, 'duplicate_validation', duplicateSchema))
      .classification;
  }
  async generateContent(topic: StudyPlanTopic, research: TopicResearch): Promise<StudyContent> {
    const plan = await this.json(
      this.models.article,
      buildArticlePlannerPrompt(topic, research),
      'article_lesson_plan',
      articleLessonPlanSchema,
    );
    this.validateArticleLessonPlan(plan.progression);
    let state: ArticleGenerationState = {
      centralQuestion: plan.centralQuestion,
      conceptsEstablished: [],
      terminologyEstablished: [],
      examplesAlreadyUsed: [],
      previousSectionSummary: '',
    };
    const sections: StudyContent['sections'] = [];
    for (let index = 0; index < plan.progression.length; index++) {
      const sectionPlan = plan.progression[index];
      const futureConcepts = plan.progression
        .slice(index + 1)
        .flatMap((section) => section.introduces);
      const stateBefore = state;
      let generated = await this.json(
        this.models.article,
        buildArticleSectionPrompt({
          topic,
          research,
          plan,
          sectionPlan,
          state,
          futureConcepts,
        }),
        'article_section',
        articleSectionGenerationSchema,
      );
      const review = await this.json(
        this.models.aux,
        buildArticleSectionReviewPrompt({
          sectionPlan,
          section: generated.section,
          stateBefore,
          futureConcepts,
        }),
        'article_section_review',
        sectionReviewSchema,
      );
      if (!review.approved) {
        generated = await this.json(
          this.models.article,
          buildArticleSectionRevisionPrompt({
            sectionPlan,
            original: generated.section,
            review,
            state: stateBefore,
            futureConcepts,
          }),
          'article_section_revision',
          articleSectionGenerationSchema,
        );
      }
      if (generated.section.id !== sectionPlan.id) {
        throw new Error(`Article section id mismatch: expected ${sectionPlan.id}`);
      }
      sections.push(generated.section);
      state = generated.state;
    }
    const article: StudyContent = { sections, reviewQuestions: null };
    const review = await this.reviewArticle(topic, research, article);
    return review.approved ? article : this.reviseArticle(topic, research, article, review);
  }
  private validateArticleLessonPlan(progression: Array<{ id: string; dependsOn: string[] }>): void {
    const seen = new Set<string>();
    for (const section of progression) {
      if (seen.has(section.id)) throw new Error(`Duplicate article section id ${section.id}`);
      for (const dependency of section.dependsOn) {
        if (!seen.has(dependency)) {
          throw new Error(
            `Article section ${section.id} depends on unavailable section ${dependency}`,
          );
        }
      }
      seen.add(section.id);
    }
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
    return this.json(this.models.script, resolved.prompt, 'conversation_plan', resolved.schema);
  }
  async generateScript(
    topic: StudyPlanTopic,
    content: StudyContent,
    plan: ConversationPlan,
    mode: PodcastMode,
  ): Promise<RawPodcastScript> {
    if (mode === 'EXPLANATION' && plan.mode === 'EXPLANATION') {
      return this.generateExplanationScriptBySection(topic, content, plan);
    }
    const resolved = resolvePrompt({
      stage: 'podcast-script',
      mode,
      value: { topic, content, plan },
    });
    return this.json(this.models.script, resolved.prompt, 'podcast_script', resolved.schema);
  }
  private async generateExplanationScriptBySection(
    topic: StudyPlanTopic,
    content: StudyContent,
    plan: Extract<ConversationPlan, { mode: 'EXPLANATION' }>,
  ): Promise<RawPodcastScript> {
    let state: PodcastGenerationState = {
      previousSectionClosing: '',
      terminology: [],
      examplesAlreadyUsed: [],
      speakerContext: 'Begin the lesson naturally.',
    };
    const turns: RawPodcastScript['turns'] = [];
    for (let index = 0; index < plan.sections.length; index++) {
      const sectionPlan = plan.sections[index];
      const articleSectionId = sectionPlan.articleSectionId ?? sectionPlan.id;
      const articleIndex = content.sections.findIndex((section) => section.id === articleSectionId);
      if (articleIndex < 0) throw new Error(`Unknown article section ${articleSectionId}`);
      const generated = await this.json(
        this.models.script,
        buildExplanationSectionAdapterPrompt({
          articleGoal: topic.description,
          articleSection: content.sections[articleIndex],
          futureSections: content.sections.slice(articleIndex + 1),
          sectionPlan,
          state,
        }),
        'explanation_section_adapter',
        explanationSectionGenerationSchema,
      );
      for (const turn of generated.turns) {
        if (turn.sectionId !== articleSectionId) {
          throw new Error(`Podcast adapter section id mismatch: expected ${articleSectionId}`);
        }
        turns.push({ ...turn, sequence: turns.length });
      }
      state = generated.state;
    }
    const wordCount = turns.reduce((total, turn) => total + turn.text.split(/\s+/).length, 0);
    return {
      id: `explanation-${topic.slug}`,
      title: topic.title,
      version: 'section-adapter.explanation.v1',
      turns,
      estimatedDurationSeconds: Math.max(1, Math.round((wordCount / 145) * 60)),
    };
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
      voice: voice,
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
      const currentModel = attempts[attempt];
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
    // Route identical retries to the same prompt cache without exposing prompt contents.
    // OpenAI still validates the exact prompt prefix before serving cached input tokens.
    const promptCacheKey = `study-podcast:${name}:${createHash('sha256').update(input).digest('hex')}`;
    const response = await this.client.responses.parse({
      model,
      input,
      prompt_cache_key: promptCacheKey,
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
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
      outputTokens: response.usage?.output_tokens,
      webSearch,
    });
    if (!response.output_parsed) throw new Error(`OpenAI returned no parsed ${name} output`);
    return schema.parse(response.output_parsed);
  }
}
