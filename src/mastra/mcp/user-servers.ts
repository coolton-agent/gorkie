import { MCPClient } from '@mastra/mcp';
import { listMCPServers, setMCPServerError } from '../db/queries/mcps';
import { getGitHubPermission } from '../db/queries/settings';
import {
  GITHUB_MCP_URL,
  GITHUB_SERVER_NAME,
  githubAccessToken,
} from '../lib/github';
import { logger } from '../lib/logger';
import type { MCPServerConfig, ToolPermission } from '../types';
import { cleanMCPErrorMessage } from './errors';

const clients = new Map<string, { key: string; promise: Promise<MCPClient> }>();

// Tool ids arrive as `<server>_<tool>`, and the typing status needs the server
// names to split them back apart. Populated as clients are built.
export const mcpServerNames = new Set<string>();

// What triggers an approval prompt is the person's own setting. A tool we
// cannot classify counts as a write, never as a read.
//
// Deletes are matched by name as well as by annotation: MCP's `destructiveHint`
// would be the right signal, but GitHub sets it on no tool at all, so the
// annotation alone would make "only before deleting" never fire.
const DELETES = /^(delete|remove)_/;

function approvalFor(permission: ToolPermission) {
  return ({
    annotations,
    toolName,
  }: {
    annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean };
    toolName: string;
  }): boolean => {
    if (permission === 'all') {
      return true;
    }
    const deletes =
      annotations?.destructiveHint === true || DELETES.test(toolName);
    if (permission === 'delete') {
      return deletes;
    }
    return deletes || annotations?.readOnlyHint !== true;
  };
}

async function buildClient({
  userId,
  servers,
  stale,
}: {
  userId: string;
  servers: MCPServerConfig[];
  stale: Promise<MCPClient> | undefined;
}): Promise<MCPClient> {
  if (stale) {
    const staleClient = await stale;
    await staleClient.disconnect().catch((error: unknown) => {
      logger.debug('[mcp] failed to disconnect stale client', {
        error,
        userId,
      });
    });
  }
  const client = new MCPClient({
    id: `user-mcp-${userId}`,
    servers: Object.fromEntries(
      servers.flatMap((server) => {
        let url: URL;
        try {
          url = new URL(server.url);
        } catch (error) {
          logger.debug('[mcp] skipping server with invalid url', {
            error,
            name: server.name,
            userId,
          });
          return [];
        }
        return [
          [
            server.name,
            {
              url,
              requireToolApproval: approvalFor(server.permission),
              allowedHosts: [url.host],
              ...(server.token
                ? {
                    requestInit: {
                      headers: { Authorization: `Bearer ${server.token}` },
                    },
                  }
                : {}),
            },
          ],
        ] as const;
      })
    ),
  });
  client.__setLogger(logger);
  return client;
}

async function dropClient(userId: string): Promise<void> {
  const cached = clients.get(userId);
  if (!cached) {
    return;
  }
  clients.delete(userId);
  try {
    const client = await cached.promise;
    await client.disconnect();
  } catch (error) {
    logger.debug('[mcp] failed to disconnect client on removal', {
      error,
      userId,
    });
  }
}

function resolveClient({
  userId,
  servers,
}: {
  userId: string;
  servers: MCPServerConfig[];
}): Promise<MCPClient> {
  // Each server's permission is baked into its approval callback, and the
  // servers are part of the key, so changing one rebuilds the client.
  const key = JSON.stringify(servers);
  const cached = clients.get(userId);
  if (cached && cached.key === key) {
    return cached.promise;
  }
  const promise = buildClient({ servers, stale: cached?.promise, userId });
  const entry = { key, promise };
  clients.set(userId, entry);

  // A failed build shouldn't poison the cache: drop it so the next call
  // retries instead of replaying the same rejection forever.
  promise.catch(() => {
    if (clients.get(userId) === entry) {
      clients.delete(userId);
    }
  });

  return promise;
}

export async function findMCPConnectionError({
  userId,
  server,
}: {
  userId: string;
  server: MCPServerConfig;
}): Promise<string | undefined> {
  const url = new URL(server.url);
  const probe = new MCPClient({
    id: `mcp-probe-${userId}-${server.name}`,
    servers: {
      [server.name]: {
        connectTimeout: 2000,
        url,
        allowedHosts: [url.host],
        ...(server.token
          ? {
              requestInit: {
                headers: { Authorization: `Bearer ${server.token}` },
              },
            }
          : {}),
      },
    },
  });
  probe.__setLogger(logger);
  try {
    const { errors } = await probe.listToolsWithErrors();
    const error = errors[server.name];
    if (error) {
      logger.debug('[mcp] connection check failed', {
        error,
        name: server.name,
        userId,
      });
      return cleanMCPErrorMessage({ serverName: server.name, raw: error });
    }
  } catch (error) {
    logger.debug('[mcp] connection check failed', {
      error,
      name: server.name,
      userId,
    });
    return cleanMCPErrorMessage({
      serverName: server.name,
      raw: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await probe.disconnect().catch(() => {
      // best-effort cleanup of the throwaway probe client
    });
  }
}

export async function userMCPTools(
  userId: string
): Promise<Record<string, unknown>> {
  try {
    const [servers, githubToken, githubPermission] = await Promise.all([
      listMCPServers(userId),
      githubAccessToken(userId),
      getGitHubPermission(userId),
    ]);
    // GitHub is connected from its own App Home section, not added as a row, so
    // it joins the same client without appearing in the user's server list.
    const connected = githubToken
      ? [
          ...servers,
          {
            name: GITHUB_SERVER_NAME,
            permission: githubPermission,
            token: githubToken,
            url: GITHUB_MCP_URL,
          },
        ]
      : servers;
    if (connected.length === 0) {
      await dropClient(userId);
      return {};
    }
    for (const server of connected) {
      mcpServerNames.add(server.name);
    }
    const client = await resolveClient({ servers: connected, userId });
    const { tools, errors } = await client.listToolsWithErrors();

    const githubError = errors[GITHUB_SERVER_NAME];
    if (githubError) {
      logger.warn('[mcp] github server failed', { error: githubError, userId });
    }

    await Promise.all(
      servers.map((server) => {
        const rawError = errors[server.name];
        return setMCPServerError({
          userId,
          name: server.name,
          error: rawError
            ? cleanMCPErrorMessage({ serverName: server.name, raw: rawError })
            : null,
        });
      })
    );
    return tools;
  } catch (error) {
    logger.debug('[mcp] failed to list user servers', { error, userId });
    return {};
  }
}
