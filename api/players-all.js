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
      const rows = (alphabetData || []).map(r => ({
        letter: r.letter ?? r.initial ?? r.first_letter ?? '',
        count: r.count ?? r.player_count ?? r.total ?? 0,
      }));
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
      const allGames = games.map(g => ({
        match_id: g.match_id,
        match_date: g.match_date,
        match_round: g.match_round || g.round_number,
        venue_name: g.venue_name,
        match_home_team: g.home_team,
        match_away_team: g.away_team,
        player_team: g.player_team,
        disposals: g.disposals,
        goals: g.goals,
        kicks: g.kicks,
        handballs: g.handballs,
        marks: g.marks,
        tackles: g.tackles
      }));

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
