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

    const statCategories = {
      'Scoring': {
        icon: '⚽',
        color: 'red',
        stats: [
          { name: 'Goals', column: 'goals', icon: '⚽' },
          { name: 'Behinds', column: 'behinds', icon: '🎯' }
        ]
      },
      'Possession': {
        icon: '🏐',
        color: 'blue',
        stats: [
          { name: 'Disposals', column: 'disposals', icon: '🎯' },
          { name: 'Kicks', column: 'kicks', icon: '🦵' },
          { name: 'Handballs', column: 'handballs', icon: '✋' }
        ]
      },
      'Defence': {
        icon: '🛡️',
        color: 'purple',
        stats: [
          { name: 'Tackles', column: 'tackles', icon: '💪' },
          { name: 'Marks', column: 'marks', icon: '🙌' }
        ]
      }
    };

    const hallOfRecords = {};

    // Process each category
    for (const [categoryName, categoryData] of Object.entries(statCategories)) {
      hallOfRecords[categoryName] = {
        ...categoryData,
        records: {}
      };

      // Process each stat in the category
      for (const stat of categoryData.stats) {
        try {
          // Get top 10 career totals for this stat
          const top10 = await db.execute({
            sql: `
              SELECT 
                player_first_name,
                player_last_name,
                player_id,
                SUM(CAST(${stat.column} AS INTEGER)) as stat_value,
                COUNT(DISTINCT match_id) as games_played,
                AVG(CAST(${stat.column} AS INTEGER)) as avg_per_game,
                MIN(substr(match_date, 1, 4)) as first_year,
                MAX(substr(match_date, 1, 4)) as last_year
              FROM AFL_data 
              WHERE ${stat.column} IS NOT NULL 
                AND ${stat.column} != ''
                AND CAST(${stat.column} AS INTEGER) > 0
              GROUP BY player_id, player_first_name, player_last_name
              ORDER BY stat_value DESC 
              LIMIT 10
            `
          });

          if (top10.rows.length > 0) {
            hallOfRecords[categoryName].records[stat.name] = {
              ...stat,
              top10: top10.rows
            };
          }
        } catch (statError) {
          console.error(`Error processing stat ${stat.name}:`, statError);
        }
      }
    }

    res.json(hallOfRecords);
  } catch (error) {
    console.error('Hall of Records error:', error);
    res.status(500).json({ error: 'Failed to load Hall of Records' });
  }
}