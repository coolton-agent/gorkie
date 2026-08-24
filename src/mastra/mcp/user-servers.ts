import { MCPClient } from '@mastra/mcp';
import { z } from 'zod';
import { listMCPServers, setMCPServerError } from '../db/queries/mcps';
import { logger } from '../lib/logger';
import type { MCPServerConfig, ToolPermission } from '../types';
import { cleanMCPErrorMessage } from './errors';

const clients = new Map<string, { key: string; promise: Promise<MCPClient> }>();

export const mcpServerNames = new Set<string>();

// Whether a server labels its tools as read-only. Without that label every
// call counts as a write, so the ask-before-writing setting behaves like
// ask-for-everything. Filled in as tools are listed, so it is advisory only.
export const annotationCoverage = new Map<
  string,
  { annotated: number; total: number }
>();

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
      annotations?.destructiveHint === true ||
      toolName.startsWith('delete_') ||
      toolName.startsWith('remove_');
    if (permission === 'delete') {
      return deletes;
    }
    return deletes || annotations?.readOnlyHint !== true;
  };
}

const annotatedTool = z.object({
  mcp: z
    .object({
      annotations: z
        .object({ readOnlyHint: z.boolean().optional() })
        .optional(),
    })
    .optional(),
});

function readOnlyHintOf(tool: unknown): boolean | undefined {
  return annotatedTool.safeParse(tool).data?.mcp?.annotations?.readOnlyHint;
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
    const servers = await listMCPServers(userId);
    if (servers.length === 0) {
      await dropClient(userId);
      return {};
    }
    for (const server of servers) {
      mcpServerNames.add(server.name);
    }
    const client = await resolveClient({ servers, userId });
    const { tools, errors } = await client.listToolsWithErrors();

    for (const [id, tool] of Object.entries(tools)) {
      const server = servers.find((entry) =>
        id.startsWith(`${entry.name}_`)
      )?.name;
      if (!server) {
        continue;
      }
      const counts = annotationCoverage.get(server) ?? {
        annotated: 0,
        total: 0,
      };
      counts.total += 1;
      if (readOnlyHintOf(tool) !== undefined) {
        counts.annotated += 1;
      }
      annotationCoverage.set(server, counts);
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
