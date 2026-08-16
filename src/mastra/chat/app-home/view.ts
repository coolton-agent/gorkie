import { listMCPServers } from '../../db/queries/mcps';
import { getInstructions } from '../../db/queries/settings';
import { slack } from '../client';
import { content } from '../content';
import { customInstructionsBlocks } from './custom-instructions';
import { mcpServersBlocks } from './mcp-servers';
import { scheduledTasksBlocks } from './scheduled-tasks';

// Slack's views.publish rejects a Home view with more than 100 blocks.
const MAX_HOME_BLOCKS = 100;

export async function buildHomeView(
  userId: string
): Promise<Record<string, unknown>> {
  const [instructions, mcpServers] = await Promise.all([
    getInstructions(userId),
    listMCPServers(userId),
  ]);

  const staticBlocks = [
    ...content.home.blocks,
    { type: 'divider' },
    ...customInstructionsBlocks(instructions),
    ...mcpServersBlocks(mcpServers),
  ];
  const scheduled = await scheduledTasksBlocks(
    userId,
    MAX_HOME_BLOCKS - staticBlocks.length
  );

  return {
    type: 'home',
    blocks: [...staticBlocks, ...scheduled],
  };
}

export async function publishHome(userId: string): Promise<void> {
  await slack.publishHomeView(userId, await buildHomeView(userId));
}
