import { SlackAdapter } from '@chat-adapter/slack';

const mentionPattern = /<@([A-Z0-9_]+)(?:\|([^<>]+))?>/g;

const MENTION_LOOKUPS = 4;
const UNRESOLVED_TTL_MS = 60_000;

// The adapter caches a resolved user but not a failed lookup, so without this a
// rate-limited id is retried on every message that mentions it.
const unresolvedUntil = new Map<string, number>();

interface Recipient {
  teamId: string;
  userId: string;
}

export class SlackAgentAdapter extends SlackAdapter {
  // A scheduled run wakes an idle thread with no live message, so Chat SDK
  // can't supply the recipient_user_id/team_id that Slack's native streaming
  // needs outside a DM, and tool cards get dropped. Remember it per thread from
  // live messages so those runs reuse it. Both layers are in-process:
  // MastraStateAdapter keeps cache entries in memory, so neither survives a
  // restart, and the thread re-learns its recipient from the next live message.
  private readonly recipients = new Map<string, Recipient>();

  private recipientKey(threadId: string): string {
    return `stream-recipient:${threadId}`;
  }

  protected override handleMessageEvent(
    ...args: Parameters<SlackAdapter['handleMessageEvent']>
  ): ReturnType<SlackAdapter['handleMessageEvent']> {
    const [event] = args;
    const { chat } = this;
    const userId = event.user;
    const teamId = event.team_id ?? event.team;
    if (
      chat &&
      event.channel_type !== 'im' &&
      event.channel &&
      event.ts &&
      userId &&
      teamId
    ) {
      const threadId = this.encodeThreadId({
        channel: event.channel,
        threadTs: event.thread_ts || event.ts,
      });
      const known = this.recipients.get(threadId);
      if (!(known?.userId === userId && known.teamId === teamId)) {
        const recipient: Recipient = { userId, teamId };
        if (!known && this.recipients.size >= 10_000) {
          const oldestThreadId = this.recipients.keys().next().value;
          if (oldestThreadId) {
            this.recipients.delete(oldestThreadId);
          }
        }
        this.recipients.set(threadId, recipient);
        chat
          .getState()
          .set(this.recipientKey(threadId), recipient)
          .catch(() => undefined);
      }
    }
    return super.handleMessageEvent(...args);
  }

  override async stream(
    ...args: Parameters<SlackAdapter['stream']>
  ): ReturnType<SlackAdapter['stream']> {
    const [threadId, textStream, options] = args;
    const { channel } = this.decodeThreadId(threadId);
    const { chat } = this;
    if (
      channel.startsWith('D') ||
      (options?.recipientUserId && options?.recipientTeamId) ||
      !chat
    ) {
      return super.stream(threadId, textStream, options);
    }
    let recipient = this.recipients.get(threadId);
    if (!recipient) {
      const stored = await chat
        .getState()
        .get<Recipient>(this.recipientKey(threadId));
      if (stored?.userId && stored.teamId) {
        recipient = stored;
        this.recipients.set(threadId, stored);
      }
    }
    if (!recipient) {
      return super.stream(threadId, textStream, options);
    }
    return super.stream(threadId, textStream, {
      ...options,
      recipientUserId: recipient.userId,
      recipientTeamId: recipient.teamId,
    });
  }

  async postBlocks({
    blocks,
    text,
    threadId,
  }: {
    blocks: unknown[];
    text: string;
    threadId: string;
  }): Promise<void> {
    const { channel, threadTs } = this.decodeThreadId(threadId);
    await this._client.chat.postMessage(
      await this.withToken({ channel, thread_ts: threadTs, text, blocks })
    );
  }

  protected override async resolveInlineMentions(
    text: string,
    skipSelfMention: boolean
  ) {
    const mentionNames = new Map<string, string>();
    const missingIds = new Set<string>();
    const { botUserId } = this;

    for (const mention of text.matchAll(mentionPattern)) {
      const [, userId, label] = mention;
      if (
        !userId ||
        mentionNames.has(userId) ||
        (skipSelfMention && userId === botUserId)
      ) {
        continue;
      }
      if (label) {
        mentionNames.set(userId, label);
        continue;
      }
      missingIds.add(userId);
    }

    // A history-heavy turn can carry dozens of distinct mentions. Resolving
    // them all at once is what tripped Slack's users.info limit, and a failed
    // lookup is not cached by the adapter, so every retry re-fired the burst.
    const pending = [...missingIds].filter(
      (userId) => (unresolvedUntil.get(userId) ?? 0) <= Date.now()
    );
    for (let index = 0; index < pending.length; index += MENTION_LOOKUPS) {
      // biome-ignore lint/performance/noAwaitInLoops: sequencing the batches is the throttle
      await Promise.all(
        pending.slice(index, index + MENTION_LOOKUPS).map(async (userId) => {
          const user = await this.lookupUser(userId);
          if (user?.displayName) {
            unresolvedUntil.delete(userId);
            mentionNames.set(userId, user.displayName);
            return;
          }
          unresolvedUntil.set(userId, Date.now() + UNRESOLVED_TTL_MS);
        })
      );
    }

    if (mentionNames.size === 0) {
      return text;
    }

    return text.replace(mentionPattern, (token, userId: string) => {
      const name = mentionNames.get(userId);
      return name ? `@${name} (${userId})` : token;
    });
  }
}
