import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { ModelWithRetries } from '@mastra/core/agent';
import { env } from '@/env';

export const hackclubBaseUrl = 'https://ai.hackclub.com/proxy/v1';

const hackclubProvider = createOpenAICompatible({
  name: 'hackclub',
  baseURL: hackclubBaseUrl,
  apiKey: env.HACKCLUB_API_KEY,
});

function hackclub(model: string): LanguageModelV4 {
  return hackclubProvider.chatModel(model);
}

const opencodeProvider = createOpenAICompatible({
  name: 'opencode-go',
  baseURL: 'https://opencode.ai/zen/go/v1',
  apiKey: env.OPENCODE_API_KEY,
});

function opencode(model: string): LanguageModelV4 {
  return opencodeProvider.chatModel(model);
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

export const images = hackclubProvider.imageModel(
  'google/gemini-3.1-flash-image'
);
