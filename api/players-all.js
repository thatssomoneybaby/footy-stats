import { supabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { letter, playerId, alphabet, page: pageParam } = req.query;

  try {
    // Using shared Supabase client

    // Alphabet: use RPC get_player_alphabet → { letters: [{letter,count}, ...] }
    if (alphabet === 'true') {
      const { data, error } = await supabase.rpc('get_player_alphabet');
      if (error) {
        console.error('get_player_alphabet error', error);
        return res.status(500).json({ error: 'Failed get_player_alphabet', details: error.message });
      }
      const letters = Array.isArray(data) ? data : [];
      // Cache at edge – stable meta
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
      return res.status(200).json({ letters });

    } else if (playerId) {
      // RPCs only: career summary + seasons + recent games
      const pid = parseInt(playerId, 10);
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const limit = 50;
      const offset = (page - 1) * limit;
      const [profileRsp, seasonsRsp, gamesRsp] = await Promise.all([
        supabase.rpc('get_player_profile', { p_player_id: pid }),
        supabase.rpc('get_player_seasons', { p_player_id: pid }),
        // If your RPC supports offset param, pass it; otherwise we fallback below
        supabase.rpc('get_player_games', { p_player_id: pid, p_limit: limit, p_offset: offset })
      ]);

      let prof = null;
      if (profileRsp.error) {
        // Fallback to view select if RPC is not resolved yet
        const { data: profRow, error: profErr, status } = await supabase
          .from('mv_player_career_totals')
          .select('player_name, games, disposals, goals, kicks, handballs, marks, tackles, first_season, last_season, value_per_game_disposals, value_per_game_goals, value_per_game_kicks, value_per_game_handballs, value_per_game_marks, value_per_game_tackles')
          .eq('player_id', pid)
          .maybeSingle();
        if (!profErr && profRow) {
          prof = profRow;
        } else {
          // Last resort: fetch a name from any match row so UI can render
          try {
            const { data: nameRows } = await supabase
              .from('mv_match_player_stats')
              .select('player_name')
              .eq('player_id', pid)
              .order('match_date', { ascending: false })
              .limit(1);
            const fallbackName = Array.isArray(nameRows) && nameRows[0] ? nameRows[0].player_name : '';
            prof = {
              player_name: fallbackName || '',
              games: 0, disposals: 0, goals: 0, kicks: 0, handballs: 0, marks: 0, tackles: 0,
              first_season: null, last_season: null
            };
          } catch (_) {
            prof = {
              player_name: '',
              games: 0, disposals: 0, goals: 0, kicks: 0, handballs: 0, marks: 0, tackles: 0,
              first_season: null, last_season: null
            };
          }
        }
      } else {
        const profArr = Array.isArray(profileRsp.data) ? profileRsp.data : (profileRsp.data ? [profileRsp.data] : []);
        prof = profArr[0] || null;
      }
      if (!prof) prof = { player_name: '' };
      const [first, ...rest] = ((prof.player_name || '') + '').split(' ');
      const player = {
        player_first_name: first || '',
        player_last_name: rest.join(' '),
        total_games: prof.games || 0,
        total_disposals: prof.disposals || 0,
        total_goals: prof.goals || 0,
        total_kicks: prof.kicks || 0,
        total_handballs: prof.handballs || 0,
        total_marks: prof.marks || 0,
        total_tackles: prof.tackles || 0,
        first_year: prof.first_season || null,
        last_year: prof.last_season || null,
        avg_disposals: prof.value_per_game_disposals || (prof.games ? (prof.disposals / prof.games).toFixed(1) : '0.0'),
        avg_goals: prof.value_per_game_goals || (prof.games ? (prof.goals / prof.games).toFixed(1) : '0.0'),
        avg_kicks: prof.value_per_game_kicks || (prof.games ? (prof.kicks / prof.games).toFixed(1) : '0.0'),
        avg_handballs: prof.value_per_game_handballs || (prof.games ? (prof.handballs / prof.games).toFixed(1) : '0.0'),
        avg_marks: prof.value_per_game_marks || (prof.games ? (prof.marks / prof.games).toFixed(1) : '0.0'),
        avg_tackles: prof.value_per_game_tackles || (prof.games ? (prof.tackles / prof.games).toFixed(1) : '0.0')
      };

      let seasons = seasonsRsp.error ? [] : (seasonsRsp.data || []);
      if (seasonsRsp.error) {
        const { data: sData } = await supabase
          .from('mv_player_season_totals')
          .select('season, team, games, goals, disposals, kicks, handballs, marks, tackles, guernsey_number')
          .eq('player_id', pid)
          .order('season', { ascending: true });
        seasons = sData || [];
      }

      // Aggregate season totals as a robust fallback for career totals
      const seasonAgg = (Array.isArray(seasons) ? seasons : []).reduce((acc, r) => {
        const num = (v) => Number(v) || 0;
        acc.games      += num(r.games);
        acc.disposals  += num(r.disposals);
        acc.goals      += num(r.goals);
        acc.kicks      += num(r.kicks);
        acc.handballs  += num(r.handballs);
        acc.marks      += num(r.marks);
        acc.tackles    += num(r.tackles);
        acc.first      = acc.first == null ? Number(r.season) : Math.min(acc.first, Number(r.season) || acc.first);
        acc.last       = acc.last == null  ? Number(r.season) : Math.max(acc.last,  Number(r.season) || acc.last);
        return acc;
      }, { games: 0, disposals: 0, goals: 0, kicks: 0, handballs: 0, marks: 0, tackles: 0, first: null, last: null });

      // Merge season aggregates into profile for missing/zero fields so the UI
      // can always render career span, totals and averages
      if (!prof || typeof prof !== 'object') prof = { player_name: '' };
      const prefer = (a, b) => {
        const na = Number(a); const nb = Number(b);
        if (Number.isFinite(na) && na > 0) return na;
        if (Number.isFinite(nb) && nb > 0) return nb;
        return 0;
      };
      prof.games      = prefer(prof.games,      seasonAgg.games);
      prof.disposals  = prefer(prof.disposals,  seasonAgg.disposals);
      prof.goals      = prefer(prof.goals,      seasonAgg.goals);
      prof.kicks      = prefer(prof.kicks,      seasonAgg.kicks);
      prof.handballs  = prefer(prof.handballs,  seasonAgg.handballs);
      prof.marks      = prefer(prof.marks,      seasonAgg.marks);
      prof.tackles    = prefer(prof.tackles,    seasonAgg.tackles);
      if (prof.first_season == null) prof.first_season = seasonAgg.first ?? null;
      if (prof.last_season  == null) prof.last_season  = seasonAgg.last  ?? null;
      const gForAvg = Number(prof.games) || 0;
      if (gForAvg > 0) {
        const to1 = (v) => Math.round((Number(v)||0) / gForAvg * 10) / 10;
        if (prof.value_per_game_disposals == null) prof.value_per_game_disposals = to1(prof.disposals);
        if (prof.value_per_game_goals     == null) prof.value_per_game_goals     = to1(prof.goals);
        if (prof.value_per_game_kicks     == null) prof.value_per_game_kicks     = to1(prof.kicks);
        if (prof.value_per_game_handballs == null) prof.value_per_game_handballs = to1(prof.handballs);
        if (prof.value_per_game_marks     == null) prof.value_per_game_marks     = to1(prof.marks);
        if (prof.value_per_game_tackles   == null) prof.value_per_game_tackles   = to1(prof.tackles);
      }

      let games = gamesRsp.error ? [] : (gamesRsp.data || []);
      if (gamesRsp.error) {
        const { data: gData } = await supabase
          .from('mv_match_player_stats')
          .select('match_id, match_date, match_round, round_number, venue_name, match_home_team, home_team, match_away_team, away_team, player_team, team, behinds, disposals, goals, kicks, handballs, marks, tackles')
          .eq('player_id', pid)
          .order('match_date', { ascending: false })
          .order('match_id', { ascending: false })
          .range(offset, offset + limit - 1);
        games = gData || [];
      }

      // Map games rows to the expected keys used by the UI table
      const allGames = (games || []).map(g => {
        const match_home_team = g.match_home_team ?? g.home_team ?? null;
        const match_away_team = g.match_away_team ?? g.away_team ?? null;
        const player_team = g.player_team ?? g.team ?? null;
        const opponent = player_team
          ? (player_team === match_home_team ? match_away_team : match_home_team)
          : (match_home_team && match_away_team ? `${match_home_team} vs ${match_away_team}` : null);
        return {
        match_id: g.match_id,
        season: g.season ?? (function(){ try { return Number(String(g.match_date).slice(0,4)); } catch { return null; } })(),
        match_date: g.match_date,
        match_round: g.match_round || g.round_number,
        round_label: g.match_round || g.round_number,
        venue_name: g.venue_name,
        match_home_team,
        match_away_team,
        player_team,
        team: player_team,
        opponent,
        behinds: g.behinds,
        disposals: g.disposals,
        goals: g.goals,
        kicks: g.kicks,
        handballs: g.handballs,
        marks: g.marks,
        tackles: g.tackles
        };
      });

      // Derive aggregates from per-game rows
      const totalGames = allGames.length;
      const numVal = v => Number(v) || 0;
      const sum = (key) => allGames.reduce((acc, r) => acc + numVal(r[key]), 0);
      const max = (key) => allGames.reduce((m, r) => Math.max(m, numVal(r[key])), 0);
      const avg1 = (s) => totalGames ? +(s / totalGames).toFixed(1) : 0.0;

      const totals = {
        disposals: sum('disposals'),
        goals: sum('goals'),
        kicks: sum('kicks'),
        handballs: sum('handballs'),
        marks: sum('marks'),
        tackles: sum('tackles')
      };

      // Page-local bests (from currently loaded window)
      const pageBest = {
        disposals: max('disposals'),
        goals: max('goals'),
        kicks: max('kicks'),
        handballs: max('handballs'),
        marks: max('marks'),
        tackles: max('tackles')
      };

      // Compute DB-wide single-game bests to avoid pagination bias
      async function getBestFromDb(p_player_id) {
        const statKeys = ['disposals','goals','kicks','handballs','marks','tackles'];
        const queries = statKeys.map(k =>
          supabase
            .from('mv_match_player_stats')
            .select(k)
            .eq('player_id', p_player_id)
            .order(k, { ascending: false, nullsFirst: false })
            .limit(1)
        );
        const results = await Promise.all(queries);
        const best = {};
        statKeys.forEach((k, i) => {
          const row = results[i]?.data?.[0] || null;
          best[k] = row ? (Number(row[k]) || 0) : 0;
        });
        return best;
      }

      let best = pageBest;
      try {
        best = await getBestFromDb(pid);
      } catch (_) {
        best = pageBest;
      }

      // Career span and teams path
      const years = allGames
        .map(r => { try { return Number(String(r.match_date).slice(0,4)); } catch { return null; } })
        .filter(n => Number.isFinite(n));
      // Prefer canonical span from totals profile
      const career_start = prof.first_season ?? (years.length ? Math.min(...years) : null);
      const career_end   = prof.last_season ?? (years.length ? Math.max(...years) : null);
      const teamFirstYear = {};
      allGames.forEach(r => {
        const y = (function(){ try { return Number(String(r.match_date).slice(0,4)); } catch { return null; } })();
        if (r.player_team && Number.isFinite(y)) {
          if (!(r.player_team in teamFirstYear) || y < teamFirstYear[r.player_team]) teamFirstYear[r.player_team] = y;
        }
      });
      const teams_path = Object
        .entries(teamFirstYear)
        .sort((a,b) => a[1] - b[1])
        .map(([team]) => team)
        .join(' → ');

      // True debut game: fetch independently of pagination (earliest match)
      let debut = null;
      try {
        const { data: debutRows, error: debutError } = await supabase
          .from('mv_match_player_stats')
          .select('match_date, match_round, venue_name, match_home_team, match_away_team, player_team, match_id')
          .eq('player_id', pid)
          .order('match_date', { ascending: true })
          .order('match_id', { ascending: true })
          .limit(1);
        if (!debutError && Array.isArray(debutRows) && debutRows.length > 0) {
          const d = debutRows[0];
          // Normalise keys to match frontend expectations
          debut = {
            match_date: d.match_date,
            match_round: d.match_round,
            venue_name: d.venue_name,
            match_home_team: d.match_home_team ?? null,
            match_away_team: d.match_away_team ?? null,
            player_team: d.player_team ?? null
          };
        }
      } catch (_) {
        // ignore; debut stays null
      }
      // Also expose legacy profile debut fields for compatibility
      const debut_date = debut ? debut.match_date : null;
      const debut_venue = debut ? (debut.venue_name || null) : null;
      const debut_opponent = null; // computed client-side from home/away vs player team
      const debut_round_label = debut ? (debut.match_round || null) : null;

      // Merge computed aggregates back into player core object
      // Prefer canonical totals from mv_player_totals profile
      player.player_id = Number(playerId);
      player.total_games = (prof.games ?? null) != null ? Number(prof.games) : (seasonAgg.games || totalGames || 0);
      player.total_disposals = (prof.disposals ?? null) != null ? Number(prof.disposals) : (seasonAgg.disposals || totals.disposals);
      player.total_goals = (prof.goals ?? null) != null ? Number(prof.goals) : (seasonAgg.goals || totals.goals);
      player.total_kicks = (prof.kicks ?? null) != null ? Number(prof.kicks) : (seasonAgg.kicks || totals.kicks);
      player.total_handballs = (prof.handballs ?? null) != null ? Number(prof.handballs) : (seasonAgg.handballs || totals.handballs);
      player.total_marks = (prof.marks ?? null) != null ? Number(prof.marks) : (seasonAgg.marks || totals.marks);
      player.total_tackles = (prof.tackles ?? null) != null ? Number(prof.tackles) : (seasonAgg.tackles || totals.tackles);

      // Prefer canonical profile years; then season aggregates; then derived from games window
      player.first_year = prof.first_season ?? seasonAgg.first ?? career_start ?? player.first_year ?? null;
      player.last_year  = prof.last_season  ?? seasonAgg.last  ?? career_end   ?? player.last_year  ?? null;
      player.teams_path = teams_path || null;
      player.debut_date = debut_date;
      player.debut_venue = debut_venue;
      player.debut_opponent = debut_opponent;
      player.debut_round_label = debut_round_label;

      // Keep avg_* values from profile if present; ensure numeric (1 decimal)
      const round1 = (v) => Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
      if (player.avg_disposals == null) player.avg_disposals = round1(avg1(totals.disposals));
      else player.avg_disposals = round1(Number(player.avg_disposals));
      if (player.avg_goals == null)     player.avg_goals     = round1(avg1(totals.goals));
      else player.avg_goals = round1(Number(player.avg_goals));
      if (player.avg_kicks == null)     player.avg_kicks     = round1(avg1(totals.kicks));
      else player.avg_kicks = round1(Number(player.avg_kicks));
      if (player.avg_handballs == null) player.avg_handballs = round1(avg1(totals.handballs));
      else player.avg_handballs = round1(Number(player.avg_handballs));
      if (player.avg_marks == null)     player.avg_marks     = round1(avg1(totals.marks));
      else player.avg_marks = round1(Number(player.avg_marks));
      if (player.avg_tackles == null)   player.avg_tackles   = round1(avg1(totals.tackles));
      else player.avg_tackles = round1(Number(player.avg_tackles));

      player.best_disposals = best.disposals;
      player.best_goals     = best.goals;
      player.best_kicks     = best.kicks;
      player.best_handballs = best.handballs;
      player.best_marks     = best.marks;
      player.best_tackles   = best.tackles;

      // Team-by-team games + guernsey history (ordered by first usage)
      let team_stints = [];
      try {
        const { data: teamRows, error: teamErr } = await supabase
          .from('mv_match_player_stats')
          .select('player_team, guernsey_number, match_date')
          .eq('player_id', pid)
          .order('match_date', { ascending: true });
        if (!teamErr && Array.isArray(teamRows)) {
          const teams = {};
          for (const r of teamRows) {
            const t = r.player_team;
            if (!t) continue;
            if (!teams[t]) {
              teams[t] = { team: t, games: 0, guernseys: [], _seen: new Set(), _first: r.match_date };
            }
            const entry = teams[t];
            entry.games += 1;
            const num = Number(r.guernsey_number);
            if (Number.isFinite(num) && !entry._seen.has(num)) {
              entry.guernseys.push(num);
              entry._seen.add(num);
            }
            if (!entry._first || (r.match_date && new Date(r.match_date) < new Date(entry._first))) {
              entry._first = r.match_date;
            }
          }
          team_stints = Object.values(teams)
            .sort((a,b) => new Date(a._first) - new Date(b._first))
            .map(({ team, games, guernseys }) => ({ team, games, guernseys }));
        }
      } catch (_) {
        team_stints = [];
      }

      // Return contract expected by the new frontend – include best_* on profile for the UI card
      if (prof && typeof prof === 'object') {
        prof.best_disposals = best.disposals;
        prof.best_goals     = best.goals;
        prof.best_kicks     = best.kicks;
        prof.best_handballs = best.handballs;
        prof.best_marks     = best.marks;
        prof.best_tackles   = best.tackles;
      }
      // Cache per page briefly; content is historical
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
      return res.status(200).json({ profile: prof, seasons, games: allGames, debut, team_stints, page, limit });
      
    } else if (letter) {
      // Players by letter - pass through RPC rows for frontend to use
      const { data, error } = await supabase.rpc('get_players_by_letter', { p_letter: letter });
      if (error) return res.status(500).json({ error: 'Failed to fetch players', details: error.message });
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
      return res.status(200).json({ players: data || [] });
      
    } else {
      res.status(400).json({ error: 'Missing required parameter' });
    }
  } catch (error) {
    console.error('players-all error', {
      message: error?.message,
      code: error?.code,
      details: error?.details
    });
    res.status(500).json({ error: 'Failed in players-all', details: error?.message || String(error) });
  }
}
