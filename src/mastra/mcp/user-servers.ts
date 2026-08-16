import { MCPClient } from '@mastra/mcp';
import { logger } from '../lib/logger';
import { getUserSettings } from '../lib/settings';
import type { McpServerConfig } from '../types';

const clients = new Map<string, { client: MCPClient; key: string }>();

async function resolveClient({
  userId,
  servers,
}: {
  userId: string;
  servers: McpServerConfig[];
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
export async function userMcpTools(
  userId: string
): Promise<Record<string, unknown>> {
  const { mcpServers } = await getUserSettings(userId);
  if (!mcpServers || mcpServers.length === 0) {
    return {};
  }
  try {
    const client = await resolveClient({ userId, servers: mcpServers });
    return await client.listTools();
  } catch (error) {
    logger.debug('[mcp] failed to list user servers', { error, userId });
    return {};
  }
}
