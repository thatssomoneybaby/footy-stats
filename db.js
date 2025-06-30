import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

export const db = client;