import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { team } = req.query;
  if (!team) return res.status(400).json({ error: 'team required' });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data, error } = await sb.rpc('get_team_match_years', { team_name: team });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}