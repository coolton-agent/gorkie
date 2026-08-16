import { type ColumnType, type Selectable, sql } from 'kysely';
import { db } from '../index';

export interface UserSettingsTable {
  instructions: ColumnType<string | null, string | null, string | null>;
  updated_at: ColumnType<Date, Date, Date>;
  user_id: string;
}

export type UserSettingsRow = Selectable<UserSettingsTable>;

let tableReady: Promise<void> | undefined;

export function ensureUserSettingsTable(): Promise<void> {
  const ready: Promise<void> =
    tableReady ??
    db.schema
      .createTable('user_settings')
      .ifNotExists()
      .addColumn('user_id', 'text', (col) => col.primaryKey())
      .addColumn('instructions', 'text')
      .addColumn('updated_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .execute()
      .then(() => undefined);
  tableReady = ready;
  return ready;
}
