import { decryptSecret, encryptSecret } from '../../lib/crypto';
import { rawId } from '../../lib/ids';
import { db } from '../client';

export type GitHubCredentialKind = 'app' | 'pat';

export interface GitHubCredential {
  expiresAt: Date | undefined;
  kind: GitHubCredentialKind;
  login: string;
  refreshToken: string | undefined;
  scopes: string[];
  token: string;
}

interface Row {
  expires_at: Date | null;
  kind: string;
  login: string;
  refresh_token: string | null;
  scopes: string | null;
  token: string;
}

function toCredential(row: Row): GitHubCredential {
  return {
    expiresAt: row.expires_at ?? undefined,
    kind: row.kind === 'pat' ? 'pat' : 'app',
    login: row.login,
    refreshToken: row.refresh_token
      ? decryptSecret(row.refresh_token)
      : undefined,
    scopes: row.scopes ? row.scopes.split(',') : [],
    token: decryptSecret(row.token),
  };
}

export async function listGitHubCredentials(
  userId: string
): Promise<GitHubCredential[]> {
  const rows = await db
    .selectFrom('github_credentials')
    .selectAll()
    .where('user_id', '=', rawId(userId))
    // Newest first: connecting a credential is how someone chooses it, so the
    // most recent one is the one they meant to use.
    .orderBy('created_at', 'desc')
    .execute();
  return rows.map(toCredential);
}

export async function activeGitHubCredential(
  userId: string
): Promise<GitHubCredential | undefined> {
  const [active] = await listGitHubCredentials(userId);
  return active;
}

export async function setGitHubCredential({
  credential,
  userId,
}: {
  credential: GitHubCredential;
  userId: string;
}): Promise<void> {
  const values = {
    // Reconnecting is a choice, so it moves this credential to the front.
    created_at: new Date(),
    expires_at: credential.expiresAt ?? null,
    login: credential.login,
    refresh_token: credential.refreshToken
      ? encryptSecret(credential.refreshToken)
      : null,
    scopes: credential.scopes.length ? credential.scopes.join(',') : null,
    token: encryptSecret(credential.token),
  };
  await db
    .insertInto('github_credentials')
    .values({ ...values, kind: credential.kind, user_id: rawId(userId) })
    .onConflict((oc) => oc.columns(['user_id', 'kind']).doUpdateSet(values))
    .execute();
}

export async function removeGitHubCredential({
  kind,
  userId,
}: {
  kind: GitHubCredentialKind;
  userId: string;
}): Promise<void> {
  await db
    .deleteFrom('github_credentials')
    .where('user_id', '=', rawId(userId))
    .where('kind', '=', kind)
    .execute();
}
