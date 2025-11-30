import { supabase } from '../db.js';

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
  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing Supabase config' });
  }

  const { teamName } = req.query;

  try {
    if (teamName) {
      // -------------------------------------------------------------------
      //  Single team summary
      // -------------------------------------------------------------------
      // Try a few common RPC/param name combinations for robustness
      const tries = [
        { fn: 'get_team_summary', args: { p_team: teamName } },
        { fn: 'get_team_summary', args: { team_name: teamName } },
        { fn: 'team_summary',     args: { p_team: teamName } },
        { fn: 'team_summary',     args: { team_name: teamName } }
      ];

      let rpcData = null;
      let rpcError = null;
      let used = null;
      for (const t of tries) {
        const { data, error } = await supabase.rpc(t.fn, t.args);
        if (!error && data) { rpcData = data; used = t; break; }
        rpcError = error;
      }
      if (!rpcData) {
        console.error('Supabase get_team_summary failure', {
          lastTried: tries[tries.length - 1],
          error: rpcError
        });
        throw rpcError || new Error('No data returned from team summary RPC');
      }
      if (used) console.log('Team summary RPC used:', used);

      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      // Map DB → UI shape expected by public/js/teams.js
      const payload = {
        team_name: row?.team_name ?? row?.team ?? teamName,
        first_season: row?.first_season ?? row?.first_year ?? null,
        last_season: row?.last_season ?? row?.last_year ?? null,
        total_matches: row?.total_matches ?? row?.games ?? 0,
        win_rate_pct: row?.win_rate_pct ?? (row?.games ? ((row?.wins ?? 0) / row.games * 100).toFixed(1) : 0),
        highest_score: row?.highest_score ?? 0,
        biggest_win: row?.biggest_win ?? row?.biggest_margin ?? 0,
        grand_finals: row?.grand_finals ?? row?.premierships ?? 0,
        // Leaderboards per club
        top_disposals: (row?.top_disposals || []).map(p => ({
          full_name: p.full_name ?? p.player_name ?? `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim(),
          games_played: p.games_played ?? p.games ?? 0,
          total: p.total ?? p.value ?? p.disposals ?? 0,
          per_game: p.per_game ?? p.value_per_game ?? (p.games ? (p.total / p.games).toFixed(1) : '0.0')
        })),
        top_goals: (row?.top_goals || []).map(p => ({
          full_name: p.full_name ?? p.player_name ?? `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim(),
          games_played: p.games_played ?? p.games ?? 0,
          total: p.total ?? p.value ?? p.goals ?? 0,
          per_game: p.per_game ?? p.value_per_game ?? (p.games ? (p.total / p.games).toFixed(1) : '0.0')
        }))
      };
      res.setHeader('Cache-Control', 'no-store');
      return res.json(payload);
    }

    // ---------------------------------------------------------------------
    //  Full teams list
    // ---------------------------------------------------------------------
    const { data, error } = await supabase.rpc('get_teams');
    if (error) throw error;
    // Map DB → UI for team cards
    const rows = (data || []).map(r => ({
      team_name: r.team_name ?? r.team ?? r.club ?? '',
      first_season: r.first_season ?? r.first_year ?? null,
      last_season: r.last_season ?? r.last_year ?? null,
      total_matches: r.total_matches ?? r.games ?? 0
    }));
    res.setHeader('Cache-Control', 'no-store');
    return res.json(rows);
  } catch (err) {
    console.error('Supabase RPC error:', err);
    return res
      .status(500)
      .json({ error: 'Failed to fetch team data', details: err?.message || String(err) });
  }
}
