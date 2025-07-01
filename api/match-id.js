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
        goals,
        behinds,
        tackles,
        hitouts,
        contested_possessions,
        clearances,
        intercepts,
        metres_gained,
        afl_fantasy_score,
        supercoach_score
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