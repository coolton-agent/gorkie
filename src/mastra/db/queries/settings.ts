import { rawId } from '../../lib/ids';
import { type GitHubPermission, githubPermissionSchema } from '../../types';
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

export async function getGitHubPermission(
  userId: string
): Promise<GitHubPermission> {
  const row = await db
    .selectFrom('user_settings')
    .select('github_permission')
    .where('user_id', '=', rawId(userId))
    .executeTakeFirst();
  return githubPermissionSchema.parse(row?.github_permission);
}

export async function setGitHubPermission({
  permission,
  userId,
}: {
  permission: GitHubPermission;
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
