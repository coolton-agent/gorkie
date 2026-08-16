import { type ColumnType, Kysely, PostgresDialect, sql } from 'kysely';
import { type UserSettings, userSettingsSchema } from '../types';
import { postgresStore } from './db';
import { rawId } from './ids';

interface UserSettingsTable {
  settings: ColumnType<unknown, string, string>;
  updated_at: ColumnType<Date, Date, Date>;
  user_id: string;
}

interface Database {
  user_settings: UserSettingsTable;
}

const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool: postgresStore.pool }),
});

let tableReady: Promise<void> | undefined;

function ensureTable(): Promise<void> {
  const ready: Promise<void> =
    tableReady ??
    db.schema
      .createTable('user_settings')
      .ifNotExists()
      .addColumn('user_id', 'text', (col) => col.primaryKey())
      .addColumn('settings', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'{}'::jsonb`)
      )
      .addColumn('updated_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`)
      )
      .execute()
      .then(() => undefined);
  tableReady = ready;
  return ready;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  await ensureTable();
  const row = await db
    .selectFrom('user_settings')
    .select('settings')
    .where('user_id', '=', rawId(userId))
    .executeTakeFirst();
  return row ? userSettingsSchema.parse(row.settings) : {};
}

export async function setUserSettings(
  userId: string,
  patch: UserSettings
): Promise<UserSettings> {
  await ensureTable();
  const current = await getUserSettings(userId);
  const next = userSettingsSchema.parse({ ...current, ...patch });
  const settings = JSON.stringify(next);
  const now = new Date();
  await db
    .insertInto('user_settings')
    .values({ user_id: rawId(userId), settings, updated_at: now })
    .onConflict((oc) =>
      oc.column('user_id').doUpdateSet({ settings, updated_at: now })
    )
    .execute();
  return next;
}
