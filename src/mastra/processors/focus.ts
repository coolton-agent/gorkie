import type { ProcessOutputResultArgs } from '@mastra/core/processors';
import { channelContext } from '../lib/context';
import { exitFocus } from '../lib/focus';

export const releaseFocus = {
  id: 'release-focus',
  name: 'Release Focus',
  description:
    'Reopens a thread to everyone once a credentialed turn ends. A turn that dies before this runs is covered by the ceiling in config.focus.',
  processOutputResult(args: ProcessOutputResultArgs) {
    const { threadId } = channelContext(args.requestContext);
    if (threadId) {
      exitFocus(threadId);
    }
    return args.messages;
  },
};
