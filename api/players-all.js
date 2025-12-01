import { supabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { letter, playerId, alphabet } = req.query;

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
      return res.status(200).json({ letters });

    } else if (playerId) {
      // RPCs only: career summary + seasons + recent games
      const pid = parseInt(playerId, 10);
      const [profileRsp, seasonsRsp, gamesRsp] = await Promise.all([
        supabase.rpc('get_player_profile', { p_player_id: pid }),
        supabase.rpc('get_player_seasons', { p_player_id: pid }),
        supabase.rpc('get_player_games', { p_player_id: pid, p_limit: 50 })
      ]);

      let prof = null;
      if (profileRsp.error) {
        // Fallback to view select if RPC is not resolved yet
        const { data: profRow, error: profErr } = await supabase
          .from('mv_player_career_totals')
          .select('*')
          .eq('player_id', pid)
          .single();
        if (profErr) return res.status(500).json({ error: 'Failed to fetch player profile', details: profileRsp.error.message || profErr.message });
        prof = profRow;
      } else {
        const profArr = Array.isArray(profileRsp.data) ? profileRsp.data : (profileRsp.data ? [profileRsp.data] : []);
        prof = profArr[0] || null;
      }
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

      let seasons = seasonsRsp.error ? [] : (seasonsRsp.data || []);
      if (seasonsRsp.error) {
        const { data: sData } = await supabase
          .from('mv_player_season_totals')
          .select('*')
          .eq('player_id', pid)
          .order('season', { ascending: true });
        seasons = sData || [];
      }

      let games = gamesRsp.error ? [] : (gamesRsp.data || []);
      if (gamesRsp.error) {
        const { data: gData } = await supabase
          .from('mv_match_player_stats')
          .select('*')
          .eq('player_id', pid)
          .order('match_date', { ascending: false })
          .limit(50);
        games = gData || [];
      }

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
      player.player_id = Number(playerId);
      player.total_games = prof.games || totalGames || 0;
      player.total_disposals = (prof.disposals ?? null) != null ? Number(prof.disposals) : totals.disposals;
      player.total_goals = (prof.goals ?? null) != null ? Number(prof.goals) : totals.goals;
      player.total_kicks = (prof.kicks ?? null) != null ? Number(prof.kicks) : totals.kicks;
      player.total_handballs = (prof.handballs ?? null) != null ? Number(prof.handballs) : totals.handballs;
      player.total_marks = (prof.marks ?? null) != null ? Number(prof.marks) : totals.marks;
      player.total_tackles = (prof.tackles ?? null) != null ? Number(prof.tackles) : totals.tackles;

      player.first_year = career_start ?? player.first_year ?? null;
      player.last_year = career_end ?? player.last_year ?? null;
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

      // Return raw contract expected by frontend
      return res.status(200).json({ profile: prof, seasons, games });
      
    } else if (letter) {
      // Players by letter - pass through RPC rows for frontend to use
      const { data, error } = await supabase.rpc('get_players_by_letter', { p_letter: letter });
      if (error) return res.status(500).json({ error: 'Failed to fetch players', details: error.message });
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
