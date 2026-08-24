import { refreshToken } from '@octokit/oauth-methods';
import { z } from 'zod';
import { env } from '@/env';
import {
  type GitHubCredential,
  getGitHubCredential,
  removeGitHubCredential,
  setGitHubCredential,
} from '../../db/queries/github';
import { logger } from '../logger';
import { toAccount } from './device-flow';

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const refreshes = new Map<string, Promise<string | undefined>>();

async function refreshAccount({
  account,
  spent,
  userId,
}: {
  account: GitHubCredential;
  spent: string;
  userId: string;
}): Promise<string | undefined> {
  try {
    const { authentication } = await refreshToken({
      clientId: env.GITHUB_APP_CLIENT_ID,
      clientSecret: env.GITHUB_APP_CLIENT_SECRET,
      clientType: 'github-app',
      refreshToken: spent,
    });
    const refreshed = toAccount(authentication);
    await setGitHubCredential({
      credential: {
        ...refreshed,
        kind: 'app',
        login: account.login,
        scopes: [],
      },
      userId,
    });
    return refreshed.token;
  } catch (error) {
    logger.warn('[github] token refresh failed', { error, userId });
    // Only disconnect if nobody refreshed in the meantime. Wiping blindly would
    // throw away a working credential another call just wrote.
    const current = await getGitHubCredential(userId);
    if (current && current.refreshToken !== spent) {
      return current.token;
    }
    await removeGitHubCredential(userId);
  }
}

export async function githubAccessToken(
  userId: string
): Promise<string | undefined> {
  const account = await getGitHubCredential(userId);
  if (!account) {
    return;
  }
  if (account.kind === 'pat') {
    return account.token;
  }
  const expiresSoon =
    account.expiresAt !== undefined &&
    account.expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;
  if (!(expiresSoon && account.refreshToken)) {
    return account.token;
  }

  const inFlight = refreshes.get(userId);
  if (inFlight) {
    return inFlight;
  }
  const started = refreshAccount({
    account,
    spent: account.refreshToken,
    userId,
  }).finally(() => refreshes.delete(userId));
  refreshes.set(userId, started);
  return started;
}

const patUserSchema = z.object({ login: z.string() });

export async function verifyGitHubPat(
  token: string
): Promise<
  { login: string; scopes: string[]; token: string } | { error: string }
> {
  let response: Response;
  try {
    response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { error: 'Could not reach GitHub to check that token.' };
  }
  if (!response.ok) {
    return { error: 'GitHub rejected that token.' };
  }
  const parsed = patUserSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { error: 'GitHub returned an account this could not read.' };
  }
  const scopes = (response.headers.get('x-oauth-scopes') ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (scopes.length === 0) {
    return {
      error:
        'That looks like a fine-grained token. Those only reach your own repositories, which the GitHub App already covers. Use a classic token with `public_repo`.',
    };
  }
  return { login: parsed.data.login, scopes, token };
}
