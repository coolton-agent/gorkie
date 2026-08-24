import {
  createDeviceCode,
  exchangeDeviceCode,
  refreshToken,
} from '@octokit/oauth-methods';
import { z } from 'zod';
import { env } from '@/env';
import {
  type GitHubAccount,
  getGitHubAccount,
  setGitHubAccount,
} from '../db/queries/settings';
import { logger } from './logger';

// GitHub is no longer an MCP server, so these two are guards on the add-server
// form: the name would collide with the native `github_*` tools, and the hosted
// server is the thing those tools replaced.
export const GITHUB_SERVER_NAME = 'github';
const HOSTED_GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/';
export function isGitHubUrl(url: string): boolean {
  try {
    return new URL(url).host === new URL(HOSTED_GITHUB_MCP_URL).host;
  } catch {
    return false;
  }
}

export const GITHUB_SETTINGS_URL = 'https://github.com/settings/installations';
export const GITHUB_INSTALL_URL = `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface DeviceLogin {
  deviceCode: string;
  expiresIn: number;
  interval: number;
  userCode: string;
  verificationUri: string;
}

export async function startDeviceLogin(): Promise<DeviceLogin> {
  const { data } = await createDeviceCode({
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientType: 'github-app',
  });
  return {
    deviceCode: data.device_code,
    expiresIn: data.expires_in,
    interval: data.interval,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
  };
}

// The library throws on GitHub's in-band `{ error }` body, so the pending and
// back-off signals arrive as failures rather than as results.
const oauthErrorSchema = z.object({
  response: z.object({ data: z.object({ error: z.string() }) }),
});

function oauthError(error: unknown): string | undefined {
  return oauthErrorSchema.safeParse(error).data?.response.data.error;
}

function toAccount(authentication: {
  expiresAt?: string;
  refreshToken?: string;
  token: string;
}): Omit<GitHubAccount, 'login'> {
  return {
    expiresAt: authentication.expiresAt
      ? new Date(authentication.expiresAt)
      : undefined,
    refreshToken: authentication.refreshToken,
    token: authentication.token,
  };
}

export async function awaitDeviceLogin({
  deviceCode,
  expiresIn,
  interval,
  signal,
}: DeviceLogin & { signal?: AbortSignal }): Promise<
  Omit<GitHubAccount, 'login'> | { error: string }
> {
  const deadline = Date.now() + expiresIn * 1000;
  let waitMs = interval * 1000;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      return { error: 'cancelled' };
    }
    // biome-ignore lint/performance/noAwaitInLoops: polling is the protocol
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    try {
      const { authentication } = await exchangeDeviceCode({
        clientId: env.GITHUB_APP_CLIENT_ID,
        clientType: 'github-app',
        code: deviceCode,
      });
      return toAccount(authentication);
    } catch (error) {
      const code = oauthError(error);
      if (code === 'authorization_pending') {
        continue;
      }
      if (code === 'slow_down') {
        waitMs += 5000;
        continue;
      }
      return { error: code ?? 'unknown' };
    }
  }
  return { error: 'expired_token' };
}

// Refresh tokens are single use, so two concurrent refreshes race: one wins and
// the loser's token is already spent. Tools resolve a token on every call, so
// that is a real overlap, not a corner case.
const refreshes = new Map<string, Promise<string | undefined>>();

async function refreshAccount({
  account,
  spent,
  userId,
}: {
  account: GitHubAccount;
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
    await setGitHubAccount({
      account: { ...refreshed, login: account.login },
      userId,
    });
    return refreshed.token;
  } catch (error) {
    logger.warn('[github] token refresh failed', { error, userId });
    // Only disconnect if nobody refreshed in the meantime. Wiping blindly would
    // throw away a working credential another call just wrote.
    const current = await getGitHubAccount(userId);
    if (current && current.refreshToken !== spent) {
      return current.token;
    }
    await setGitHubAccount({ account: undefined, userId });
  }
}

export async function githubAccessToken(
  userId: string
): Promise<string | undefined> {
  const account = await getGitHubAccount(userId);
  if (!account) {
    return;
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

export async function resolveGitHubLogin(
  token: string
): Promise<{ login: string } | { error: string }> {
  const body = await githubApi({ path: '/user', token });
  if ('error' in body) {
    return body;
  }
  const login = z.object({ login: z.string().min(1) }).safeParse(body.data)
    .data?.login;
  return login
    ? { login }
    : { error: "GitHub didn't return an account for that token." };
}

export async function countInstallations(token: string): Promise<number> {
  const body = await githubApi({ path: '/user/installations', token });
  if ('error' in body) {
    return 0;
  }
  return (
    z.object({ total_count: z.number() }).safeParse(body.data).data
      ?.total_count ?? 0
  );
}

async function githubApi({
  path,
  token,
}: {
  path: string;
  token: string;
}): Promise<{ data: unknown } | { error: string }> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'gorkie',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { error: "Couldn't reach GitHub." };
  }
  if (!response.ok) {
    return { error: `GitHub returned ${response.status}.` };
  }
  return { data: await response.json().catch(() => null) };
}
