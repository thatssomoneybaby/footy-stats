import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, round } = req.query;
  
  if (!year) {
    return res.status(400).json({ error: 'Year parameter required' });
  }

  try {
    // Create client with basic configuration to avoid migration issues
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    if (round) {
      // Get matches for a specific round
      const matches = await db.execute({
        sql: `
          SELECT DISTINCT
            match_id,
            match_date,
            match_round,
            match_home_team,
            match_away_team,
            match_home_team_score,
            match_away_team_score,
            match_winner,
            match_margin,
            venue_name
          FROM AFL_data 
          WHERE strftime('%Y', match_date) = ? AND match_round = ?
          ORDER BY match_date
        `,
        args: [year, round]
      });
      
      res.json(matches.rows);
    } else {
      // Get all rounds for a year
      const rounds = await db.execute({
        sql: `
          SELECT DISTINCT 
            match_round,
            COUNT(DISTINCT match_id) as match_count,
            MIN(match_date) as first_match_date,
            MAX(match_date) as last_match_date
          FROM AFL_data 
          WHERE strftime('%Y', match_date) = ?
            AND match_round IS NOT NULL 
            AND match_round != ''
          GROUP BY match_round
          ORDER BY 
            CASE 
              WHEN match_round GLOB '[0-9]*' THEN CAST(match_round AS INTEGER)
              ELSE 999 
            END,
            match_round
        `,
        args: [year]
      });
      
      res.json(rounds.rows);
    }
  } catch (error) {
    console.error('Error fetching rounds:', error);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
}