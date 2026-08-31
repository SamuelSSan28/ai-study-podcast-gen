import { validateEnvironment } from '../src/config/env.schema';

describe('validateEnvironment model routing', () => {
  const base = {
    STUDY_PLAN_CREATE_TOKEN: 'test-token-123',
    OPENAI_API_KEY: 'sk-test',
    NOTION_API_KEY: 'secret_test',
    NOTION_PARENT_PAGE_ID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/a',
    DISCORD_WEBHOOK_ERRORS_URL: 'https://discord.com/api/webhooks/2/b',
    AUDIO_PUBLIC_BASE_URL: 'http://localhost:3000/audio',
  };

  it('applies simplified model defaults', () => {
    const env = validateEnvironment(base);
    expect(env.ROADMAP_MODEL).toBe('gpt-5.6-terra');
    expect(env.ARTICLE_MODEL).toBe('gpt-5.6-terra');
    expect(env.SCRIPT_MODEL).toBe('gpt-5.6-terra');
    expect(env.AUX_MODEL).toBe('gpt-5.6-luna');
    expect(env.FALLBACK_MODEL).toBe('gpt-5.6-sol');
    expect(env.TTS_PROVIDER).toBe('kokoro');
  });

  it('maps legacy OPENAI_* model vars when simplified vars are omitted', () => {
    const env = validateEnvironment({
      ...base,
      OPENAI_PLANNING_MODEL: 'legacy-plan',
      OPENAI_CONTENT_MODEL: 'legacy-content',
      OPENAI_SCRIPT_MODEL: 'legacy-script',
      OPENAI_VALIDATION_MODEL: 'legacy-aux',
    });
    expect(env.ROADMAP_MODEL).toBe('legacy-plan');
    expect(env.ARTICLE_MODEL).toBe('legacy-content');
    expect(env.SCRIPT_MODEL).toBe('legacy-script');
    expect(env.AUX_MODEL).toBe('legacy-aux');
  });
});
