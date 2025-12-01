import { supabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { letter, playerId, alphabet } = req.query;

  try {
    // Using shared Supabase client

    if (alphabet === 'true') {
      // Players alphabet endpoint → normalize to { letter, count }
      const { data: alphabetData, error } = await supabase
        .rpc('get_player_alphabet');
      if (error) return res.status(500).json({ error: 'Failed to fetch player alphabet' });
      let rows = (alphabetData || []).map(r => ({
        letter: r.letter ?? r.initial ?? r.first_letter ?? '',
        count: Number(r.count ?? r.player_count ?? r.total ?? r.cnt ?? 0) || 0,
      }));
      // Fallback: if all counts are zero, attempt to compute counts per letter
      const allZero = rows.length && rows.every(r => !r.count);
      if (allZero) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const results = await Promise.all(letters.map(async L => {
          const { data } = await supabase.rpc('get_players_by_letter', { p_letter: L });
          return { letter: L, count: Array.isArray(data) ? data.length : 0 };
        }));
        rows = results;
      }
      return res.json(rows);
      
    } else if (playerId) {
      // RPCs only: career summary + seasons + recent games
      const [profileRsp, seasonsRsp, gamesRsp] = await Promise.all([
        supabase.rpc('get_player_profile', { p_player_id: playerId }),
        supabase.rpc('get_player_seasons', { p_player_id: playerId }),
        supabase.rpc('get_player_games', { p_player_id: playerId, p_limit: 200 })
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
      const career_start = years.length ? Math.min(...years) : prof.first_season ?? null;
      const career_end   = years.length ? Math.max(...years) : prof.last_season ?? null;
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

      // Merge computed aggregates back into player core object
      const gamesCount = totalGames || (prof.games || 0);
      player.total_games = gamesCount;
      player.total_disposals = totals.disposals || (prof.disposals || 0);
      player.total_goals = totals.goals || (prof.goals || 0);
      player.total_kicks = totals.kicks || (prof.kicks || 0);
      player.total_handballs = totals.handballs || (prof.handballs || 0);
      player.total_marks = totals.marks || (prof.marks || 0);
      player.total_tackles = totals.tackles || (prof.tackles || 0);

      player.first_year = career_start ?? player.first_year ?? null;
      player.last_year = career_end ?? player.last_year ?? null;
      player.teams_path = teams_path || null;
      player.debut_date = debut_date;
      player.debut_venue = debut_venue;
      player.debut_opponent = debut_opponent;

      player.avg_disposals = avg1(totals.disposals);
      player.avg_goals     = avg1(totals.goals);
      player.avg_kicks     = avg1(totals.kicks);
      player.avg_handballs = avg1(totals.handballs);
      player.avg_marks     = avg1(totals.marks);
      player.avg_tackles   = avg1(totals.tackles);

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
