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
      const [dispQ, goalsQ, gamesQ] = await Promise.all([
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
          .limit(10),
        supabase
          .from('mv_team_player_careers')
          .select('player_first_name, player_last_name, player_name, team, games')
          .eq('team', teamKey)
          .order('games', { ascending: false })
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
      const topGamesArr = Array.isArray(gamesQ.data)
        ? gamesQ.data.map(p => ({
            full_name: p.player_name || `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim(),
            games_played: Number(p.games ?? 0) || 0
          }))
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
          .select('home_team, away_team, home_score, away_score, winner, margin, match_date, venue_name, round_number, match_round')
          .or(`home_team.eq.${team},away_team.eq.${team}`)
          .limit(50000);
        let rows = Array.isArray(matches) ? matches : [];
        if (mErr) {
          console.error('mv_season_matches query error:', mErr);
          rows = [];
        }

        let highestScore = 0;
        let highestScoreDetail = null;
        let biggestWin = 0;
        let biggestWinDetail = null;
        for (const r of rows) {
          const teamScore = (r.home_team === team)
            ? Number(r.home_score ?? 0)
            : Number(r.away_score ?? 0);
          if (Number.isFinite(teamScore) && teamScore > highestScore) highestScore = teamScore;
          if (Number.isFinite(teamScore) && teamScore >= highestScore) {
            const oppScore = (r.home_team === team) ? Number(r.away_score ?? 0) : Number(r.home_score ?? 0);
            highestScoreDetail = {
              season: (() => { try { return Number(String(r.match_date).slice(0,4)) || null; } catch { return null; } })(),
              round_number: r.round_number ?? r.match_round ?? null,
              opponent: (r.home_team === team) ? r.away_team : r.home_team,
              venue_name: r.venue_name ?? null,
              score_for: teamScore,
              score_against: Number(oppScore) || 0,
              margin: Number(r.margin ?? 0) || 0
            };
          }

          if (r.winner === team) {
            const mg = Number(r.margin ?? 0);
            if (Number.isFinite(mg) && mg >= biggestWin) {
              biggestWin = mg;
              const teamScore2 = (r.home_team === team) ? Number(r.home_score ?? 0) : Number(r.away_score ?? 0);
              const oppScore2 = (r.home_team === team) ? Number(r.away_score ?? 0) : Number(r.home_score ?? 0);
              biggestWinDetail = {
                season: (() => { try { return Number(String(r.match_date).slice(0,4)) || null; } catch { return null; } })(),
                round_number: r.round_number ?? r.match_round ?? null,
                opponent: (r.home_team === team) ? r.away_team : r.home_team,
                venue_name: r.venue_name ?? null,
                score_for: Number(teamScore2) || 0,
                score_against: Number(oppScore2) || 0,
                margin: Number(r.margin ?? 0) || 0
              };
            }
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

        // Collect premiership years (GF rows)
        let premiershipYears = [];
        try {
          const { data: gfRows, error: gfRowsErr } = await supabase
            .from('mv_season_matches')
            .select('season, match_date')
            .eq('winner', team)
            .ilike('round_number', 'GF%')
            .limit(50000);
          if (!gfRowsErr && Array.isArray(gfRows)) {
            const years = gfRows
              .map(r => Number(r.season ?? Number(String(r.match_date).slice(0,4))))
              .filter(n => Number.isFinite(n));
            premiershipYears = Array.from(new Set(years)).sort((a,b) => a - b);
          }
        } catch (e) {
          console.error('GF years fetch exception:', e);
        }

        // Historical seasons without a GF but with a premiership: override list
        const SPECIAL_PREMIERSHIPS = {
          'Essendon': [1897, 1924]
        };
        const extras = SPECIAL_PREMIERSHIPS[team] || [];
        if (extras.length) {
          grandFinals += extras.length;
          premiershipYears = Array.from(new Set([...(premiershipYears || []), ...extras])).sort((a,b) => a - b);
        }

        return { highestScore, highestScoreDetail, biggestWin, biggestWinDetail, grandFinals, premiershipYears };
      }

      const { highestScore, highestScoreDetail, biggestWin, biggestWinDetail, grandFinals, premiershipYears } = await deriveFromMatches(teamKey);

      const asNum = v => {
        const n = Number(v); return Number.isFinite(n) ? n : 0;
      };
      const pickMax = (...vals) => {
        const nums = vals.map(asNum).filter(n => Number.isFinite(n));
        return nums.length ? Math.max(...nums) : 0;
      };

      const payload = {
        team_name: row?.team_name ?? row?.team ?? teamName,
        first_season: row?.first_season ?? row?.first_year ?? null,
        last_season: row?.last_season ?? row?.last_year ?? null,
        total_matches: row?.total_matches ?? row?.games ?? 0,
        win_rate_pct: winRateNum,
        highest_score: pickMax(highestScore, row?.highest_score),
        highest_score_detail: highestScoreDetail,
        biggest_win: pickMax(biggestWin, (row?.biggest_win ?? row?.biggest_margin)),
        biggest_win_detail: biggestWinDetail,
        grand_finals: pickMax(grandFinals, (row?.grand_finals ?? row?.premierships)),
        premiership_years: premiershipYears,
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
        })),
        top_games: topGamesArr
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
