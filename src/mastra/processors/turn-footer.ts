import type {
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
} from '@mastra/core/processors';
import { Card, CardText } from 'chat';
import { slack } from '../chat/client';
import { channelContext } from '../lib/context';
import { logger } from '../lib/logger';

export const turnFooter = {
  id: 'turn-footer',
  name: 'Turn Footer',
  description:
    'Posts a small footer once a turn ends, so a reader can tell where one response stopped and how long it took.',
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
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    await slack
      .postMessage(
        threadId,
        Card({
          children: [CardText(`_done in ${elapsed}s_`, { style: 'muted' })],
        })
      )
      .catch((error: unknown) =>
        logger.warn('[turn-footer] failed to post', { threadId, error })
      );
    return args.messages;
  },
};
