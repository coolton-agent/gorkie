import { type ColumnType, sql } from 'kysely';
import { db } from '../client';

export interface UserSettingsTable {
  github_login: ColumnType<string | null, string | null, string | null>;
  github_token: ColumnType<string | null, string | null, string | null>;
  instructions: ColumnType<string | null, string | null, string | null>;
  updated_at: ColumnType<Date, Date, Date>;
  user_id: string;
}

export async function createUserSettingsTable(): Promise<void> {
  await db.schema
    .createTable('user_settings')
    .ifNotExists()
    .addColumn('user_id', 'text', (col) => col.primaryKey())
    .addColumn('instructions', 'text')
    .addColumn('github_token', 'text')
    .addColumn('github_login', 'text')
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .alterTable('user_settings')
    .addColumn('github_token', 'text', (col) => col.ifNotExists())
    .execute();

  await db.schema
    .alterTable('user_settings')
    .addColumn('github_login', 'text', (col) => col.ifNotExists())
    .execute();
}
