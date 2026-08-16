import {
  defaultTypingStatus,
  type TypingStatusFn,
} from '@mastra/core/channels';
import { label } from '../../lib/label';
import type { Args } from './format';
import { truncate } from './format';
import { statuses } from './statuses';

export const status: TypingStatusFn = (chunk, context) => {
  if (chunk.type !== 'tool-call') {
    return defaultTypingStatus(chunk, context);
  }

  const { toolName } = chunk.payload;
  if (context.channelTools.has(toolName)) {
    return false;
  }

  if (toolName.startsWith('agent-')) {
    return truncate(
      `is spawning a ${label(toolName.slice(6)).toLowerCase()} agent…`,
      50
    );
  }

  const args = (chunk.payload.args as Args | undefined) ?? {};
  const known = statuses[toolName]?.(args);
  if (known) {
    return truncate(known, 50);
  }

  return truncate(`is using ${label(toolName).toLowerCase()}…`, 50);
};
