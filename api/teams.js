import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Environment check:', {
      hasUrl: !!process.env.TURSO_DB_URL,
      hasToken: !!process.env.TURSO_DB_AUTH_TOKEN,
      urlPrefix: process.env.TURSO_DB_URL?.substring(0, 20)
    });

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
    
    console.log('Query successful, rows:', teams.rows.length);
    res.json(teams.rows);
  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to fetch teams',
      details: error.message 
    });
  }
}