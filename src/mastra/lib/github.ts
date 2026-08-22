export const GITHUB_SERVER_NAME = 'github';
export const GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/';

// The GitHub MCP server advertises classic OAuth scopes, and three of them
// (gist, notifications, codespace) have no fine-grained equivalent at all.
// Classic tokens also accept these as query params, so the scope boxes arrive
// pre-ticked instead of being hunted down by hand.
export const GITHUB_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=Gorkie&scopes=repo,read:org,read:user';

export async function resolveGitHubLogin(
  token: string
): Promise<{ login: string } | { error: string }> {
  let response: Response;
  try {
    response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'gorkie',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { error: "Couldn't reach GitHub. Try again in a moment." };
  }

  if (response.status === 401) {
    return {
      error:
        'GitHub rejected that token. Check you copied all of it, and that it has not expired.',
    };
  }
  if (!response.ok) {
    return { error: `GitHub returned ${response.status}. Try again.` };
  }

  const body: unknown = await response.json().catch(() => null);
  const login =
    body && typeof body === 'object' && 'login' in body
      ? (body as { login: unknown }).login
      : undefined;
  if (typeof login !== 'string' || login.length === 0) {
    return { error: "GitHub didn't return an account for that token." };
  }

  // A fine-grained token reaches /user but is missing scopes the MCP server
  // needs, so it would connect and then 403 on the first write. Catch it here.
  const scopes = response.headers.get('x-oauth-scopes');
  if (scopes === null) {
    return {
      error:
        'That looks like a fine-grained token. Gorkie needs a classic token, which the link above creates with the right scopes already ticked.',
    };
  }
  const granted = new Set(scopes.split(',').map((scope) => scope.trim()));
  if (!granted.has('repo')) {
    return {
      error:
        'That token is missing the repo scope, so Gorkie could read but not open branches or pull requests. Regenerate it using the link above.',
    };
  }

  return { login };
}
