import { listMCPServers } from '../../db/queries/mcps';
import {
  getGitHubAccount,
  getGitHubPermission,
  getInstructions,
} from '../../db/queries/settings';
import { countInstallations } from '../../lib/github';
import { slack } from '../client';
import { content } from '../content';
import { customInstructionsBlocks } from './custom-instructions';
import { githubBlocks } from './github';
import { mcpServersBlocks } from './mcp-servers';
import { scheduledTasksBlocks } from './scheduled-tasks';

async function buildHomeView(userId: string): Promise<Record<string, unknown>> {
  const [instructions, mcpServers, github, githubPermission] =
    await Promise.all([
      getInstructions(userId),
      listMCPServers(userId),
      getGitHubAccount(userId),
      getGitHubPermission(userId),
    ]);

  const installations = github ? await countInstallations(github.token) : 0;

  const staticBlocks = [
    ...content.home.blocks,
    { type: 'divider' },
    ...customInstructionsBlocks(instructions),
    ...githubBlocks({
      installations,
      login: github?.login,
      permission: githubPermission,
    }),
    ...mcpServersBlocks(mcpServers),
  ];
  // Slack's views.publish rejects a Home view with more than 100 blocks.
  const scheduled = await scheduledTasksBlocks(
    userId,
    100 - staticBlocks.length
  );

  return {
    type: 'home',
    blocks: [...staticBlocks, ...scheduled],
  };
}

export async function publishHome(userId: string): Promise<void> {
  await slack.publishHomeView(userId, await buildHomeView(userId));
}
