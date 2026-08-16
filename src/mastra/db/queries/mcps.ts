import { rawId } from '../../lib/ids';
import type { McpServerConfig } from '../../types';
import { db, ensureTables } from '../index';

export async function listMcpServers(
  userId: string
): Promise<McpServerConfig[]> {
  await ensureTables();
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

export async function upsertMcpServer({
  userId,
  server,
}: {
  userId: string;
  server: McpServerConfig;
}): Promise<void> {
  await ensureTables();
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

export async function removeMcpServer({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): Promise<void> {
  await ensureTables();
  await db
    .deleteFrom('mcp_servers')
    .where('user_id', '=', rawId(userId))
    .where('name', '=', name)
    .execute();
}
