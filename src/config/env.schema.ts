import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  STUDY_PLAN_CREATE_TOKEN: z.string().min(8),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_CONTENT_MODEL: z.string().default('gpt-5.6-luna'),
  OPENAI_PLANNING_MODEL: z.string().default('gpt-5.6-luna'),
  OPENAI_VALIDATION_MODEL: z.string().default('gpt-5.6-luna'),
  OPENAI_TTS_MODEL: z.string().default('gpt-4o-mini-tts'),
  NOTION_API_KEY: z.string().min(1),
  NOTION_STUDY_PLANS_DATABASE_ID: z.string().min(1),
  NOTION_SESSIONS_DATABASE_ID: z.string().min(1),
  NOTION_PARENT_PAGE_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url(),
  PODCAST_CRON: z.string().default('0 12 * * 2,5'),
  PODCAST_TIMEZONE: z.string().default('America/Sao_Paulo'),
  PODCAST_TARGET_MINUTES: z.coerce.number().int().min(5).max(60).default(30),
  KNOWLEDGE_BASE_PATH: z.string().default('./knowledge'),
  AUDIO_STORAGE_PATH: z.string().default('./storage/podcasts'),
  AUDIO_PUBLIC_BASE_URL: z.string().url(),
});
export type Environment = z.infer<typeof envSchema>;
export function validateEnvironment(input: Record<string, unknown>): Environment {
  return envSchema.parse(input);
}
