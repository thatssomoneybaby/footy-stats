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

    const insights = [];

    // Most recent game result
    const recentGame = await db.execute(`
      SELECT DISTINCT 
        match_home_team,
        match_away_team,
        CAST(match_home_team_score AS INTEGER) as match_home_team_score,
        CAST(match_away_team_score AS INTEGER) as match_away_team_score,
        match_winner,
        CAST(match_margin AS INTEGER) as match_margin,
        match_date,
        venue_name
      FROM AFL_data
      WHERE match_winner IS NOT NULL 
        AND match_margin IS NOT NULL
        AND match_margin != ''
      ORDER BY match_date DESC
      LIMIT 1
    `);

    if (recentGame.rows.length > 0) {
      const game = recentGame.rows[0];
      const loser = game.match_winner === game.match_home_team ? game.match_away_team : game.match_home_team;
      insights.push({
        type: 'recent_game',
        title: 'Most Recent Game',
        description: `${game.match_winner} defeated ${loser} by ${Math.abs(game.match_margin)} points`,
        details: `${game.match_home_team} ${game.match_home_team_score} - ${game.match_away_team_score} ${game.match_away_team}`,
        icon: '🏈'
      });
    }

    // Top disposal getter this season
    const currentYear = new Date().getFullYear();
    const topDisposal = await db.execute({
      sql: `
        SELECT 
          player_first_name,
          player_last_name,
          player_team,
          SUM(CAST(disposals AS INTEGER)) as total_disposals,
          COUNT(DISTINCT match_id) as games
        FROM AFL_data
        WHERE strftime('%Y', match_date) = ?
          AND disposals IS NOT NULL 
          AND disposals != ''
          AND CAST(disposals AS INTEGER) > 0
        GROUP BY player_id, player_first_name, player_last_name, player_team
        ORDER BY total_disposals DESC
        LIMIT 1
      `,
      args: [currentYear.toString()]
    });

    if (topDisposal.rows.length > 0) {
      const player = topDisposal.rows[0];
      insights.push({
        type: 'top_disposals',
        title: `${currentYear} Disposal Leader`,
        description: `${player.player_first_name} ${player.player_last_name} leads with ${player.total_disposals} disposals`,
        details: `${player.player_team} - ${player.games} games played`,
        icon: '🎯'
      });
    }

    // Top goal kicker this season
    const topGoals = await db.execute({
      sql: `
        SELECT 
          player_first_name,
          player_last_name,
          player_team,
          SUM(CAST(goals AS INTEGER)) as total_goals,
          COUNT(DISTINCT match_id) as games
        FROM AFL_data
        WHERE strftime('%Y', match_date) = ?
          AND goals IS NOT NULL 
          AND goals != ''
          AND CAST(goals AS INTEGER) > 0
        GROUP BY player_id, player_first_name, player_last_name, player_team
        ORDER BY total_goals DESC
        LIMIT 1
      `,
      args: [currentYear.toString()]
    });

    if (topGoals.rows.length > 0) {
      const player = topGoals.rows[0];
      insights.push({
        type: 'top_goals',
        title: `${currentYear} Leading Goalkicker`,
        description: `${player.player_first_name} ${player.player_last_name} leads with ${player.total_goals} goals`,
        details: `${player.player_team} - ${player.games} games played`,
        icon: '⚽'
      });
    }

    res.json(insights);
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
}