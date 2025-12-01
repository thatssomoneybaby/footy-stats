import { supabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { letter, playerId, alphabet, mode } = req.query;

  try {
    // Using shared Supabase client

    // Index payload: total_unique_players and letter_counts
    // Triggered when mode=index, or when no playerId/letter provided, or when alphabet=true (back-compat)
    if (mode === 'index' || (!playerId && !letter) || alphabet === 'true') {
      // Single fetch, then group in Node to avoid 26 roundtrips
      const { data, error } = await supabase
        .from('mv_player_totals')
        .select('player_id,last_name');
      if (error) return res.status(500).json({ error: 'Failed to load player index' });

      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const counts = Object.fromEntries(letters.map(l => [l, 0]));
      for (const row of (data || [])) {
        const ln = (row.last_name || '').trim();
        if (!ln) continue;
        const L = ln[0].toUpperCase();
        if (counts[L] != null) counts[L] += 1;
      }
      const letter_counts = letters.map(L => ({ letter: L, count: counts[L] || 0 }));
      const total_unique_players = (data || []).length;

      res.setHeader('Cache-Control', 'no-store');
      return res.json({ total_unique_players, letter_counts });
    
    } else if (playerId) {
      // RPCs only: career summary + seasons + recent games
      const [profileRsp, seasonsRsp, gamesRsp] = await Promise.all([
        supabase.rpc('get_player_profile', { p_player_id: playerId }),
        supabase.rpc('get_player_seasons', { p_player_id: playerId }),
        // Return a generous number of rows; UI will paginate/sort client-side
        supabase.rpc('get_player_games', { p_player_id: playerId, p_limit: 10000 })
      ]);

      if (profileRsp.error) return res.status(500).json({ error: 'Failed to fetch player profile', details: profileRsp.error.message });
      if (!profileRsp.data) return res.status(404).json({ error: 'Player not found' });

      const prof = profileRsp.data;
      const [first, ...rest] = (prof.player_name || '').split(' ');
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

      const seasons = seasonsRsp.error ? [] : (seasonsRsp.data || []);
      const games = gamesRsp.error ? [] : (gamesRsp.data || []);

      // Map games rows to the expected keys used by the UI table
      const allGames = (games || []).map(g => {
        const match_home_team = g.home_team;
        const match_away_team = g.away_team;
        const player_team = g.player_team;
        const opponent = player_team
          ? (player_team === match_home_team ? match_away_team : match_home_team)
          : (match_home_team && match_away_team ? `${match_home_team} vs ${match_away_team}` : null);
        return {
        match_id: g.match_id,
        match_date: g.match_date,
        match_round: g.match_round || g.round_number,
        venue_name: g.venue_name,
        match_home_team,
        match_away_team,
        player_team,
        opponent,
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

      const best = {
        disposals: max('disposals'),
        goals: max('goals'),
        kicks: max('kicks'),
        handballs: max('handballs'),
        marks: max('marks'),
        tackles: max('tackles')
      };

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

      // Debut game
      const debut = allGames
        .filter(r => r.match_date)
        .sort((a,b) => new Date(a.match_date) - new Date(b.match_date))[0] || null;
      const debut_date = debut ? debut.match_date : null;
      const debut_venue = debut ? (debut.venue_name || null) : null;
      const debut_opponent = debut ? (debut.opponent || null) : null;
      const debut_round_label = debut ? (debut.match_round || null) : null;

      // Merge computed aggregates back into player core object
      // Prefer canonical totals from mv_player_totals profile
      player.total_games = prof.games || totalGames || 0;
      player.total_disposals = (prof.disposals ?? null) != null ? prof.disposals : totals.disposals;
      player.total_goals = (prof.goals ?? null) != null ? prof.goals : totals.goals;
      player.total_kicks = (prof.kicks ?? null) != null ? prof.kicks : totals.kicks;
      player.total_handballs = (prof.handballs ?? null) != null ? prof.handballs : totals.handballs;
      player.total_marks = (prof.marks ?? null) != null ? prof.marks : totals.marks;
      player.total_tackles = (prof.tackles ?? null) != null ? prof.tackles : totals.tackles;

      player.first_year = career_start ?? player.first_year ?? null;
      player.last_year = career_end ?? player.last_year ?? null;
      player.teams_path = teams_path || null;
      player.debut_date = debut_date;
      player.debut_venue = debut_venue;
      player.debut_opponent = debut_opponent;
      player.debut_round_label = debut_round_label;

      // Keep avg_* values from profile if present; avoid recomputing from a potentially limited set
      if (player.avg_disposals == null) player.avg_disposals = avg1(totals.disposals);
      if (player.avg_goals == null)     player.avg_goals     = avg1(totals.goals);
      if (player.avg_kicks == null)     player.avg_kicks     = avg1(totals.kicks);
      if (player.avg_handballs == null) player.avg_handballs = avg1(totals.handballs);
      if (player.avg_marks == null)     player.avg_marks     = avg1(totals.marks);
      if (player.avg_tackles == null)   player.avg_tackles   = avg1(totals.tackles);

      player.best_disposals = best.disposals;
      player.best_goals     = best.goals;
      player.best_kicks     = best.kicks;
      player.best_handballs = best.handballs;
      player.best_marks     = best.marks;
      player.best_tackles   = best.tackles;

      return res.json({ player, seasons, allGames });
      
    } else if (letter) {
      // Players by letter - single RPC → map to UI shape
      const { data, error } = await supabase.rpc('get_players_by_letter', { p_letter: letter });
      if (error) return res.status(500).json({ error: 'Failed to fetch players', details: error.message });
      const rows = (data || []).map(p => {
        const name = p.player_name || `${p.player_first_name ?? ''} ${p.player_last_name ?? ''}`.trim();
        const [first, ...rest] = name.split(' ');
        const games = Number(p.games ?? p.total_games ?? 0) || 0;
        const disposals = Number(p.disposals ?? p.total_disposals ?? 0) || 0;
        const goals = Number(p.goals ?? p.total_goals ?? 0) || 0;
        return {
          player_id: p.player_id,
          player_first_name: p.player_first_name ?? first ?? '',
          player_last_name: p.player_last_name ?? rest.join(' '),
          first_year: p.first_season ?? p.first_year ?? null,
          last_year: p.last_season ?? p.last_year ?? null,
          total_games: games,
          total_disposals: disposals,
          total_goals: goals,
          avg_disposals: games ? (disposals / games).toFixed(1) : '0.0',
          avg_goals: games ? (goals / games).toFixed(1) : '0.0'
        };
      });
      return res.json(rows);
      
    } else {
      res.status(400).json({ error: 'Missing required parameter' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
}
