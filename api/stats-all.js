import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type } = req.query;

  try {
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    if (type === 'trophy-room') {
      // Trophy room
      const keyStats = [
        { name: 'Total Goals', column: 'goals', icon: '⚽', category: 'Scoring' },
        { name: 'Total Disposals', column: 'disposals', icon: '🎯', category: 'Possession' },
        { name: 'Total Tackles', column: 'tackles', icon: '💪', category: 'Defence' }
      ];

      const trophyHolders = [];
      for (const stat of keyStats) {
        const result = await db.execute({
          sql: `
            SELECT player_first_name, player_last_name, player_id,
                   SUM(CAST(${stat.column} AS INTEGER)) as stat_value,
                   COUNT(DISTINCT match_id) as games_played
            FROM AFL_data 
            WHERE ${stat.column} IS NOT NULL AND ${stat.column} != ''
              AND CAST(${stat.column} AS INTEGER) > 0
            GROUP BY player_id, player_first_name, player_last_name
            ORDER BY stat_value DESC LIMIT 1
          `
        });
        
        if (result.rows.length > 0) {
          trophyHolders.push({ ...stat, player: result.rows[0] });
        }
      }
      res.json(trophyHolders);
    } else if (type === 'insights') {
      // Insights
      const insights = [];
      
      const recentGame = await db.execute(`
        SELECT DISTINCT match_home_team, match_away_team,
               CAST(match_home_team_score AS INTEGER) as match_home_team_score,
               CAST(match_away_team_score AS INTEGER) as match_away_team_score,
               match_winner, CAST(match_margin AS INTEGER) as match_margin,
               match_date, venue_name
        FROM AFL_data
        WHERE match_winner IS NOT NULL AND match_margin IS NOT NULL AND match_margin != ''
        ORDER BY match_date DESC LIMIT 1
      `);

      if (recentGame.rows.length > 0) {
        const game = recentGame.rows[0];
        const loser = game.match_winner === game.match_home_team ? game.match_away_team : game.match_home_team;
        insights.push({
          type: 'recent_game',
          title: 'Most Recent Game',
          description: `${game.match_winner} defeated ${loser} by ${Math.abs(game.match_margin)} points`,
          icon: '🏈'
        });
      }

      res.json(insights);
    } else if (type === 'hall-of-records') {
      // Restore original hall of records structure
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
            const top10 = await db.execute({
              sql: `
                SELECT 
                  player_first_name, player_last_name, player_id,
                  SUM(CAST(${stat.column} AS INTEGER)) as stat_value,
                  COUNT(DISTINCT match_id) as games_played,
                  AVG(CAST(${stat.column} AS INTEGER)) as avg_per_game,
                  MIN(substr(match_date, 1, 4)) as first_year,
                  MAX(substr(match_date, 1, 4)) as last_year
                FROM AFL_data 
                WHERE ${stat.column} IS NOT NULL AND ${stat.column} != ''
                  AND CAST(${stat.column} AS INTEGER) > 0
                GROUP BY player_id, player_first_name, player_last_name
                ORDER BY stat_value DESC LIMIT 10
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
    } else {
      res.status(400).json({ error: 'Missing or invalid type parameter' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats data' });
  }
}