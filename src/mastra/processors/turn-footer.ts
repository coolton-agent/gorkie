import type {
  ProcessOutputResultArgs,
  ProcessOutputStreamArgs,
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
  // Stamped on the first chunk rather than at step end, which on a single-step
  // turn is the end of the only step and reads as no time at all.
  processOutputStream(args: ProcessOutputStreamArgs) {
    args.state.startTime ??= Date.now();
    return args.part;
  },
  async processOutputResult(args: ProcessOutputResultArgs) {
    const { threadId } = channelContext(args.requestContext);
    const { startTime } = args.state;
    // A turn that answers with no text posts nothing, so a footer would be the
    // only message in the thread and would undo that.
    if (
      !(threadId && args.result.text.trim()) ||
      typeof startTime !== 'number'
    ) {
      return args.messages;
    }
    const elapsed = formatDuration(
      intervalToDuration({ start: startTime, end: Date.now() }),
      { format: ['hours', 'minutes', 'seconds'] }
    );
    const text = `done in ${elapsed || 'under a second'}`;
    const traceId = args.tracingContext?.currentSpan?.traceId;
    try {
      await slack.postBlocks({
        blocks: [
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `_${text}_` }],
          },
          feedbackBlock(traceId),
        ],
        text,
        threadId,
      });
    } catch (error) {
      logger.warn('[turn-footer] failed to post', { threadId, error });
    }
    return args.messages;
  },
};
