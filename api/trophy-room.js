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

    const keyStats = [
      { name: 'Total Goals', column: 'goals', icon: '⚽', category: 'Scoring' },
      { name: 'Total Disposals', column: 'disposals', icon: '🎯', category: 'Possession' },
      { name: 'Total Tackles', column: 'tackles', icon: '💪', category: 'Defence' }
    ];

    const trophyHolders = [];

    for (const stat of keyStats) {
      try {
        const result = await db.execute({
          sql: `
            SELECT 
              player_first_name,
              player_last_name,
              player_id,
              SUM(CAST(${stat.column} AS INTEGER)) as stat_value,
              COUNT(DISTINCT match_id) as games_played
            FROM AFL_data 
            WHERE ${stat.column} IS NOT NULL 
              AND ${stat.column} != ''
              AND CAST(${stat.column} AS INTEGER) > 0
            GROUP BY player_id, player_first_name, player_last_name
            ORDER BY stat_value DESC 
            LIMIT 1
          `
        });
        
        if (result.rows.length > 0) {
          trophyHolders.push({
            ...stat,
            player: result.rows[0]
          });
        }
      } catch (statError) {
        console.error(`Error processing stat ${stat.name}:`, statError);
      }
    }

    res.json(trophyHolders);
  } catch (error) {
    console.error('Trophy room error:', error);
    res.status(500).json({ error: 'Failed to load trophy room' });
  }
}