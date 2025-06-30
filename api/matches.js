import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'Year required' });

  try {
    // Create client with basic configuration to avoid migration issues
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    const matches = await db.execute({
      sql: `SELECT * FROM AFL_data WHERE strftime('%Y', match_date) = ?`,
      args: [year]
    });
    
    res.json(matches.rows);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
}