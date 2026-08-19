import { type ColumnType, type Generated, type Selectable, sql } from 'kysely';
import { db } from '../client';

export const FEEDBACK_KINDS = ['bug', 'praise', 'suggestion', 'other'] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export interface FeedbackTable {
  body: string;
  channel_id: ColumnType<string | null, string | null, string | null>;
  created_at: ColumnType<Date, Date | undefined, Date>;
  id: Generated<number>;
  kind: FeedbackKind;
  thread_id: ColumnType<string | null, string | null, string | null>;
  user_id: string;
}

export type FeedbackRow = Selectable<FeedbackTable>;

export async function createFeedbackTable(): Promise<void> {
  await db.schema
    .createTable('feedback')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('channel_id', 'text')
    .addColumn('thread_id', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex('feedback_created_at_idx')
    .ifNotExists()
    .on('feedback')
    .column('created_at')
    .execute();
}
