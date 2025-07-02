import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/teams-all
 *   – no query → returns all teams            (RPC: get_teams)
 *   – ?teamName=Essendon → team summary JSON (RPC: team_summary)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamName } = req.query;

  // Safety‑check environment
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res
      .status(500)
      .json({ error: 'Missing Supabase credentials in environment' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    if (teamName) {
      // ---- Single team summary -------------------------------------------
      const { data, error } = await supabase.rpc('team_summary', {
        p_team: teamName
      });
      if (error) throw error;

      // `team_summary` returns one JSON row; unwrap it for convenience
      const payload = Array.isArray(data) ? data[0] : data;
      return res.json(payload);
    } else {
      // ---- Full teams list -----------------------------------------------
      const { data, error } = await supabase.rpc('get_teams');
      if (error) throw error;
      return res.json(data);
    }
  } catch (err) {
    console.error('Supabase RPC error:', err);
    res.status(500).json({ error: 'Failed to fetch team data', details: err.message });
  }
}