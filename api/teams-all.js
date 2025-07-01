import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamName } = req.query;

  try {
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    if (teamName) {
      // Team details endpoint
      const teamStats = await db.execute({
        sql: `
          SELECT 
            COUNT(DISTINCT match_id) as total_matches,
            SUM(CASE WHEN match_winner = ? THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN match_winner != ? AND match_winner IS NOT NULL THEN 1 ELSE 0 END) as losses,
            MAX(CASE WHEN match_home_team = ? THEN CAST(match_home_team_score AS INTEGER) ELSE CAST(match_away_team_score AS INTEGER) END) as highest_score,
            MIN(CASE WHEN match_home_team = ? THEN CAST(match_home_team_score AS INTEGER) ELSE CAST(match_away_team_score AS INTEGER) END) as lowest_score
          FROM (
            SELECT DISTINCT match_id, match_home_team, match_away_team, match_winner, 
                   match_home_team_score, match_away_team_score
            FROM AFL_data 
            WHERE match_home_team = ? OR match_away_team = ?
          )
        `,
        args: [teamName, teamName, teamName, teamName, teamName, teamName]
      });

      const topDisposals = await db.execute({
        sql: `
          SELECT 
            player_first_name, player_last_name,
            SUM(CAST(disposals AS INTEGER)) as total_disposals,
            COUNT(DISTINCT match_id) as games_played
          FROM AFL_data 
          WHERE player_team = ? AND disposals IS NOT NULL AND disposals != ''
          GROUP BY player_id, player_first_name, player_last_name
          ORDER BY total_disposals DESC LIMIT 10
        `,
        args: [teamName]
      });

      const topGoals = await db.execute({
        sql: `
          SELECT 
            player_first_name, player_last_name,
            SUM(CAST(goals AS INTEGER)) as total_goals,
            COUNT(DISTINCT match_id) as games_played
          FROM AFL_data 
          WHERE player_team = ? AND goals IS NOT NULL AND goals != ''
          GROUP BY player_id, player_first_name, player_last_name
          ORDER BY total_goals DESC LIMIT 10
        `,
        args: [teamName]
      });

      const grandFinals = await db.execute({
        sql: `
          SELECT COUNT(DISTINCT match_id) as grand_finals_won
          FROM AFL_data 
          WHERE (match_home_team = ? OR match_away_team = ?)
            AND (match_round = 'GF' OR match_round = 'Grand Final')
            AND match_winner = ?
        `,
        args: [teamName, teamName, teamName]
      });

      const biggestWin = await db.execute({
        sql: `
          SELECT DISTINCT match_date, match_home_team, match_away_team,
                 CAST(match_margin AS INTEGER) as margin, venue_name
          FROM AFL_data
          WHERE match_winner = ?
          ORDER BY CAST(match_margin AS INTEGER) DESC LIMIT 1
        `,
        args: [teamName]
      });

      const allGames = await db.execute({
        sql: `
          SELECT DISTINCT match_id, match_home_team, match_away_team, match_winner, 
                 match_home_team_score, match_away_team_score, match_margin, 
                 match_date, match_round, venue_name
          FROM AFL_data 
          WHERE match_home_team = ? OR match_away_team = ?
          ORDER BY match_date DESC LIMIT 50
        `,
        args: [teamName, teamName]
      });

      res.json({
        team: teamName,
        stats: teamStats.rows[0],
        topDisposals: topDisposals.rows,
        topGoals: topGoals.rows,
        grandFinals: grandFinals.rows[0],
        biggestWin: biggestWin.rows[0],
        allGames: allGames.rows
      });
    } else {
      // Teams list endpoint
      const teams = await db.execute(`
        SELECT DISTINCT match_home_team as team_name
        FROM AFL_data 
        WHERE match_home_team IS NOT NULL AND match_home_team != ''
        ORDER BY match_home_team
      `);
      
      res.json(teams.rows);
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch team data' });
  }
}