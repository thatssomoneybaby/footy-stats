import { createClient } from '@libsql/client';
import { getCached, setCache } from '../lib/cache.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cacheKey = 'teams_list';
    const cached = getCached(cacheKey);
    
    if (cached) {
      console.log('Returning cached teams data');
      return res.json(cached);
    }

    // Create the client inside the handler to ensure env vars are loaded
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    // Simple efficient query - just get home teams (they appear as away teams too)
    const teams = await db.execute(`
      SELECT DISTINCT
        match_home_team as team_name,
        MIN(substr(match_date, 1, 4)) as first_year,
        MAX(substr(match_date, 1, 4)) as last_year,
        COUNT(DISTINCT match_id) as total_matches
      FROM AFL_data 
      WHERE match_home_team IS NOT NULL AND match_home_team != ''
      GROUP BY match_home_team
      ORDER BY match_home_team
    `);
    
    console.log('Query successful, rows:', teams.rows.length);
    
    // Cache the result for 5 minutes
    setCache(cacheKey, teams.rows);
    
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