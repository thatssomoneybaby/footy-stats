import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { letter, playerId, alphabet } = req.query;

  try {
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    if (alphabet === 'true') {
      // Players alphabet endpoint
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
    } else if (playerId) {
      // Individual player details
      const playerStats = await db.execute({
        sql: `
          SELECT 
            player_first_name, player_last_name,
            COUNT(DISTINCT match_id) as total_games,
            SUM(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE 0 END) as total_disposals,
            SUM(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE 0 END) as total_goals,
            MIN(substr(match_date, 1, 4)) as first_year,
            MAX(substr(match_date, 1, 4)) as last_year
          FROM AFL_data 
          WHERE player_id = ?
          GROUP BY player_id, player_first_name, player_last_name
        `,
        args: [playerId]
      });

      const allGames = await db.execute({
        sql: `
          SELECT match_id, match_date, match_round, venue_name,
                 match_home_team, match_away_team, player_team,
                 disposals, goals, kicks, handballs, marks, tackles
          FROM AFL_data 
          WHERE player_id = ?
          ORDER BY match_date DESC LIMIT 50
        `,
        args: [playerId]
      });

      res.json({
        player: playerStats.rows[0],
        allGames: allGames.rows
      });
    } else if (letter) {
      // Players by letter
      const players = await db.execute({
        sql: `
          SELECT 
            player_id, player_first_name, player_last_name,
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
          ORDER BY player_last_name, player_first_name LIMIT 50
        `,
        args: [letter]
      });
      res.json(players.rows);
    } else {
      res.status(400).json({ error: 'Missing required parameter' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
}