import { rawId } from '../../lib/ids';
import { db } from '../client';
import type { FeedbackKind } from '../schema/feedback';

export async function addFeedback({
  userId,
  kind,
  body,
  channelId,
  threadId,
}: {
  body: string;
  channelId?: string;
  kind: FeedbackKind;
  threadId?: string;
  userId: string;
}): Promise<number> {
  const row = await db
    .insertInto('feedback')
    .values({
      body,
      channel_id: channelId ? rawId(channelId) : null,
      kind,
      thread_id: threadId ?? null,
      user_id: rawId(userId),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}
