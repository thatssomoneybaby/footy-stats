import { supabase } from '../../../db.js';

export default async function handler(req, res) {
  const { home, away } = req.query;

  const clean = str =>
    str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const cleanHome = clean(home);
  const cleanAway = clean(away);

  console.log('Cleaned values sent to RPC:', { cleanHome, cleanAway });
  // Get total unique meetings via Postgres function
  const { data: totalCount, error: countError } = await supabase
    .rpc('count_head_to_head', { home_team: cleanHome, away_team: cleanAway });

  if (countError) {
    console.error('RPC count error:', countError);
    return res.status(500).json({ error: 'Failed to fetch head-to-head count' });
  }

  // Instead of JS counting, fetch home_wins, away_wins and total_meetings in one go:
  const { data: rpcSummaryArr, error: rpcError } = await supabase
    .rpc('head_to_head_summary', { home_team: cleanHome, away_team: cleanAway });
  const rpcSummary = (rpcSummaryArr && rpcSummaryArr[0]) || { home_wins: 0, away_wins: 0, total_meetings: 0 };

  if (rpcError) {
    console.error('Summary RPC error:', rpcError);
    return res.status(500).json({ error: 'Failed to fetch head-to-head summary' });
  }

  // Build summary object for front-end
  const summary = {
    totalGames: rpcSummary.total_meetings,
    homeWins: rpcSummary.home_wins,
    awayWins: rpcSummary.away_wins,
    draws: rpcSummary.draws,
    homeLosses: rpcSummary.total_meetings - rpcSummary.home_wins - rpcSummary.draws,
    awayLosses: rpcSummary.total_meetings - rpcSummary.away_wins - rpcSummary.draws
  };

  const { data: games, error } = await supabase
    .from('mv_season_matches')
    .select(`
      match_id,
      match_date,
      venue_name,
      home_team,
      away_team,
      winner,
      margin,
      home_score,
      away_score,
      round_number
    `)
    .or(`and(home_team.eq.${cleanHome},away_team.eq.${cleanAway}),and(home_team.eq.${cleanAway},away_team.eq.${cleanHome})`)
    .order('match_date', { ascending: false })
    .limit(5000);

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
    // original fields for UI wiring
    match_home_team: g.home_team,
    match_away_team: g.away_team,
    match_winner: g.winner,
    match_home_team_score: g.home_score,
    match_away_team_score: g.away_score,
    // aliases for convenience
    homeTeam: g.home_team,
    awayTeam: g.away_team,
    winner: g.winner,
    homeScore: g.home_score,
    awayScore: g.away_score,
    margin: g.margin,
    match_round: g.round_number
  }));


  const lastMeeting = uniqueGames[0] || null;
  const biggestWins = {};
  uniqueGames.forEach(g => {
    if (!biggestWins[g.winner] || g.margin > biggestWins[g.winner].margin) {
      biggestWins[g.winner] = { margin: g.margin, ...g };
    }
  });

  let topGoals = [], topDisposals = [];
  if (lastMeeting) {
    const { data: players, error: pErr } = await supabase
      .rpc('head_to_head_last_meeting_players', { p_home: cleanHome, p_away: cleanAway });
    if (!pErr && players) {
      topGoals     = [...players].sort((a,b)=> (b.goals||0) - (a.goals||0)).slice(0,3);
      topDisposals = [...players].sort((a,b)=> (b.disposals||0) - (a.disposals||0)).slice(0,3);
    }
  }

  res.status(200).json({
    summary,
    biggestWins,
    lastMeeting,
    lastMeetingPerformers: { topGoals, topDisposals },
    headToHeadHistory: uniqueGames
  });
}
