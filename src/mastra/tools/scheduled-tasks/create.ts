import { createTool } from '@mastra/core/tools';
import { validateCron } from '@mastra/core/workflows';
import { z } from 'zod';
import { agent as agentConfig } from '../../config';
import { taskContext } from '../../lib/memory';
import { input, output } from '../../types/tools/index';

export const createScheduledTaskTool = createTool({
  id: 'create_scheduled_task',
  description:
    'Create a recurring schedule for the current Slack conversation. Use a valid cron expression and optional IANA timezone.',
  inputSchema: input({
    task: z.string().min(1).describe('Prompt to run on the schedule.'),
    cron: z.string().min(1).describe('Cron expression for when to run.'),
    name: z
      .string()
      .min(1)
      .max(120)
      .optional()
      .describe('Short human-readable name for the schedule.'),
    timezone: z
      .string()
      .min(1)
      .optional()
      .describe('IANA timezone, such as America/New_York.'),
  }),
  outputSchema: output({ schedule: z.unknown() }),
  execute: async ({ task, cron, name, timezone }, context) => {
    const service = context.mastra?.schedules;
    const { threadId, resourceId } = await taskContext({
      context,
      agentId: agentConfig.id,
      missing: 'No current Slack thread/resource to schedule into.',
    });
    if (!service) {
      throw new Error('No Mastra schedule service is available.');
    }

    validateCron(cron, timezone);

    return {
      schedule: await service.create({
        agentId: agentConfig.id,
        cron,
        prompt: task,
        threadId,
        resourceId,
        ...(name ? { name } : {}),
        ...(timezone ? { timezone } : {}),
      }),
    };
  },
});
