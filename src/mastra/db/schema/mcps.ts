import type { ColumnType } from 'kysely';

export interface McpServersTable {
  created_at: ColumnType<Date, Date | undefined, Date>;
  name: string;
  token: ColumnType<string | null, string | null, string | null>;
  url: string;
  user_id: string;
}
