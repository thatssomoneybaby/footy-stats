import { supabase as sb } from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { team } = req.query;
  if (!team) return res.status(400).json({ error: 'team required' });

  const { data, error } = await sb.rpc('get_team_match_years', { team_name: team });

  if (error) return res.status(500).json({ error: error.message });
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
  res.json(data);
}
