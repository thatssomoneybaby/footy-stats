import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'Year required' });

  try {
    // Create client with basic configuration to avoid migration issues
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    // Optimized query - only select needed columns and add pagination
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
        WHERE strftime('%Y', match_date) = ?
        ORDER BY match_date DESC
        LIMIT 100
      `,
      args: [year]
    });
    
    res.json(matches.rows);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
}