import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    // Simple query - just count records
    const result = await db.execute('SELECT COUNT(*) as count FROM AFL_data LIMIT 1');
    
    res.json({ count: result.rows[0].count, message: 'Simple test query' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed' });
  }
}