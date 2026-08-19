import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { addFeedback } from '../db/queries/feedback';
import { FEEDBACK_KINDS } from '../db/schema/feedback';
import { channelContext } from '../lib/context';
import { logger } from '../lib/logger';
import { input, output } from '../types/tools/index';

export const submitFeedbackTool = createTool({
  id: 'submit_feedback',
  description:
    "Record feedback about gorkie itself so it reaches the maintainers. Use this when someone reports that you're broken or wrong, praises something you did, or asks for a change or new capability. Write the feedback in your own words as a clear, self-contained report: what they were doing, what happened, and what they expected. Do not use this for feedback about anything other than gorkie, and do not use it as a substitute for actually answering the person.",
  inputSchema: input({
    kind: z
      .enum(FEEDBACK_KINDS)
      .describe(
        'bug when something misbehaved, suggestion for a requested change or new capability, praise when something worked well, other when none fit.'
      ),
    body: z
      .string()
      .min(1)
      .describe(
        'The feedback as a self-contained report: what they were doing, what happened, and what they expected.'
      ),
  }),
  outputSchema: output({ id: z.number(), kind: z.string() }),
  transform: {
    display: {
      output: ({ output }) => ({
        summary: `Logged ${output?.kind ?? 'feedback'} #${output?.id ?? ''}`,
      }),
    },
  },
  execute: async ({ kind, body }, context) => {
    const ctx = channelContext(context?.requestContext);
    if (!ctx.userId) {
      throw new Error('No current user to attribute this feedback to.');
    }
    const id = await addFeedback({
      body,
      channelId: ctx.channelId,
      kind,
      threadId: ctx.threadId,
      userId: ctx.userId,
    });
    logger.info('[feedback] recorded', { id, kind, userId: ctx.userId });
    return { id, kind };
  },
});
