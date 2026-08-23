import { decryptSecret, encryptSecret } from '../../lib/crypto';
import { rawId } from '../../lib/ids';
import { type ToolPermission, toolPermissionSchema } from '../../types';
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

export interface GitHubAccount {
  expiresAt: Date | undefined;
  login: string;
  refreshToken: string | undefined;
  token: string;
}

export async function getGitHubAccount(
  userId: string
): Promise<GitHubAccount | undefined> {
  const row = await db
    .selectFrom('user_settings')
    .select([
      'github_expires_at',
      'github_login',
      'github_refresh_token',
      'github_token',
    ])
    .where('user_id', '=', rawId(userId))
    .executeTakeFirst();
  if (!row?.github_token) {
    return;
  }
  return {
    expiresAt: row.github_expires_at ?? undefined,
    login: row.github_login ?? 'unknown',
    refreshToken: row.github_refresh_token
      ? decryptSecret(row.github_refresh_token)
      : undefined,
    token: decryptSecret(row.github_token),
  };
}

export async function setGitHubAccount({
  userId,
  account,
}: {
  account: GitHubAccount | undefined;
  userId: string;
}): Promise<void> {
  const id = rawId(userId);
  const now = new Date();
  const values = account
    ? {
        github_expires_at: account.expiresAt ?? null,
        github_login: account.login,
        github_refresh_token: account.refreshToken
          ? encryptSecret(account.refreshToken)
          : null,
        github_token: encryptSecret(account.token),
        updated_at: now,
      }
    : {
        github_expires_at: null,
        github_login: null,
        github_refresh_token: null,
        github_token: null,
        updated_at: now,
      };
  await db
    .insertInto('user_settings')
    .values({ ...values, instructions: null, user_id: id })
    .onConflict((oc) => oc.column('user_id').doUpdateSet(values))
    .execute();
}

export async function getGitHubPermission(
  userId: string
): Promise<ToolPermission> {
  const row = await db
    .selectFrom('user_settings')
    .select('github_permission')
    .where('user_id', '=', rawId(userId))
    .executeTakeFirst();
  return toolPermissionSchema.parse(row?.github_permission);
}

export async function setGitHubPermission({
  permission,
  userId,
}: {
  permission: ToolPermission;
  userId: string;
}): Promise<void> {
  const id = rawId(userId);
  const now = new Date();
  await db
    .insertInto('user_settings')
    .values({
      instructions: null,
      github_permission: permission,
      updated_at: now,
      user_id: id,
    })
    .onConflict((oc) =>
      oc
        .column('user_id')
        .doUpdateSet({ github_permission: permission, updated_at: now })
    )
    .execute();
}
