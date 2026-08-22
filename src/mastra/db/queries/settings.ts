import { decryptSecret, encryptSecret } from '../../lib/crypto';
import { rawId } from '../../lib/ids';
import { db } from '../client';

export async function getInstructions(
  userId: string
): Promise<string | undefined> {
  const row = await db
    .selectFrom('user_settings')
    .select('instructions')
    .where('user_id', '=', rawId(userId))
    .executeTakeFirst();
  return row?.instructions ?? undefined;
}

export async function setInstructions({
  userId,
  instructions,
}: {
  userId: string;
  instructions: string | undefined;
}): Promise<void> {
  const id = rawId(userId);
  const value = instructions ?? null;
  const now = new Date();
  await db
    .insertInto('user_settings')
    .values({ instructions: value, updated_at: now, user_id: id })
    .onConflict((oc) =>
      oc.column('user_id').doUpdateSet({ instructions: value, updated_at: now })
    )
    .execute();
}

export async function getGitHubAccount(
  userId: string
): Promise<{ login: string; token: string } | undefined> {
  const row = await db
    .selectFrom('user_settings')
    .select(['github_login', 'github_token'])
    .where('user_id', '=', rawId(userId))
    .executeTakeFirst();
  return row?.github_token
    ? {
        login: row.github_login ?? 'unknown',
        token: decryptSecret(row.github_token),
      }
    : undefined;
}

export async function setGitHubAccount({
  userId,
  login,
  token,
}: {
  login: string | undefined;
  token: string | undefined;
  userId: string;
}): Promise<void> {
  const id = rawId(userId);
  const now = new Date();
  const values = {
    github_login: login ?? null,
    github_token: token ? encryptSecret(token) : null,
    updated_at: now,
  };
  await db
    .insertInto('user_settings')
    .values({ ...values, instructions: null, user_id: id })
    .onConflict((oc) => oc.column('user_id').doUpdateSet(values))
    .execute();
}
