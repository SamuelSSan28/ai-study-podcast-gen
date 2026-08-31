import { OpenAiGateway } from '../src/ai/openai.gateway';

function promptCacheKey(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('prompt_cache_key' in value) ||
    typeof value.prompt_cache_key !== 'string'
  ) {
    throw new Error('Expected an OpenAI request with a prompt cache key');
  }
  return value.prompt_cache_key;
}

describe('OpenAiGateway research', () => {
  it('requires web search and returns structured sources', async (): Promise<void> => {
    const requests: unknown[] = [];
    const parse = jest.fn((request: unknown) => {
      requests.push(request);
      return Promise.resolve({
        output_parsed: {
          summary: 'Current summary',
          keyConcepts: ['Web-grounded research'],
          sources: [
            {
              title: 'Official documentation',
              url: 'https://example.com/docs',
              publisher: 'Example',
              type: 'OFFICIAL_DOCUMENTATION',
            },
          ],
        },
      });
    });
    const gateway = Object.create(OpenAiGateway.prototype) as OpenAiGateway;
    Object.assign(gateway, {
      models: { article: 'gpt-5.6-terra' },
      client: { responses: { parse } },
    });

    const result = await gateway.researchTopic({
      title: 'Responses API web search',
      description: 'Research current sources',
      learningObjectives: ['Find authoritative documentation'],
    } as never);

    expect(result.sources).toHaveLength(1);
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.6-terra',
        tools: [{ type: 'web_search' }],
        tool_choice: 'required',
      }),
    );
    expect(promptCacheKey(requests[0])).toMatch(/^study-podcast:topic_research:[a-f0-9]{64}$/);
  });

  it('reuses the prompt cache key when retrying the primary model', async (): Promise<void> => {
    const requests: unknown[] = [];
    const parse = jest.fn((request: unknown) => {
      requests.push(request);
      if (requests.length === 1) return Promise.reject(new Error('transient failure'));
      return Promise.resolve({
        output_parsed: {
          summary: 'Current summary',
          keyConcepts: ['Cached retry'],
          sources: [
            {
              title: 'Prompt caching guide',
              url: 'https://example.com/prompt-caching',
              publisher: 'Example',
              type: 'OFFICIAL_DOCUMENTATION',
            },
          ],
        },
        usage: {
          input_tokens: 1_500,
          output_tokens: 100,
          input_tokens_details: { cached_tokens: 1_024 },
        },
      });
    });
    const recordOpenAiCall = jest.fn();
    const gateway = Object.create(OpenAiGateway.prototype) as OpenAiGateway;
    Object.assign(gateway, {
      models: { article: 'gpt-5.6-terra', fallback: 'gpt-5.6-sol' },
      client: { responses: { parse } },
      trace: { recordOpenAiCall },
    });

    await gateway.researchTopic({
      title: 'Responses API prompt caching',
      description: 'Reuse the prompt prefix on retry',
      learningObjectives: ['Reduce retry input cost'],
    } as never);

    expect(parse).toHaveBeenCalledTimes(2);
    expect(promptCacheKey(requests[0])).toBe(promptCacheKey(requests[1]));
    expect(recordOpenAiCall).toHaveBeenCalledWith(
      expect.objectContaining({ cachedInputTokens: 1_024 }),
    );
  });
});
