import { PostgresStore } from '@mastra/pg';
import { env } from '@/env';

export const postgresStore = new PostgresStore({
  id: 'main-storage',
  connectionString: env.DATABASE_URL,
});
