import type { E2BSandbox } from '@mastra/e2b';
import type { SandboxNetworkOpts } from 'e2b';
import { z } from 'zod';
import { sandbox as sandboxConfig } from '../../config';
import { githubAccessToken } from '../../lib/github';
import { logger } from '../../lib/logger';
import { baseRules } from '../../workspace/network';

const REPOSITORY_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;

// Everything interpolated into a git command has to match this, so a shell
// metacharacter can never reach the command line.
const BRANCH_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$/;
const PROTECTED_BRANCHES = new Set(['main', 'master']);

export function isRepository(value: string): boolean {
  return REPOSITORY_PATTERN.test(value);
}

export function repoDir(repository: string): string {
  return `${sandboxConfig.workdir}/${repository.split('/')[1]}`;
}

// Git remote config inside the sandbox is model-writable, so `pushurl` could
// redirect the brokered credential. Every command targets this literally.
export function remoteUrl(repository: string): string {
  return `https://github.com/${repository}.git`;
}

export function validateBranch(branch: string): string | undefined {
  if (
    !BRANCH_PATTERN.test(branch) ||
    branch.includes('..') ||
    branch.includes('//')
  ) {
    return `"${branch}" is not a valid branch name.`;
  }
  if (branch.startsWith('refs/') || branch === 'HEAD') {
    return `"${branch}" is not a plain branch name. Pass the branch name without a refs/ prefix.`;
  }
  if (PROTECTED_BRANCHES.has(branch)) {
    return `Direct pushes to ${branch} are not allowed. Push a feature branch and open a pull request.`;
  }
}

interface Result {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const commandError = z.object({
  result: z.object({
    exitCode: z.number(),
    stderr: z.string(),
    stdout: z.string(),
  }),
});

// e2b throws on a nonzero exit where eve's sandbox returns the result, so every
// command goes through here and a failure is a value again.
export async function run(
  sandbox: E2BSandbox,
  command: string,
  cwd?: string
): Promise<Result> {
  try {
    return await sandbox.e2b.commands.run(command, cwd ? { cwd } : undefined);
  } catch (error) {
    const parsed = commandError.safeParse(error);
    if (parsed.success) {
      return parsed.data.result;
    }
    throw error;
  }
}

export function failure(result: Result): string {
  return `git exited ${result.exitCode}: ${`${result.stderr || result.stdout}`.trim()}`;
}

// Git over HTTPS authenticates with Basic, not Bearer. The base rules ride
// along because `updateNetwork` clears whatever it is not told about.
function brokerRules(token: string): NonNullable<SandboxNetworkOpts['rules']> {
  const authorization = `Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
  return {
    ...baseRules(),
    'github.com': [
      { transform: { headers: { Authorization: authorization } } },
    ],
  };
}

export async function withCredential<T>({
  run,
  sandbox,
  userId,
}: {
  run: () => Promise<T>;
  sandbox: E2BSandbox;
  userId: string;
}): Promise<T | { error: string }> {
  const token = await githubAccessToken(userId);
  if (!token) {
    return { error: 'GitHub is not connected. Ask them to sign in again.' };
  }
  await sandbox.ensureRunning();
  // The whole window retries, not just the command: a recreated sandbox starts
  // on the base rules, so the credential has to be reapplied with it.
  return await sandbox.retryOnDead(async () => {
    await sandbox.e2b.updateNetwork({ rules: brokerRules(token) });
    try {
      return await run();
    } finally {
      await sandbox.e2b
        .updateNetwork({ rules: baseRules() })
        .catch((error: unknown) =>
          logger.error('[github] failed to drop the credential', { error })
        );
    }
  });
}
