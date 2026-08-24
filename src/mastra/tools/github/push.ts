import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { input } from '../../types/tools/index';
import { getSandbox } from '../../workspace';
import {
  failure,
  isRepository,
  remoteUrl,
  repoDir,
  run,
  validateBranch,
  withCredential,
} from './git-remote';

export function pushTool({
  approval,
  userId,
}: {
  approval: boolean;
  userId: string;
}) {
  return createTool({
    id: 'github_push_branch',
    description:
      'Push a committed branch of a sandbox checkout to GitHub. The branch must already exist locally with the work committed; main and master are refused. Use this rather than github_create_or_update_file when a change spans more than a couple of files, then open the pull request with github_create_pull_request.',
    requireApproval: approval,
    inputSchema: input({
      repository: z
        .string()
        .refine(isRepository, { message: 'Expected "owner/repo".' })
        .describe('Target repository, as "owner/repo".'),
      branch: z.string().min(1).describe('Local branch to push.'),
    }),
    execute: async ({ repository, branch }, context) => {
      const refusal = validateBranch(branch);
      if (refusal) {
        return { error: refusal, success: false as const };
      }
      const sandbox = await getSandbox(context.requestContext);
      if (!sandbox) {
        throw new Error('No sandbox available.');
      }
      const path = repoDir(repository);
      const remote = remoteUrl(repository);

      return await withCredential({
        run: async () => {
          const push = await run(
            sandbox,
            `git push ${remote} 'refs/heads/${branch}:refs/heads/${branch}'`,
            path
          );
          if (push.exitCode !== 0) {
            return { error: failure(push), success: false as const };
          }
          const head = await run(sandbox, `git rev-parse '${branch}'`, path);
          return {
            branch,
            sha: `${head.stdout}`.trim(),
            success: true as const,
          };
        },
        sandbox,
        userId,
      });
    },
  });
}
