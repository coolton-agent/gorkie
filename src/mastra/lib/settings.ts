import { type UserSettings, userSettingsSchema } from '../types';
import { postgresStore } from './db';
import { rawId } from './ids';

let tableReady: Promise<void> | undefined;

function ensureTable(): Promise<void> {
  const ready: Promise<void> =
    tableReady ??
    postgresStore.pool
      .query(`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id text PRIMARY KEY,
          settings jsonb NOT NULL DEFAULT '{}'::jsonb,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      .then(() => undefined);
  tableReady = ready;
  return ready;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  await ensureTable();
  const result = await postgresStore.pool.query(
    'SELECT settings FROM user_settings WHERE user_id = $1',
    [rawId(userId)]
  );
  const row = result.rows[0] as { settings: unknown } | undefined;
  return row ? userSettingsSchema.parse(row.settings) : {};
}

export async function setUserSettings(
  userId: string,
  patch: UserSettings
): Promise<UserSettings> {
  await ensureTable();
  const current = await getUserSettings(userId);
  const next = userSettingsSchema.parse({ ...current, ...patch });
  await postgresStore.pool.query(
    `INSERT INTO user_settings (user_id, settings, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET settings = $2, updated_at = now()`,
    [rawId(userId), JSON.stringify(next)]
  );
  return next;
}
