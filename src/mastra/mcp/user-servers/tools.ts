import { listMCPServers, setMCPServerError } from '../../db/queries/mcps';
import { logger } from '../../lib/logger';
import { cleanMCPErrorMessage } from '../errors';
import { annotationCoverage, readOnlyHintOf } from './approval';
import { dropClient, mcpServerNames, resolveClient } from './client';

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
