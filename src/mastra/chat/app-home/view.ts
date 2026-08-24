import { listGitHubCredentials } from '../../db/queries/github';
import { listMCPServers } from '../../db/queries/mcps';
import {
  getGitHubPermission,
  getInstructions,
} from '../../db/queries/settings';
import { countInstallations } from '../../lib/github';
import { slack } from '../client';
import { content } from '../content';
import { githubBlocks } from './github';
import { customInstructionsBlocks } from './instructions';
import { mcpServersBlocks } from './mcp';
import { scheduledTasksBlocks } from './scheduled-tasks';

async function buildHomeView(userId: string): Promise<Record<string, unknown>> {
  const [instructions, mcpServers, credentials, githubPermission] =
    await Promise.all([
      getInstructions(userId),
      listMCPServers(userId),
      listGitHubCredentials(userId),
      getGitHubPermission(userId),
    ]);
  const app = credentials.find((c) => c.kind === 'app');
  const installations = app ? await countInstallations(app.token) : 0;

  const staticBlocks = [
    ...content.home.blocks,
    { type: 'divider' },
    ...customInstructionsBlocks(instructions),
    ...githubBlocks({
      credentials,
      installations,
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
