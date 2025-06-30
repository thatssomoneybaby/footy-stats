import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create client with basic configuration to avoid migration issues
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    const letters = await db.execute(`
      SELECT 
        UPPER(SUBSTR(player_last_name, 1, 1)) as letter,
        COUNT(DISTINCT player_id) as player_count
      FROM AFL_data
      WHERE player_id IS NOT NULL AND player_id != ''
        AND player_first_name IS NOT NULL AND player_first_name != ''
        AND player_last_name IS NOT NULL AND player_last_name != ''
      GROUP BY letter
      HAVING letter GLOB '[A-Z]'
      ORDER BY letter
    `);
    
    res.json(letters.rows);
  } catch (error) {
    console.error('Error fetching players alphabet:', error);
    res.status(500).json({ error: 'Failed to fetch players alphabet' });
  }
}