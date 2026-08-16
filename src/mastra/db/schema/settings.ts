import type { ColumnType } from 'kysely';

export interface UserSettingsTable {
  instructions: ColumnType<string | null, string | null, string | null>;
  updated_at: ColumnType<Date, Date, Date>;
  user_id: string;
}
