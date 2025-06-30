import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_AUTH_TOKEN,
    });

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
}