import { MCPClient } from '@mastra/mcp';
import { listMCPServers } from '../db/queries/mcps';
import { logger } from '../lib/logger';
import type { MCPServerConfig } from '../types';

const clients = new Map<string, { client: MCPClient; key: string }>();

async function resolveClient({
  userId,
  servers,
}: {
  userId: string;
  servers: MCPServerConfig[];
}): Promise<MCPClient> {
  const key = JSON.stringify(servers);
  const cached = clients.get(userId);
  if (cached && cached.key === key) {
    return cached.client;
  }
  if (cached) {
    await cached.client.disconnect().catch((error: unknown) => {
      logger.debug('[mcp] failed to disconnect stale client', {
        error,
        userId,
      });
    });
  }

  const client = new MCPClient({
    id: `user-mcp-${userId}`,
    servers: Object.fromEntries(
      servers.map((server) => [
        server.name,
        {
          url: new URL(server.url),
          requireToolApproval: true,
          ...(server.token
            ? {
                requestInit: {
                  headers: { Authorization: `Bearer ${server.token}` },
                },
              }
            : {}),
        },
      ])
    ),
  });
  clients.set(userId, { client, key });
  return client;
}

// User-added MCP servers are arbitrary, unvetted third parties, so every tool
// from them requires approval before it runs (requireToolApproval above) and
// a connection failure never blocks the turn, it just means one user loses
// their extra tools for that turn.
export async function userMCPTools(
  userId: string
): Promise<Record<string, unknown>> {
  const servers = await listMCPServers(userId);
  if (servers.length === 0) {
    return {};
  }
  try {
    const client = await resolveClient({ userId, servers });
    return await client.listTools();
  } catch (error) {
    logger.debug('[mcp] failed to list user servers', { error, userId });
    return {};
  }
}
