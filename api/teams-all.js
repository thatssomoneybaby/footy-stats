import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/teams-all
 *   – no query                 ➜ get_teams()          (full list)
 *   – ?teamName=Essendon       ➜ get_team_summary('Essendon')
 *
 * Adds Cache‑Control: no-store while we debug so Vercel never serves a
 * stale response.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // -----------------------------------------------------------------------
  //  Supabase client (anon key)
  // -----------------------------------------------------------------------
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res
      .status(500)
      .json({ error: 'Missing Supabase credentials in environment' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { teamName } = req.query;

  try {
    if (teamName) {
      // -------------------------------------------------------------------
      //  Single team summary
      // -------------------------------------------------------------------
      const { data, error } = await supabase.rpc('get_team_summary', {
        team_name: teamName
      });
      if (error) throw error;

      console.log('get_team_summary rows:', data ? 1 : 0);

      const payload = Array.isArray(data) ? data[0] : data;
      res.setHeader('Cache-Control', 'no-store');
      return res.json(payload);
    }

    // ---------------------------------------------------------------------
    //  Full teams list
    // ---------------------------------------------------------------------
    const { data, error } = await supabase.rpc('get_teams');
    if (error) throw error;

    console.log('get_teams rows:', data?.length);

    res.setHeader('Cache-Control', 'no-store');
    return res.json(data);
  } catch (err) {
    console.error('Supabase RPC error:', err);
    return res
      .status(500)
      .json({ error: 'Failed to fetch team data', details: err.message });
  }
}