import { supabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { team, year } = req.query;
  if (!team || !year) {
    return res.status(400).json({ error: 'Query needs ?team=&year=' });
  }

  const { data, error } = await supabase.rpc('team_matches', {
    p_team: team,
    p_year: parseInt(year, 10)
  });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'DB error' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(data);            // array of matches for that season (≤ 40 rows)
}
