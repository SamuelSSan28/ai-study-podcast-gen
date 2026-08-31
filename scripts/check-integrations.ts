#!/usr/bin/env ts-node
/**
 * Validates external integrations using environment variables.
 * Prints pass/fail only — never logs secrets.
 */
import 'dotenv/config';
import { isNotionPageId, normalizeNotionPageId } from '../src/config/notion-page-id';

type CheckResult = { name: string; ok: boolean; detail: string };

async function checkOpenAi(): Promise<CheckResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { name: 'OpenAI', ok: false, detail: 'OPENAI_API_KEY missing' };
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (response.ok) return { name: 'OpenAI', ok: true, detail: `HTTP ${response.status}` };
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  return {
    name: 'OpenAI',
    ok: false,
    detail: body.error?.message ?? `HTTP ${response.status}`,
  };
}

async function checkNotion(): Promise<CheckResult> {
  const key = process.env.NOTION_API_KEY;
  const raw = process.env.NOTION_PARENT_PAGE_ID;
  const pageId = raw ? normalizeNotionPageId(raw) : undefined;
  if (!key || !pageId) {
    return { name: 'Notion', ok: false, detail: 'NOTION_API_KEY or NOTION_PARENT_PAGE_ID missing' };
  }
  if (!isNotionPageId(pageId)) {
    return {
      name: 'Notion',
      ok: false,
      detail: `invalid page ID "${raw}" — use only the 32-character UUID from the Notion URL`,
    };
  }
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': '2022-06-28',
    },
  });
  if (response.ok) return { name: 'Notion', ok: true, detail: `page accessible (HTTP ${response.status})` };
  const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  return {
    name: 'Notion',
    ok: false,
    detail: body.message ?? body.code ?? `HTTP ${response.status}`,
  };
}

async function checkDiscord(): Promise<CheckResult> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { name: 'Discord', ok: false, detail: 'DISCORD_WEBHOOK_URL missing' };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: '✅ Integration check — ai-study-podcast-gen' }),
  });
  if (response.ok || response.status === 204) {
    return { name: 'Discord', ok: true, detail: `webhook accepted (HTTP ${response.status})` };
  }
  return { name: 'Discord', ok: false, detail: `HTTP ${response.status}` };
}

async function checkApi(): Promise<CheckResult> {
  const token = process.env.STUDY_PLAN_CREATE_TOKEN;
  const port = process.env.PORT ?? '3000';
  if (!token) return { name: 'API', ok: false, detail: 'STUDY_PLAN_CREATE_TOKEN missing' };
  try {
    const response = await fetch(`http://127.0.0.1:${port}/study-plans?token=${encodeURIComponent(token)}`);
    if (response.ok) return { name: 'API', ok: true, detail: `GET /study-plans HTTP ${response.status}` };
    return { name: 'API', ok: false, detail: `GET /study-plans HTTP ${response.status}` };
  } catch (error) {
    return {
      name: 'API',
      ok: false,
      detail: error instanceof Error ? error.message : 'connection failed',
    };
  }
}

function checkEnv(): CheckResult[] {
  const token = process.env.STUDY_PLAN_CREATE_TOKEN ?? '';
  const checks: CheckResult[] = [];
  if (token.length < 8) {
    checks.push({
      name: 'Env',
      ok: false,
      detail: 'STUDY_PLAN_CREATE_TOKEN must be at least 8 characters',
    });
  }
  if (!process.env.AUDIO_PUBLIC_BASE_URL) {
    checks.push({ name: 'Env', ok: false, detail: 'AUDIO_PUBLIC_BASE_URL missing' });
  }
  if ((process.env.AUDIO_STORAGE_BACKEND ?? 'local') === 'local') {
    checks.push({ name: 'Env', ok: true, detail: 'AUDIO_STORAGE_BACKEND=local (Google Drive not required)' });
  }
  return checks;
}

async function main(): Promise<void> {
  const results: CheckResult[] = [
    ...checkEnv(),
    await checkOpenAi(),
    await checkNotion(),
    await checkDiscord(),
    await checkApi(),
  ];

  console.log('\nIntegration validation\n');
  for (const result of results) {
    console.log(`${result.ok ? '✅' : '❌'} ${result.name}: ${result.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
