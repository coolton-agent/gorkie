import type { ModelWithRetries } from '@mastra/core/agent';
import { env } from '@/env';

function hackclub(modelId: string) {
  return {
    id: `openrouter/${modelId}` as const,
    url: 'https://ai.hackclub.com/proxy/v1',
    apiKey: env.HACKCLUB_API_KEY,
  };
}

function opencode(modelId: string) {
  return `opencode-go/${modelId}` as const;
}

export const orchestrator: ModelWithRetries[] = [
  { model: hackclub('openai/gpt-5.6-luna'), maxRetries: 3 },
  { model: opencode('gpt-5.6-luna'), maxRetries: 3 },
];

export const summarizer: ModelWithRetries[] = [
  { model: hackclub('google/gemini-3.5-flash-lite'), maxRetries: 3 },
  { model: hackclub('xiaomi/mimo-v2.5'), maxRetries: 3 },
  { model: opencode('mimo-v2.5'), maxRetries: 3 },
];

export const scout: ModelWithRetries[] = [
  { model: hackclub('openai/gpt-5.6-luna'), maxRetries: 3 },
  { model: opencode('gpt-5.6-luna'), maxRetries: 3 },
];

export const explorer: ModelWithRetries[] = [
  { model: hackclub('openai/gpt-5.6-luna'), maxRetries: 3 },
  { model: opencode('gpt-5.6-luna'), maxRetries: 3 },
];

export const images = {
  model: 'google/gemini-3.1-flash-image',
  baseURL: 'https://ai.hackclub.com/proxy/v1',
};
