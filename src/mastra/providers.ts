import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { ModelWithRetries } from '@mastra/core/agent';
import { env } from '@/env';

const hackClubProvider = createOpenAICompatible({
  name: 'hackclub',
  baseURL: 'https://ai.hackclub.com/proxy/v1',
  apiKey: env.HACKCLUB_API_KEY,
});

function hackclub(model: string): LanguageModelV4 {
  return hackClubProvider.chatModel(model);
}

const openCodeProvider = createOpenAICompatible({
  name: 'opencode-go',
  baseURL: 'https://opencode.ai/zen/go/v1',
  apiKey: env.OPENCODE_API_KEY,
});

function opencode(model: string): LanguageModelV4 {
  return openCodeProvider.chatModel(model);
}

export const orchestrator: ModelWithRetries[] = [
  { model: hackclub('openai/gpt-5.6-luna'), maxRetries: 3 },
  { model: opencode('gpt-5.6-luna'), maxRetries: 3 },
];

// mimo-v2-omni stands in for gemini-flash-lite; OpenCode Go has no Google models.
export const summarizer: ModelWithRetries[] = [
  { model: hackclub('google/gemini-3.5-flash-lite'), maxRetries: 3 },
  { model: hackclub('xiaomi/mimo-v2.5'), maxRetries: 3 },
  { model: hackclub('minimax/minimax-m3'), maxRetries: 3 },
  { model: opencode('mimo-v2-omni'), maxRetries: 3 },
  { model: opencode('mimo-v2.5'), maxRetries: 3 },
  { model: opencode('minimax-m3'), maxRetries: 3 },
];

export const scout: ModelWithRetries[] = [
  { model: hackclub('openai/gpt-5.6-luna'), maxRetries: 3 },
  { model: opencode('gpt-5.6-luna'), maxRetries: 3 },
];

export const explorer: ModelWithRetries[] = [
  { model: hackclub('openai/gpt-5.6-luna'), maxRetries: 3 },
  { model: opencode('gpt-5.6-luna'), maxRetries: 3 },
];

export const images = hackClubProvider.imageModel(
  'google/gemini-3.1-flash-image'
);
