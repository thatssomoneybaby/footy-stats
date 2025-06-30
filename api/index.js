import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const app = express();
app.use(cors());

const db = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

// Endpoint: get all available years
app.get('/years', async (_, res) => {
  try {
    const years = await db.execute(`
      SELECT DISTINCT substr(match_date, 1, 4) AS year
      FROM AFL_data
      WHERE year GLOB '[1-2][0-9][0-9][0-9]'
      ORDER BY year DESC
    `);
    res.json(years.rows.map(row => row.year));
  } catch (error) {
    console.error('Error fetching years:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

// Endpoint: get all matches for a given year
app.get('/matches', async (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'Year required' });

  try {
    const matches = await db.execute({
      sql: `SELECT * FROM AFL_data WHERE strftime('%Y', match_date) = ?`,
      args: [year]
    });
    res.json(matches.rows);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Endpoint: get all unique teams with their year range
app.get('/teams', async (_, res) => {
  try {
    const teams = await db.execute(`
      SELECT 
        team_name,
        MIN(substr(match_date, 1, 4)) as first_year,
        MAX(substr(match_date, 1, 4)) as last_year,
        COUNT(DISTINCT match_id) as total_matches
      FROM (
        SELECT match_home_team as team_name, match_date, match_id FROM AFL_data
        UNION
        SELECT match_away_team as team_name, match_date, match_id FROM AFL_data
      )
      WHERE team_name IS NOT NULL AND team_name != ''
      GROUP BY team_name
      ORDER BY team_name
    `);
    res.json(teams.rows);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Endpoint: get team stats and summary
app.get('/teams/:teamName', async (req, res) => {
  const { teamName } = req.params;
  
  try {
    // Get basic team stats
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

    // Get top disposal getters
    const topDisposals = await db.execute({
      sql: `
        SELECT 
          player_first_name,
          player_last_name,
          SUM(CAST(disposals AS INTEGER)) as total_disposals,
          COUNT(DISTINCT match_id) as games_played,
          AVG(CAST(disposals AS INTEGER)) as avg_disposals
        FROM AFL_data 
        WHERE player_team = ? 
          AND disposals IS NOT NULL 
          AND disposals != ''
        GROUP BY player_id, player_first_name, player_last_name
        ORDER BY total_disposals DESC 
        LIMIT 10
      `,
      args: [teamName]
    });

    // Get top goal kickers
    const topGoals = await db.execute({
      sql: `
        SELECT 
          player_first_name,
          player_last_name,
          SUM(CAST(goals AS INTEGER)) as total_goals,
          COUNT(DISTINCT match_id) as games_played,
          AVG(CAST(goals AS INTEGER)) as avg_goals
        FROM AFL_data 
        WHERE player_team = ? 
          AND goals IS NOT NULL 
          AND goals != ''
        GROUP BY player_id, player_first_name, player_last_name
        ORDER BY total_goals DESC 
        LIMIT 10
      `,
      args: [teamName]
    });

    res.json({
      team: teamName,
      stats: teamStats.rows[0],
      topDisposals: topDisposals.rows,
      topGoals: topGoals.rows
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

// Endpoint: get alphabet letters with player counts
app.get('/players/alphabet', async (_, res) => {
  try {
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
});

// Endpoint: get players by letter
app.get('/players', async (req, res) => {
  const { letter } = req.query;
  
  if (!letter) {
    return res.status(400).json({ error: 'Letter parameter required' });
  }
  
  try {
    const players = await db.execute({
      sql: `
        SELECT 
          player_id,
          player_first_name,
          player_last_name,
          COUNT(DISTINCT match_id) as total_games,
          SUM(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE 0 END) as total_disposals,
          SUM(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE 0 END) as total_goals,
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
      `,
      args: [letter]
    });
    res.json(players.rows);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Endpoint: get individual player stats
app.get('/players/:playerId', async (req, res) => {
  const { playerId } = req.params;
  
  try {
    const playerStats = await db.execute({
      sql: `
        SELECT 
          player_first_name,
          player_last_name,
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
        SELECT 
          match_id, match_date, match_round, venue_name,
          match_home_team, match_away_team, player_team,
          disposals, goals, kicks, handballs, marks, tackles
        FROM AFL_data 
        WHERE player_id = ?
        ORDER BY match_date DESC
      `,
      args: [playerId]
    });

    res.json({
      player: playerStats.rows[0],
      allGames: allGames.rows
    });
  } catch (error) {
    console.error('Error fetching player details:', error);
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
});

// Endpoint: get trophy room - top performers
app.get('/trophy-room', async (_, res) => {
  try {
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
});

// For Vercel deployment, we need to handle both development and production
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  app.listen(port, () => {
    console.log(`✅ API running on http://localhost:${port}`);
  });
}

// Export the app for Vercel
export default app;