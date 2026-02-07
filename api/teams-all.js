import { supabase } from '../db.js';

/**
 * GET /api/teams-all
 *   – no query                 ➜ get_teams()          (full list)
 *   – ?teamName=Essendon       ➜ get_team_summary('Essendon')
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
      const teamNameClean = String(teamName).trim();
      if (!teamNameClean) {
        return res.status(400).json({ error: 'Invalid teamName' });
      }

      // -------------------------------------------------------------------
      //  Single team summary
      // -------------------------------------------------------------------
      // Keep compatibility with both common parameter names
      const tries = [
        { fn: 'get_team_summary', args: { p_team: teamNameClean } },
        { fn: 'get_team_summary', args: { team_name: teamNameClean } }
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

      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      const teamKey = row?.team_name ?? row?.team ?? teamNameClean;
      const hasTopDisposals = Array.isArray(row?.top_disposals) && row.top_disposals.length > 0;
      const hasTopGoals = Array.isArray(row?.top_goals) && row.top_goals.length > 0;
      const hasTopGames = Array.isArray(row?.top_games) && row.top_games.length > 0;

      let topDisposalsArr = [];
      let topGoalsArr = [];
      let topGamesArr = [];

      // Pull leaders from MV only when RPC payload does not already contain them
      if (!hasTopDisposals || !hasTopGoals || !hasTopGames) {
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

        topDisposalsArr = Array.isArray(dispQ.data)
          ? dispQ.data.map(p => mapPlayer(p, 'disposals'))
          : [];
        topGoalsArr = Array.isArray(goalsQ.data)
          ? goalsQ.data.map(p => mapPlayer(p, 'goals'))
          : [];
        topGamesArr = Array.isArray(gamesQ.data)
          ? gamesQ.data.map(p => ({
              full_name: p.player_name || `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim(),
              games_played: Number(p.games ?? 0) || 0
            }))
          : [];
      }
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

      // Derive extra summary stats from mv_season_matches (targeted queries)
      async function deriveFromMatches(team) {
        // Kick off all queries concurrently to minimise round trips
        const qHomeHigh = supabase
          .from('mv_season_matches')
          .select('season, match_date, round_number, venue_name, home_team, away_team, home_score, away_score, margin')
          .eq('home_team', team)
          .order('home_score', { ascending: false })
          .limit(1);
        const qAwayHigh = supabase
          .from('mv_season_matches')
          .select('season, match_date, round_number, venue_name, home_team, away_team, home_score, away_score, margin')
          .eq('away_team', team)
          .order('away_score', { ascending: false })
          .limit(1);
        const qHomeWin = supabase
          .from('mv_season_matches')
          .select('season, match_date, round_number, venue_name, home_team, away_team, home_score, away_score, margin')
          .eq('winner', team)
          .eq('home_team', team)
          .order('margin', { ascending: false })
          .limit(1);
        const qAwayWin = supabase
          .from('mv_season_matches')
          .select('season, match_date, round_number, venue_name, home_team, away_team, home_score, away_score, margin')
          .eq('winner', team)
          .eq('away_team', team)
          .order('margin', { ascending: false })
          .limit(1);
        const qGfCount = supabase
          .from('mv_season_matches')
          .select('match_id', { count: 'exact', head: true })
          .eq('winner', team)
          .ilike('round_number', 'GF%');
        const qGfRows = supabase
          .from('mv_season_matches')
          .select('season, match_date')
          .eq('winner', team)
          .ilike('round_number', 'GF%')
          .limit(1000);

        const [homeHigh, awayHigh, homeWin, awayWin, gfCountRsp, gfRowsRsp] = await Promise.all([
          qHomeHigh, qAwayHigh, qHomeWin, qAwayWin, qGfCount, qGfRows
        ]);

        function toYear(row) {
          if (!row) return null;
          const s = Number(row.season);
          if (Number.isFinite(s)) return s;
          try { return Number(String(row.match_date).slice(0,4)) || null; } catch { return null; }
        }

        const homeRow = (homeHigh.data && homeHigh.data[0]) || null;
        const awayRow = (awayHigh.data && awayHigh.data[0]) || null;
        const homeScore = homeRow ? Number(homeRow.home_score ?? 0) : -1;
        const awayScore = awayRow ? Number(awayRow.away_score ?? 0) : -1;
        let highestScore = 0;
        let highestScoreDetail = null;
        if (homeScore >= 0 || awayScore >= 0) {
          const pick = homeScore >= awayScore ? homeRow : awayRow;
          const teamScore = homeScore >= awayScore ? homeScore : awayScore;
          const oppScore = homeScore >= awayScore ? Number(pick?.away_score ?? 0) : Number(pick?.home_score ?? 0);
          const opponent = homeScore >= awayScore ? pick?.away_team : pick?.home_team;
          highestScore = Number(teamScore) || 0;
          highestScoreDetail = pick ? {
            season: toYear(pick),
            round_number: pick.round_number ?? null,
            opponent,
            venue_name: pick.venue_name ?? null,
            score_for: Number(teamScore) || 0,
            score_against: Number(oppScore) || 0,
            margin: Number(pick.margin ?? 0) || 0
          } : null;
        }

        // Biggest win: max margin across wins, from home and away sides
        const winHome = (homeWin.data && homeWin.data[0]) || null;
        const winAway = (awayWin.data && awayWin.data[0]) || null;
        const homeMargin = winHome ? Number(winHome.margin ?? 0) : -1;
        const awayMargin = winAway ? Number(winAway.margin ?? 0) : -1;
        let biggestWin = 0;
        let biggestWinDetail = null;
        if (homeMargin >= 0 || awayMargin >= 0) {
          const pick = homeMargin >= awayMargin ? winHome : winAway;
          const teamWasHome = pick ? pick.home_team === team : true;
          const teamScore2 = teamWasHome ? Number(pick?.home_score ?? 0) : Number(pick?.away_score ?? 0);
          const oppScore2 = teamWasHome ? Number(pick?.away_score ?? 0) : Number(pick?.home_score ?? 0);
          const opponent2 = teamWasHome ? pick?.away_team : pick?.home_team;
          biggestWin = Number(pick?.margin ?? 0) || 0;
          biggestWinDetail = pick ? {
            season: toYear(pick),
            round_number: pick.round_number ?? null,
            opponent: opponent2,
            venue_name: pick.venue_name ?? null,
            score_for: Number(teamScore2) || 0,
            score_against: Number(oppScore2) || 0,
            margin: Number(pick.margin ?? 0) || 0
          } : null;
        }

        // Canonical premiership count: count mv_season_matches where round_number ILIKE 'GF%' and winner = team
        let grandFinals = 0;
        try {
          const { count, error: gfErr } = gfCountRsp;
          if (!gfErr && typeof count === 'number') grandFinals = count;
          else if (gfErr) console.error('GF count error:', gfErr);
        } catch (e) {
          console.error('GF count exception:', e);
        }

        // Collect premiership years (GF rows)
        let premiershipYears = [];
        try {
          const { data: gfRows, error: gfRowsErr } = gfRowsRsp;
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

      const needsDerivedSummary = !(
        row?.highest_score != null &&
        (row?.biggest_win != null || row?.biggest_margin != null) &&
        (row?.grand_finals != null || row?.premierships != null) &&
        Array.isArray(row?.premiership_years)
      );
      const derived = needsDerivedSummary
        ? await deriveFromMatches(teamKey)
        : { highestScore: 0, highestScoreDetail: null, biggestWin: 0, biggestWinDetail: null, grandFinals: 0, premiershipYears: [] };

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
        highest_score: pickMax(derived.highestScore, row?.highest_score),
        highest_score_detail: row?.highest_score_detail ?? derived.highestScoreDetail,
        biggest_win: pickMax(derived.biggestWin, (row?.biggest_win ?? row?.biggest_margin)),
        biggest_win_detail: row?.biggest_win_detail ?? derived.biggestWinDetail,
        grand_finals: pickMax(derived.grandFinals, (row?.grand_finals ?? row?.premierships)),
        premiership_years: Array.isArray(row?.premiership_years) ? row.premiership_years : derived.premiershipYears,
        // Leaderboards per club
        top_disposals: (hasTopDisposals ? row.top_disposals : topDisposalsArr).map(p => ({
          full_name: p.full_name ?? p.player_name ?? `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim(),
          games_played: p.games_played ?? p.games ?? 0,
          total: p.total ?? p.value ?? p.disposals ?? 0,
          per_game: p.per_game ?? p.value_per_game ?? (p.games ? (p.total / p.games).toFixed(1) : '0.0')
        })),
        top_goals: (hasTopGoals ? row.top_goals : topGoalsArr).map(p => ({
          full_name: p.full_name ?? p.player_name ?? `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim(),
          games_played: p.games_played ?? p.games ?? 0,
          total: p.total ?? p.value ?? p.goals ?? 0,
          per_game: p.per_game ?? p.value_per_game ?? (p.games ? (p.total / p.games).toFixed(1) : '0.0')
        })),
        top_games: hasTopGames ? row.top_games : topGamesArr
      };
      // Cache team summaries briefly at the edge to avoid cold starts hurting UX
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
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
    // Full teams list is fairly static – cache for a short window
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
    return res.json(rows);
  } catch (err) {
    console.error('Supabase RPC error:', err);
    return res
      .status(500)
      .json({ error: 'Failed to fetch team data', details: err?.message || String(err) });
  }
}
