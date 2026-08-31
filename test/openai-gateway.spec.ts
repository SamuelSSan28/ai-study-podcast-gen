import { OpenAiGateway } from '../src/ai/openai.gateway';

describe('OpenAiGateway research', () => {
  it('requires web search and returns structured sources', async (): Promise<void> => {
    const parse = jest.fn().mockResolvedValue({
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
  });
});
