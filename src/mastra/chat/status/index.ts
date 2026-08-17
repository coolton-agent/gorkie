import {
  defaultTypingStatus,
  type TypingStatusFn,
} from '@mastra/core/channels';
import { label } from '../../lib/label';
import type { Args } from './format';
import { truncate } from './format';
import { statuses } from './statuses';

// `agent-<id>` (agent.ts: `id: \`agent-${agentName}\``) is the spawn call
// itself. Once spawned, the sub-agent's OWN tool calls also arrive here
// namespaced as `agent-<id>_<childToolName>` (observed live: a real
// "agent-research_get_permalink" tool-call chunk), so a bare startsWith
// check alone renders both the same way ("research get permalink agent").
const delegationAgentIds = new Set(['research', 'explore']);

function delegatedChildTool(
  rest: string
): { agentId: string; childToolName: string } | undefined {
  for (const agentId of delegationAgentIds) {
    const prefix = `${agentId}_`;
    if (rest.startsWith(prefix)) {
      return { agentId, childToolName: rest.slice(prefix.length) };
    }
  }
}

export const status: TypingStatusFn = (chunk, context) => {
  if (chunk.type !== 'tool-call') {
    return defaultTypingStatus(chunk, context);
  }

  const { toolName } = chunk.payload;
  if (context.channelTools.has(toolName)) {
    return false;
  }

  if (toolName.startsWith('agent-')) {
    const rest = toolName.slice(6);
    const delegated = delegatedChildTool(rest);
    if (delegated) {
      return truncate(
        `is using ${delegated.agentId}: ${label(delegated.childToolName).toLowerCase()}…`,
        50
      );
    }
    return truncate(`is spawning a ${label(rest).toLowerCase()} agent…`, 50);
  }

  const args = (chunk.payload.args as Args | undefined) ?? {};
  const known = statuses[toolName]?.(args);
  if (known) {
    return truncate(known, 50);
  }

  return truncate(`is using ${label(toolName).toLowerCase()}…`, 50);
};
