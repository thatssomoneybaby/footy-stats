import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { home, away } = req.query;
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: games, error } = await supabase
    .from('afl_data')
    .select(`
      match_id,
      match_date,
      venue_name,
      match_home_team,
      match_away_team,
      match_winner,
      match_margin,
      match_home_team_score,
      match_away_team_score,
      match_round
    `)
    .or(`match_home_team.eq.${home},match_home_team.eq.${away}`)
    .or(`match_away_team.eq.${away},match_away_team.eq.${home}`)
    .order('match_date', { ascending: false });

  if (error) return res.status(500).json({ error });

  const summary = { totalGames: games.length, [home]: 0, [away]: 0 };
  games.forEach(g => {
    summary[g.match_winner] = (summary[g.match_winner] || 0) + 1;
  });

  const lastMeeting = games[0] || null;
  const biggestWins = {};
  games.forEach(g => {
    if (!biggestWins[g.match_winner] || g.match_margin > biggestWins[g.match_winner].margin) {
      biggestWins[g.match_winner] = { margin: g.match_margin, ...g };
    }
  });

  let topGoals = [], topDisposals = [];
  if (lastMeeting) {
    const { data: players } = await supabase
      .from('afl_data')
      .select('player_first_name, player_last_name, player_team, goals, disposals')
      .eq('match_id', lastMeeting.match_id);

    topGoals     = players.sort((a,b)=>b.goals - a.goals).slice(0,3);
    topDisposals = players.sort((a,b)=>b.disposals - a.disposals).slice(0,3);
  }

  res.status(200).json({
    summary,
    biggestWins,
    lastMeeting,
    lastMeetingPerformers: { topGoals, topDisposals },
    headToHeadHistory: games
  });
}