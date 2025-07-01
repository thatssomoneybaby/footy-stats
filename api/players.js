import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { letter } = req.query;
  
  if (!letter) {
    return res.status(400).json({ error: 'Letter parameter required' });
  }
  
  try {
    // Create client with basic configuration to avoid migration issues
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    // Optimized query - add pagination and only calculate when needed
    const players = await db.execute({
      sql: `
        SELECT 
          player_id,
          player_first_name,
          player_last_name,
          COUNT(DISTINCT match_id) as total_games,
          SUM(CASE WHEN disposals IS NOT NULL AND disposals != '' AND CAST(disposals AS INTEGER) > 0 THEN CAST(disposals AS INTEGER) ELSE 0 END) as total_disposals,
          SUM(CASE WHEN goals IS NOT NULL AND goals != '' AND CAST(goals AS INTEGER) > 0 THEN CAST(goals AS INTEGER) ELSE 0 END) as total_goals,
          ROUND(AVG(CASE WHEN disposals IS NOT NULL AND disposals != '' AND CAST(disposals AS INTEGER) > 0 THEN CAST(disposals AS INTEGER) ELSE NULL END), 1) as avg_disposals,
          ROUND(AVG(CASE WHEN goals IS NOT NULL AND goals != '' AND CAST(goals AS INTEGER) > 0 THEN CAST(goals AS INTEGER) ELSE NULL END), 1) as avg_goals,
          MIN(substr(match_date, 1, 4)) as first_year,
          MAX(substr(match_date, 1, 4)) as last_year
        FROM AFL_data
        WHERE player_id IS NOT NULL AND player_id != ''
          AND player_first_name IS NOT NULL AND player_first_name != ''
          AND player_last_name IS NOT NULL AND player_last_name != ''
          AND UPPER(SUBSTR(player_last_name, 1, 1)) = UPPER(?)
        GROUP BY player_id, player_first_name, player_last_name
        HAVING total_games > 0
        ORDER BY player_last_name, player_first_name
        LIMIT 50
      `,
      args: [letter]
    });
    
    res.json(players.rows);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
}