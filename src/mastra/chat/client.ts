import { retryPolicies } from '@slack/web-api';
import { env } from '@/env';
import { chatLogger } from '../lib/logger/chat';
import { SlackAgentAdapter } from './adapter';
import { content } from './content';

export const slack = new SlackAgentAdapter({
  mode: 'socket',
  agentView: true,
  appToken: env.SLACK_APP_TOKEN,
  botToken: env.SLACK_BOT_TOKEN,
  logger: chatLogger,
  suggestedPrompts: { prompts: content.starters },
  // The WebClient defaults to ten retries over ~30 minutes, so one throttled
  // call can hold a turn open long past the point the user gave up on it.
  webClientOptions: {
    retryConfig: retryPolicies.fiveRetriesInFiveMinutes,
    timeout: 15_000,
  },
});
