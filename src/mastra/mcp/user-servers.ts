import { MCPClient } from '@mastra/mcp';
import { listMCPServers, setMCPServerError } from '../db/queries/mcps';
import { getGitHubAccount } from '../db/queries/settings';
import { GITHUB_MCP_URL, GITHUB_SERVER_NAME } from '../lib/github';
import { logger } from '../lib/logger';
import type { MCPServerConfig } from '../types';
import { cleanMCPErrorMessage } from './errors';

const clients = new Map<string, { key: string; promise: Promise<MCPClient> }>();

// Tool ids arrive as `<server>_<tool>`, and the typing status needs the server
// names to split them back apart. Populated as clients are built.
export const mcpServerNames = new Set<string>();

function needsApproval({
  annotations,
}: {
  annotations?: { readOnlyHint?: boolean };
}): boolean {
  return annotations?.readOnlyHint !== true;
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
              requireToolApproval: needsApproval,
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
  const key = JSON.stringify(servers);
  const cached = clients.get(userId);
  if (cached && cached.key === key) {
    return cached.promise;
  }
  const promise = buildClient({ userId, servers, stale: cached?.promise });
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
    const [servers, github] = await Promise.all([
      listMCPServers(userId),
      getGitHubAccount(userId),
    ]);
    // GitHub is connected from its own App Home section, not added as a row, so
    // it joins the same client without appearing in the user's server list.
    const connected = github
      ? [
          ...servers,
          {
            name: GITHUB_SERVER_NAME,
            token: github.token,
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
    const client = await resolveClient({ userId, servers: connected });
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
