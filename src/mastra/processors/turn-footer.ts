import type {
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
} from '@mastra/core/processors';
import { formatDuration, intervalToDuration } from 'date-fns';
import { slack } from '../chat/client';
import { feedbackBlock } from '../chat/feedback';
import { channelContext } from '../lib/context';
import { logger } from '../lib/logger';

export const turnFooter = {
  id: 'turn-footer',
  name: 'Turn Footer',
  description:
    'Closes a turn with how long it took and a thumbs rating for the response.',
  processOutputStep(args: ProcessOutputStepArgs) {
    args.state.startTime ??= Date.now();
    return args.messages;
  },
  async processOutputResult(args: ProcessOutputResultArgs) {
    const { threadId } = channelContext(args.requestContext);
    const { startTime } = args.state;
    if (!threadId || typeof startTime !== 'number') {
      return args.messages;
    }
    const elapsed = formatDuration(
      intervalToDuration({ start: startTime, end: Date.now() }),
      { format: ['hours', 'minutes', 'seconds'] }
    );
    const text = `done in ${elapsed || 'under a second'}`;
    const traceId = args.tracingContext?.currentSpan?.traceId;
    try {
      await slack.postBlocks(threadId, text, [
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `_${text}_` }],
        },
        feedbackBlock(traceId),
      ]);
    } catch (error) {
      logger.warn('[turn-footer] failed to post', { threadId, error });
    }
    return args.messages;
  },
};
