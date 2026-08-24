import { createGithubTools } from '@github-tools/sdk';
import { getGitHubPermission } from '../../db/queries/settings';
import { githubAccessToken } from '../../lib/github';
import { logger } from '../../lib/logger';
import { checkoutPolicy, POLICIES, pushPolicy } from './approval';
import { checkoutTool } from './checkout';
import { pushTool } from './push';

function toolName(name: string): string {
  return `github_${name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}`;
}

export async function githubTools({
  threadId,
  userId,
}: {
  threadId: string | undefined;
  userId: string;
}): Promise<Record<string, unknown>> {
  try {
    const [connected, permission] = await Promise.all([
      githubAccessToken(userId),
      getGitHubPermission(userId),
    ]);
    if (!connected) {
      return {};
    }

    const built = createGithubTools({
      token: async () => {
        const fresh = await githubAccessToken(userId);
        if (!fresh) {
          throw new Error(
            'GitHub is no longer connected for this person. Ask them to sign in again from the Home tab.'
          );
        }
        return fresh;
      },
    });

    const tools: Record<string, unknown> = Object.fromEntries(
      Object.entries(POLICIES).map(([name, policy]) => {
        const tool = built[name as keyof typeof built];
        return [
          toolName(name),
          {
            ...tool,
            needsApproval: policy(permission),
            toModelOutput: tool.toModelOutput
              ? (result: unknown) =>
                  result === undefined
                    ? result
                    : tool.toModelOutput?.({
                        input: undefined,
                        output: result,
                        toolCallId: '',
                      })
              : undefined,
          },
        ];
      })
    );

    if (threadId) {
      tools.github_checkout = checkoutTool({
        approval: checkoutPolicy(permission),
        userId,
      });
      tools.github_push_branch = pushTool({
        approval: pushPolicy(permission),
        userId,
      });
    }
    return tools;
  } catch (error) {
    logger.debug('[github] failed to build tools', { error, userId });
    return {};
  }
}
