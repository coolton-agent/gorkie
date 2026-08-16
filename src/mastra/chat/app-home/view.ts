import { listMcpServers } from '../../db/queries/mcps';
import { getInstructions } from '../../db/queries/settings';
import { slack } from '../client';
import { content } from '../content';
import { customInstructionsBlocks } from './custom-instructions';
import { mcpServersBlocks } from './mcp-servers';
import { scheduledTasksBlocks } from './scheduled-tasks';

export async function buildHomeView(
  userId: string
): Promise<Record<string, unknown>> {
  const [instructions, mcpServers, scheduled] = await Promise.all([
    getInstructions(userId),
    listMcpServers(userId),
    scheduledTasksBlocks(userId),
  ]);
  return {
    type: 'home',
    blocks: [
      ...content.home.blocks,
      { type: 'divider' },
      ...customInstructionsBlocks(instructions),
      ...mcpServersBlocks(mcpServers),
      ...scheduled,
    ],
  };
}

export async function publishHome(userId: string): Promise<void> {
  await slack.publishHomeView(userId, await buildHomeView(userId));
}
