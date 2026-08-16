import { sql } from 'kysely';
import { db } from './client';
import { createMCPServersTable } from './schema/mcps';
import { createUserSettingsTable } from './schema/settings';

export { db, postgresStore } from './client';

interface LegacyUserSettings {
  instructions?: string;
  mcpServers?: { name: string; url: string; token?: string }[];
}

// Older deploys kept everything in a single `settings` jsonb blob on
// user_settings. Backfill its data into the now-separate instructions
// column and mcp_servers table before dropping it, so upgrading in place
// doesn't silently lose anyone's saved settings.
async function migrateLegacySettingsColumn(): Promise<void> {
  const tables = await db.introspection.getTables();
  const userSettingsTable = tables.find(
    (table) => table.name === 'user_settings'
  );
  const hasLegacyColumn = userSettingsTable?.columns.some(
    (column) => column.name === 'settings'
  );
  if (!hasLegacyColumn) {
    return;
  }

  const rows = await sql<{
    user_id: string;
    settings: LegacyUserSettings | null;
  }>`
    select user_id, settings from user_settings where settings is not null
  `.execute(db);

  await Promise.all(
    rows.rows.map(async (row) => {
      const legacy = row.settings;
      if (!legacy) {
        return;
      }
      await Promise.all([
        legacy.instructions
          ? db
              .updateTable('user_settings')
              .set({ instructions: legacy.instructions })
              .where('user_id', '=', row.user_id)
              .where('instructions', 'is', null)
              .execute()
          : undefined,
        ...(legacy.mcpServers ?? []).map((server) =>
          db
            .insertInto('mcp_servers')
            .values({
              name: server.name,
              token: server.token ?? null,
              url: server.url,
              user_id: row.user_id,
            })
            .onConflict((oc) => oc.columns(['user_id', 'name']).doNothing())
            .execute()
        ),
      ]);
    })
  );

  await db.schema.alterTable('user_settings').dropColumn('settings').execute();
}

export async function createTables(): Promise<void> {
  await Promise.all([createMCPServersTable(), createUserSettingsTable()]);
  await migrateLegacySettingsColumn();
}
