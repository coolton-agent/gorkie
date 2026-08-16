import { rawId } from '../../lib/ids';
import type { MCPServerConfig } from '../../types';
import { db } from '../client';

export async function listMCPServers(
  userId: string
): Promise<MCPServerConfig[]> {
  const rows = await db
    .selectFrom('mcp_servers')
    .select(['name', 'url', 'token'])
    .where('user_id', '=', rawId(userId))
    .orderBy('created_at', 'asc')
    .execute();
  return rows.map((row) => ({
    name: row.name,
    token: row.token ?? undefined,
    url: row.url,
  }));
}

export async function upsertMCPServer({
  userId,
  server,
}: {
  userId: string;
  server: MCPServerConfig;
}): Promise<void> {
  await db
    .insertInto('mcp_servers')
    .values({
      name: server.name,
      token: server.token ?? null,
      url: server.url,
      user_id: rawId(userId),
    })
    .onConflict((oc) =>
      oc
        .columns(['user_id', 'name'])
        .doUpdateSet({ token: server.token ?? null, url: server.url })
    )
    .execute();
}

export async function removeMCPServer({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): Promise<void> {
  await db
    .deleteFrom('mcp_servers')
    .where('user_id', '=', rawId(userId))
    .where('name', '=', name)
    .execute();
}
