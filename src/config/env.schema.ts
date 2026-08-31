import { z } from 'zod';
import { isNotionPageId, normalizeNotionPageId } from './notion-page-id';

export const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    STUDY_PLAN_CREATE_TOKEN: z.string().min(8),
    DATABASE_URL: z.string().default('file:./data/app.db'),
    REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
    LOCAL_PROGRESS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    LOCAL_PROGRESS_CRON: z.string().default('0 */12 * * *'),
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_CONTENT_MODEL: z.string().default('gpt-5.5'),
    OPENAI_PLANNING_MODEL: z.string().default('gpt-5.5'),
    OPENAI_VALIDATION_MODEL: z.string().default('gpt-5.5'),
    OPENAI_CONVERSATION_PLAN_MODEL: z.string().default('gpt-5.5'),
    OPENAI_SCRIPT_MODEL: z.string().default('gpt-5.5'),
    OPENAI_POLISH_MODEL: z.string().default('gpt-5.5'),
    OPENAI_TTS_MODEL: z.string().default('gpt-4o-mini-tts'),
    NOTION_API_KEY: z.string().min(1),
    NOTION_PARENT_PAGE_ID: z
      .string()
      .min(1)
      .transform(normalizeNotionPageId)
      .refine(isNotionPageId, {
        message:
          'NOTION_PARENT_PAGE_ID must contain a valid Notion page UUID (32 hex chars, no slug prefix)',
      }),
    DISCORD_WEBHOOK_URL: z.string().url(),
    DISCORD_MAX_ATTACHMENT_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(25 * 1024 * 1024),
    PODCAST_CRON: z.string().default('0 12 * * 2,5'),
    PODCAST_TIMEZONE: z.string().default('America/Sao_Paulo'),
    PODCAST_TARGET_MINUTES: z.coerce.number().int().min(5).max(60).default(30),
    DEFAULT_PODCAST_MODE: z.enum(['INTERVIEW', 'DISCUSSION']).default('DISCUSSION'),
    PODCAST_MAX_TURN_CHARACTERS: z.coerce.number().int().positive().default(1200),
    PODCAST_MIN_TURNS: z.coerce.number().int().positive().default(35),
    PODCAST_MAX_TURNS: z.coerce.number().int().positive().default(120),
    PODCAST_INTERVIEWER_VOICE: z.string().default('alloy'),
    PODCAST_CANDIDATE_VOICE: z.string().default('coral'),
    PODCAST_HOST_VOICE: z.string().default('alloy'),
    PODCAST_ENGINEER_A_VOICE: z.string().default('alloy'),
    PODCAST_ENGINEER_B_VOICE: z.string().default('coral'),
    FFMPEG_PATH: z.string().default('ffmpeg'),
    AUDIO_STORAGE_PATH: z.string().default('./storage/podcasts'),
    AUDIO_PUBLIC_BASE_URL: z.string().url(),
    DASHBOARD_PUBLIC_BASE_URL: z.string().url().optional(),
    AUDIO_STORAGE_BACKEND: z.enum(['local', 'google_drive']).default('local'),
    GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
    GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
    GOOGLE_DRIVE_ROOT_FOLDER: z.string().min(1).default('AI Study Podcasts'),
    GOOGLE_DRIVE_PUBLIC_SHARING: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.AUDIO_STORAGE_BACKEND !== 'google_drive') return;
    for (const key of [
      'GOOGLE_DRIVE_CLIENT_ID',
      'GOOGLE_DRIVE_CLIENT_SECRET',
      'GOOGLE_DRIVE_REFRESH_TOKEN',
    ] as const) {
      if (!env[key]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is required when AUDIO_STORAGE_BACKEND=google_drive`,
          path: [key],
        });
      }
    }
  });
export type Environment = z.infer<typeof envSchema>;
export function validateEnvironment(input: Record<string, unknown>): Environment {
  return envSchema.parse(input);
}
