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
  // `instructions` column; adding the new column is idempotent, but the
  // old column is only dropped once migrateLegacySettingsColumn (db/index.ts)
  // has backfilled its data, so it runs after both tables exist.
  await db.schema
    .alterTable('user_settings')
    .addColumn('instructions', 'text', (col) => col.ifNotExists())
    .execute();
}
