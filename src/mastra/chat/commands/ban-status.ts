import type { Message, Thread } from 'chat';
import { getUserBan } from '../../db/queries/bans';
import { isAdmin } from '../../lib/bans';
import { rawText, withoutLeadingMentions } from '../message';

function commandArgs(message: Message): string[] {
  return withoutLeadingMentions(rawText(message)).trim().split(/\s+/).slice(1);
}

function targetId(value: string | undefined): string | undefined {
  const id = value?.match(/^<?@?(U[A-Z0-9]+)>?$/i)?.[1];
  return id?.toUpperCase();
}

async function adminOnly(message: Message, thread: Thread): Promise<boolean> {
  if (isAdmin(message.author.userId)) {
    return true;
  }
  await thread.postEphemeral(message.author, 'You are not allowed to use moderation commands.', {
    fallbackToDM: false,
  });
  return false;
}

export const banStatus = async ({ message, thread }: { message: Message; thread: Thread }): Promise<void> => {
  if (!(await adminOnly(message, thread))) {
    return;
  }
  const userId = targetId(commandArgs(message)[0]);
  if (!userId) {
    await thread.postEphemeral(message.author, 'Usage: `!banstatus @user`', { fallbackToDM: false });
    return;
  }
  const ban = await getUserBan(userId);
  await thread.postEphemeral(
    message.author,
    ban
      ? `Banned: <@${userId}>\nReason: ${ban.reason ?? 'No reason provided'}\nBanned by: <@${ban.bannedBy}>`
      : `<@${userId}> is not banned.`,
    { fallbackToDM: false }
  );
};
