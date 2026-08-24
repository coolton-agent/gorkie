import type { Message, Thread } from 'chat';
import { banUser, unbanUser } from '../../db/queries/bans';
import { isAdmin } from '../../lib/bans';
import type { CommandHandler } from '../../types';
import { rawText, withoutLeadingMentions } from '../message';

function args(message: Message): string[] {
  const tokens = withoutLeadingMentions(rawText(message)).trim().split(/\s+/);
  return tokens[0] === '/gorkie' ? tokens.slice(2) : tokens.slice(1);
}

function targetId(value: string | undefined): string | undefined {
  const id = value?.match(/^<?@?(U[A-Z0-9]+)>?$/i)?.[1];
  return id?.toUpperCase();
}

async function requireAdmin(message: Message, thread: Thread): Promise<boolean> {
  if (isAdmin(message.author.userId)) {
    return true;
  }
  await thread.postEphemeral(message.author, 'You are not allowed to use moderation commands.', {
    fallbackToDM: false,
  });
  return false;
}

export const ban: CommandHandler = async ({ message, thread }) => {
  if (!(await requireAdmin(message, thread))) {
    return;
  }
  const values = args(message);
  const userId = targetId(values[0]);
  if (!userId) {
    await thread.postEphemeral(message.author, 'Usage: `/gorkie ban @user [reason]`', { fallbackToDM: false });
    return;
  }
  await banUser({ bannedBy: message.author.userId, reason: values.slice(1).join(' '), userId });
  await thread.postEphemeral(message.author, `Banned <@${userId}>.`, { fallbackToDM: false });
};

export const unban: CommandHandler = async ({ message, thread }) => {
  if (!(await requireAdmin(message, thread))) {
    return;
  }
  const userId = targetId(args(message)[0]);
  if (!userId) {
    await thread.postEphemeral(message.author, 'Usage: `/gorkie unban @user`', { fallbackToDM: false });
    return;
  }
  const removed = await unbanUser(userId);
  await thread.postEphemeral(
    message.author,
    removed ? `Unbanned <@${userId}>.` : `<@${userId}> was not banned.`,
    { fallbackToDM: false }
  );
};
