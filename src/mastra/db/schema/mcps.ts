import { type ColumnType, type Selectable, sql } from 'kysely';
import { db } from '../client';

export interface MCPServersTable {
  created_at: ColumnType<Date, Date | undefined, Date>;
  name: string;
  token: ColumnType<string | null, string | null, string | null>;
  url: string;
  user_id: string;
}

export type MCPServerRow = Selectable<MCPServersTable>;

export async function createMCPServersTable(): Promise<void> {
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
}
