import { PostgresStore } from '@mastra/pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { env } from '@/env';
import type { McpServersTable } from './schema/mcps';
import type { UserSettingsTable } from './schema/settings';

export const postgresStore = new PostgresStore({
  id: 'main-storage',
  connectionString: env.DATABASE_URL,
});

interface Database {
  mcp_servers: McpServersTable;
  user_settings: UserSettingsTable;
}

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool: postgresStore.pool }),
});

let tablesReady: Promise<void> | undefined;

export function ensureTables(): Promise<void> {
  const ready: Promise<void> =
    tablesReady ??
    (async () => {
      await db.schema
        .createTable('user_settings')
        .ifNotExists()
        .addColumn('user_id', 'text', (col) => col.primaryKey())
        .addColumn('instructions', 'text')
        .addColumn('updated_at', 'timestamptz', (col) =>
          col.notNull().defaultTo(sql`now()`)
        )
        .execute();
      await db.schema
        .createTable('mcp_servers')
        .ifNotExists()
        .addColumn('user_id', 'text', (col) => col.notNull())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('url', 'text', (col) => col.notNull())
        .addColumn('token', 'text')
        .addColumn('created_at', 'timestamptz', (col) =>
          col.notNull().defaultTo(sql`now()`)
        )
        .addPrimaryKeyConstraint('mcp_servers_pk', ['user_id', 'name'])
        .execute();
    })();
  tablesReady = ready;
  return ready;
}
