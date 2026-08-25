import { type ColumnType, sql } from 'kysely';
import { db } from '../client';

export interface GitHubCredentialsTable {
  created_at: ColumnType<Date, Date | undefined, Date>;
  expires_at: ColumnType<Date | null, Date | null, Date | null>;
  kind: string;
  login: string;
  refresh_token: ColumnType<string | null, string | null, string | null>;
  scopes: ColumnType<string | null, string | null, string | null>;
  token: string;
  user_id: string;
}

export async function createGitHubCredentialsTable(): Promise<void> {
  await db.schema
    .createTable('github_credentials')
    .ifNotExists()
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('token', 'text', (col) => col.notNull())
    .addColumn('login', 'text', (col) => col.notNull())
    .addColumn('refresh_token', 'text')
    .addColumn('expires_at', 'timestamptz')
    .addColumn('scopes', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint('github_credentials_pk', ['user_id'])
    .execute();

  await sql`
    alter table github_credentials
      add column if not exists refresh_token text,
      add column if not exists expires_at timestamptz,
      add column if not exists scopes text
  `.execute(db);
}
