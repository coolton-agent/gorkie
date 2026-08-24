import { enterFocus } from '../lib/focus';
import { logger } from '../lib/logger';
import { slack } from './client';

export async function beginFocus({
  reason,
  threadId,
  userId,
}: {
  reason: string;
  threadId: string;
  userId: string;
}): Promise<void> {
  if (!enterFocus({ reason, threadId, userId })) {
    return;
  }
  const text = `focus mode: ${reason} for <@${userId}>, so gorkie won't take anyone else's messages until this turn ends`;
  try {
    await slack.postBlocks({
      blocks: [
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `:lock: _${text}_` }],
        },
      ],
      text,
      threadId,
    });
  } catch (error) {
    logger.warn('[focus] failed to post the badge', { error, threadId });
  }
}
