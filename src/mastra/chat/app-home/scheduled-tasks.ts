import { agent as agentConfig } from '../../config';
import { chatChannelId } from '../../lib/ids';
import { isAgentSchedule } from '../../tools/scheduled-tasks/queries';
import { chat } from '../instance';
import { getMastra } from '../mastra-instance';
import { publishHome } from './view';

const CANCEL_ACTION_ID = 'app_home_cancel_task';
const PREVIEW_LENGTH = 60;

export async function scheduledTasksBlocks(
  userId: string
): Promise<Record<string, unknown>[]> {
  const schedules = await getMastra().schedules.list({
    agentId: agentConfig.id,
    resourceId: chatChannelId(userId),
  });
  const tasks = schedules.filter(isAgentSchedule);

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '⏰ Scheduled Tasks' },
    },
  ];

  if (tasks.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_No scheduled tasks yet. Ask gorkie to set one up in any conversation._',
      },
    });
    return blocks;
  }

  for (const task of tasks) {
    const title =
      task.name ??
      (task.prompt.length > PREVIEW_LENGTH
        ? `${task.prompt.slice(0, PREVIEW_LENGTH)}…`
        : task.prompt);
    const nextFire = Math.floor(task.nextFireAt / 1000);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*\n\`${task.cron}\`${task.timezone ? ` (${task.timezone})` : ''} · next run <!date^${nextFire}^{date_short_pretty} at {time}|soon>`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Cancel' },
        action_id: CANCEL_ACTION_ID,
        value: task.id,
        style: 'danger',
        confirm: {
          title: { type: 'plain_text', text: 'Cancel this task?' },
          text: {
            type: 'mrkdwn',
            text: `This permanently deletes "${title}".`,
          },
          confirm: { type: 'plain_text', text: 'Cancel task' },
          deny: { type: 'plain_text', text: 'Keep it' },
        },
      },
    });
  }
  blocks.push({ type: 'divider' });
  return blocks;
}

export function registerScheduledTasks(): void {
  chat().onAction(CANCEL_ACTION_ID, async (event) => {
    const id = event.value;
    if (!id) {
      return;
    }
    const mastra = getMastra();
    const schedule = await mastra.schedules.get(id);
    const resourceId = chatChannelId(event.user.userId);
    if (
      !(schedule && isAgentSchedule(schedule)) ||
      schedule.agentId !== agentConfig.id ||
      schedule.resourceId !== resourceId
    ) {
      return;
    }
    await mastra.schedules.delete(id);
    await publishHome(event.user.userId);
  });
}
