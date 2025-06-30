import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { playerId } = req.query;
  
  try {
    // Create client with basic configuration to avoid migration issues
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    const playerStats = await db.execute({
      sql: `
        SELECT 
          player_first_name,
          player_last_name,
          COUNT(DISTINCT match_id) as total_games,
          SUM(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE 0 END) as total_disposals,
          SUM(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE 0 END) as total_goals,
          SUM(CASE WHEN kicks IS NOT NULL AND kicks != '' THEN CAST(kicks AS INTEGER) ELSE 0 END) as total_kicks,
          SUM(CASE WHEN handballs IS NOT NULL AND handballs != '' THEN CAST(handballs AS INTEGER) ELSE 0 END) as total_handballs,
          SUM(CASE WHEN marks IS NOT NULL AND marks != '' THEN CAST(marks AS INTEGER) ELSE 0 END) as total_marks,
          SUM(CASE WHEN tackles IS NOT NULL AND tackles != '' THEN CAST(tackles AS INTEGER) ELSE 0 END) as total_tackles,
          MIN(substr(match_date, 1, 4)) as first_year,
          MAX(substr(match_date, 1, 4)) as last_year,
          MAX(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE NULL END) as best_disposals_game,
          MAX(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE NULL END) as best_goals_game
        FROM AFL_data 
        WHERE player_id = ?
        GROUP BY player_id, player_first_name, player_last_name
      `,
      args: [playerId]
    });

    // Get team and guernsey combinations for this player
    const teamGuernseys = await db.execute({
      sql: `
        SELECT DISTINCT 
          player_team,
          guernsey_number,
          MIN(match_date) as first_game,
          MAX(match_date) as last_game,
          COUNT(DISTINCT match_id) as games_with_number
        FROM AFL_data 
        WHERE player_id = ?
          AND player_team IS NOT NULL 
          AND guernsey_number IS NOT NULL
          AND player_team != ''
          AND guernsey_number != ''
        GROUP BY player_team, guernsey_number
        ORDER BY first_game
      `,
      args: [playerId]
    });

    // Get all games with all available stats
    const allGames = await db.execute({
      sql: `
        SELECT 
          match_id, match_date, match_round, venue_name,
          match_home_team, match_away_team, player_team,
          disposals, goals, kicks, handballs, marks, tackles, behinds
        FROM AFL_data 
        WHERE player_id = ?
        ORDER BY match_date DESC
      `,
      args: [playerId]
    });

    res.json({
      player: playerStats.rows[0],
      teamGuernseys: teamGuernseys.rows,
      allGames: allGames.rows
    });
  } catch (error) {
    console.error('Error fetching player details:', error);
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
}