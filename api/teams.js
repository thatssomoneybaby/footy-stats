import { createClient } from '@libsql/client';
// import { getCached, setCache } from '../lib/cache.js'; // Disabled for now

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Caching disabled for debugging
    // const cacheKey = 'teams_list';
    // const cached = getCached(cacheKey);
    // if (cached) return res.json(cached);

    // Create the client inside the handler to ensure env vars are loaded
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

    // Ultra simple query - just get unique teams
    const teams = await db.execute(`
      SELECT DISTINCT match_home_team as team_name
      FROM AFL_data 
      WHERE match_home_team IS NOT NULL AND match_home_team != ''
      ORDER BY match_home_team
    `);
    
    console.log('Query successful, rows:', teams.rows.length);
    
    // Caching disabled for debugging
    // setCache(cacheKey, teams.rows);
    
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