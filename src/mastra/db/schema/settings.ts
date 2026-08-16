import { type ColumnType, type Selectable, sql } from 'kysely';
import { db } from '../client';

export interface UserSettingsTable {
  instructions: ColumnType<string | null, string | null, string | null>;
  updated_at: ColumnType<Date, Date, Date>;
  user_id: string;
}

export type UserSettingsRow = Selectable<UserSettingsTable>;

export async function createUserSettingsTable(): Promise<void> {
  await db.schema
    .createTable('user_settings')
    .ifNotExists()
    .addColumn('user_id', 'text', (col) => col.primaryKey())
    .addColumn('instructions', 'text')
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Older deploys had a jsonb `settings` blob instead of a plain
  // `instructions` column; both sides are idempotent so this is safe
  // to run every boot regardless of which shape the table already has.
  await db.schema
    .alterTable('user_settings')
    .addColumn('instructions', 'text', (col) => col.ifNotExists())
    .dropColumn('settings', (col) => col.ifExists())
    .execute();
}
