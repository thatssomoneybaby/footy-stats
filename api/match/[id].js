import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('afl_data')
      .select(`
        player_first_name,
        player_last_name,
        player_team,
        kicks,
        marks,
        handballs,
        disposals,
        effective_disposals,
        disposal_efficiency_percentage,
        goals,
        behinds,
        hitouts,
        tackles,
        rebounds,
        inside_fifties,
        clearances,
        clangers,
        free_kicks_for,
        free_kicks_against,
        brownlow_votes,
        contested_possessions,
        uncontested_possessions,
        contested_marks,
        marks_inside_fifty,
        one_percenters,
        bounces,
        goal_assists,
        time_on_ground_percentage,
        afl_fantasy_score,
        supercoach_score,
        centre_clearances,
        stoppage_clearances,
        score_involvements,
        metres_gained,
        turnovers,
        intercepts,
        tackles_inside_fifty,
        contest_def_losses,
        contest_def_one_on_ones,
        contest_off_one_on_ones,
        contest_off_wins,
        def_half_pressure_acts,
        effective_kicks,
        f50_ground_ball_gets,
        ground_ball_gets,
        hitouts_to_advantage,
        hitout_win_percentage,
        intercept_marks,
        marks_on_lead,
        pressure_acts,
        rating_points,
        ruck_contests,
        score_launches,
        shots_at_goal,
        spoils,
        player_position
      `)
      .eq('match_id', id)
      .order('player_last_name', { ascending: true });

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching match stats:', error);
    res.status(500).json({ error: 'Failed to fetch match data' });
  }
}