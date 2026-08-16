import { MCPClient } from '@mastra/mcp';
import { listMCPServers } from '../db/queries/mcps';
import { logger } from '../lib/logger';
import type { MCPServerConfig } from '../types';

const clients = new Map<string, { key: string; promise: Promise<MCPClient> }>();

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
  return new MCPClient({
    id: `user-mcp-${userId}`,
    servers: Object.fromEntries(
      servers.map((server) => {
        const url = new URL(server.url);
        return [
          server.name,
          {
            url,
            requireToolApproval: true,
            allowedHosts: [url.host],
            ...(server.token
              ? {
                  requestInit: {
                    headers: { Authorization: `Bearer ${server.token}` },
                  },
                }
              : {}),
          },
        ];
      })
    ),
  });
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

// User-added MCP servers are arbitrary, unvetted third parties, so every tool
// from them requires approval before it runs (requireToolApproval above) and
// a connection failure never blocks the turn, it just means one user loses
// their extra tools for that turn.
export async function userMCPTools(
  userId: string
): Promise<Record<string, unknown>> {
  try {
    const servers = await listMCPServers(userId);
    if (servers.length === 0) {
      await dropClient(userId);
      return {};
    }
    const client = await resolveClient({ userId, servers });
    return await client.listTools();
  } catch (error) {
    logger.debug('[mcp] failed to list user servers', { error, userId });
    return {};
  }
}
