import { getUserSettings } from '../../lib/settings';
import { slack } from '../client';
import { content } from '../content';
import { customInstructionsBlocks } from './custom-instructions';
import { scheduledTasksBlocks } from './scheduled-tasks';

export async function buildHomeView(
  userId: string
): Promise<Record<string, unknown>> {
  const settings = await getUserSettings(userId);
  const scheduled = await scheduledTasksBlocks(userId);
  return {
    type: 'home',
    blocks: [
      ...content.home.blocks,
      { type: 'divider' },
      ...customInstructionsBlocks(settings),
      ...scheduled,
    ],
  };
}

export async function publishHome(userId: string): Promise<void> {
  await slack.publishHomeView(userId, await buildHomeView(userId));
}
