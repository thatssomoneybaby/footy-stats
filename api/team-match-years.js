import { supabase as sb } from '../db.js';

export default async function handler(req, res) {
  const { team } = req.query;
  if (!team) return res.status(400).json({ error: 'team required' });

  const { data, error } = await sb.rpc('get_team_match_years', { team_name: team });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
