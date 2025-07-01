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
    `, { distinct: ['match_id'] })
    .or(`and(match_home_team.eq.${home},match_away_team.eq.${away}),and(match_home_team.eq.${away},match_away_team.eq.${home})`)
    .order('match_date', { ascending: false });

  if (error) return res.status(500).json({ error });

  // dedupe raw rows by match_id
  const matchMap = new Map();
  games.forEach(g => {
    if (!matchMap.has(g.match_id)) {
      matchMap.set(g.match_id, g);
    }
  });
  const deduped = Array.from(matchMap.values());

  const uniqueGames = deduped.map(g => ({
    match_id: g.match_id,
    match_date: g.match_date,
    venue_name: g.venue_name,
    homeTeam: g.match_home_team,
    awayTeam: g.match_away_team,
    winner: g.match_winner,
    margin: g.match_margin,
    homeScore: g.match_home_team_score,
    awayScore: g.match_away_team_score,
    match_round: g.match_round
  }));

  const summary = { totalGames: uniqueGames.length, [home]: 0, [away]: 0 };
  uniqueGames.forEach(g => {
    summary[g.winner] = (summary[g.winner] || 0) + 1;
  });

  const lastMeeting = uniqueGames[0] || null;
  const biggestWins = {};
  uniqueGames.forEach(g => {
    if (!biggestWins[g.winner] || g.margin > biggestWins[g.winner].margin) {
      biggestWins[g.winner] = { margin: g.margin, ...g };
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
    headToHeadHistory: uniqueGames
  });
}