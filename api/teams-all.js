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

      // Also pull leaders from mv_team_player_careers if RPC did not include them
      // This uses read-only access and limits to top-10 per metric
      const teamKey = row?.team_name ?? row?.team ?? teamName;
      const [dispQ, goalsQ] = await Promise.all([
        supabase
          .from('mv_team_player_careers')
          .select('player_first_name, player_last_name, player_name, team, games, disposals, goals')
          .eq('team', teamKey)
          .order('disposals', { ascending: false })
          .limit(10),
        supabase
          .from('mv_team_player_careers')
          .select('player_first_name, player_last_name, player_name, team, games, disposals, goals')
          .eq('team', teamKey)
          .order('goals', { ascending: false })
          .limit(10)
      ]);

      const mapPlayer = (p, which) => {
        const full = p.player_name || `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim();
        const games = Number(p.games ?? p.games_played ?? 0) || 0;
        const totals = {
          goals: Number(p.goals ?? p.total_goals ?? 0) || 0,
          disposals: Number(p.disposals ?? p.total_disposals ?? 0) || 0
        };
        const total = which === 'goals' ? totals.goals : totals.disposals;
        const perGame = games ? +(total / games).toFixed(1) : 0.0;
        return {
          full_name: full,
          games_played: games,
          total,
          per_game: perGame
        };
      };

      const topDisposalsArr = Array.isArray(dispQ.data)
        ? dispQ.data.map(p => mapPlayer(p, 'disposals'))
        : [];
      const topGoalsArr = Array.isArray(goalsQ.data)
        ? goalsQ.data.map(p => mapPlayer(p, 'goals'))
        : [];
      // Map DB → UI shape expected by public/js/teams.js
      // Normalize win rate to a number; avoid string toFixed here
      const winRateNum = (() => {
        if (row?.win_rate_pct != null) {
          const n = Number(row.win_rate_pct);
          if (Number.isFinite(n)) return n;
        }
        if (row?.games) {
          const n = ((row?.wins ?? 0) / row.games) * 100;
          if (Number.isFinite(n)) return n;
        }
        return 0;
      })();

      // Derive extra summary stats from mv_season_matches
      async function deriveFromMatches(team) {
        // Load all matches involving the team
        const { data: matches, error: mErr } = await supabase
          .from('mv_season_matches')
          .select('home_team, away_team, home_score, away_score, winner, margin')
          .or(`home_team.eq.${team},away_team.eq.${team}`)
          .limit(50000);
        if (mErr) {
          console.error('mv_season_matches query error:', mErr);
          return { highestScore: 0, biggestWin: 0, grandFinals: 0 };
        }
        const rows = Array.isArray(matches) ? matches : [];

        let highestScore = 0;
        let biggestWin = 0;
        for (const r of rows) {
          const teamScore = (r.home_team === team)
            ? Number(r.home_score ?? 0)
            : Number(r.away_score ?? 0);
          if (Number.isFinite(teamScore) && teamScore > highestScore) highestScore = teamScore;

          if (r.winner === team) {
            const mg = Number(r.margin ?? 0);
            if (Number.isFinite(mg) && mg > biggestWin) biggestWin = mg;
          }
        }

        // Canonical premiership count: count mv_season_matches where round_number ILIKE 'GF%' and winner = team
        let grandFinals = 0;
        try {
          const { count, error: gfErr } = await supabase
            .from('mv_season_matches')
            .select('match_id', { count: 'exact', head: true })
            .eq('winner', team)
            .ilike('round_number', 'GF%');
          if (!gfErr && typeof count === 'number') grandFinals = count;
          else if (gfErr) console.error('GF count error:', gfErr);
        } catch (e) {
          console.error('GF count exception:', e);
        }

        // Historical seasons without a GF but with a premiership: override list
        const SPECIAL_PREMIERSHIPS = {
          'Essendon': [1897, 1924]
        };
        const extra = (SPECIAL_PREMIERSHIPS[team] || []).length;
        grandFinals += extra;

        return { highestScore, biggestWin, grandFinals };
      }

      const { highestScore, biggestWin, grandFinals } = await deriveFromMatches(teamKey);

      const payload = {
        team_name: row?.team_name ?? row?.team ?? teamName,
        first_season: row?.first_season ?? row?.first_year ?? null,
        last_season: row?.last_season ?? row?.last_year ?? null,
        total_matches: row?.total_matches ?? row?.games ?? 0,
        win_rate_pct: winRateNum,
        highest_score: Number.isFinite(Number(row?.highest_score)) ? Number(row.highest_score) : highestScore,
        biggest_win: Number.isFinite(Number(row?.biggest_win ?? row?.biggest_margin)) ? Number(row?.biggest_win ?? row?.biggest_margin) : biggestWin,
        grand_finals: Number.isFinite(Number(row?.grand_finals ?? row?.premierships)) ? Number(row?.grand_finals ?? row?.premierships) : grandFinals,
        // Leaderboards per club
        top_disposals: (row?.top_disposals && row.top_disposals.length ? row.top_disposals : topDisposalsArr).map(p => ({
          full_name: p.full_name ?? p.player_name ?? `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim(),
          games_played: p.games_played ?? p.games ?? 0,
          total: p.total ?? p.value ?? p.disposals ?? 0,
          per_game: p.per_game ?? p.value_per_game ?? (p.games ? (p.total / p.games).toFixed(1) : '0.0')
        })),
        top_goals: (row?.top_goals && row.top_goals.length ? row.top_goals : topGoalsArr).map(p => ({
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
