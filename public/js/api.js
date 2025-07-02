export async function getTeamMatchYears(teamName) {
  const res = await fetch(`/api/rpc/get_match_years_for_team?team_name=${encodeURIComponent(teamName)}`);
  return res.json();
}

export async function getTeamStats(teamName) {
  const res = await fetch(`/api/rpc/get_team_stats?team_name=${encodeURIComponent(teamName)}`);
  return res.json();
}

export async function getTeamBestWin(teamName) {
  const res = await fetch(`/api/rpc/get_team_best_win?team_name=${encodeURIComponent(teamName)}`);
  return res.json();
}

export async function getGrandFinalWins(teamName) {
  const res = await fetch(`/api/rpc/get_grand_final_wins?team_name=${encodeURIComponent(teamName)}`);
  return res.json();
}

export async function getTeamsWithRanges() {
  const res = await fetch(`/api/rpc/get_teams_with_ranges`);
  return res.json();
}
// API functions mapped to consolidated endpoints
const BASE = '/api';

export async function getYears() {
  try {
    const res = await fetch(`${BASE}/matches-all?years=true`);
    if (!res.ok) {
      console.error('Years API error:', res.status, res.statusText);
      const errorData = await res.text();
      console.error('Error details:', errorData);
      return [];
    }
    const data = await res.json();
    if (process.env.NODE_ENV !== 'production') {
      console.log('Years data received:', data);
    }
    return data;
  } catch (error) {
    console.error('Failed to fetch years:', error);
    return [];
  }
}

export async function getMatches(year) {
  const res = await fetch(`${BASE}/matches-all?year=${year}`);
  return res.json();
}

export async function getRounds(year) {
  const res = await fetch(`${BASE}/matches-all?year=${year}&rounds=true`);
  return res.json();
}

export async function getRoundMatches(year, round) {
  const res = await fetch(`${BASE}/matches-all?year=${year}&round=${encodeURIComponent(round)}`);
  return res.json();
}

export async function getTeams() {
  try {
    const res = await fetch(`${BASE}/teams-all`);
    if (!res.ok) {
      console.error('Teams API error:', res.status, res.statusText);
      const errorData = await res.text();
      console.error('Error details:', errorData);
      return [];
    }
    const data = await res.json();
    if (process.env.NODE_ENV !== 'production') {
      console.log('Teams data received:', data);
    }
    return data;
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    return [];
  }
}

export async function getTeamDetails(teamName) {
  const res = await fetch(`${BASE}/teams-all?teamName=${encodeURIComponent(teamName)}`);
  return res.json();
}

export async function getPlayersAlphabet() {
  const res = await fetch(`${BASE}/players-all?alphabet=true`);
  return res.json();
}

export async function getPlayers(letter) {
  const res = await fetch(`${BASE}/players-all?letter=${encodeURIComponent(letter)}`);
  return res.json();
}

export async function getPlayerDetails(playerId) {
  const res = await fetch(`${BASE}/players-all?playerId=${encodeURIComponent(playerId)}`);
  return res.json();
}

export async function getTrophyRoom() {
  const res = await fetch(`${BASE}/stats-all?type=trophy-room`);
  return res.json();
}

export async function getHallOfRecords() {
  const res = await fetch(`${BASE}/stats-all?type=hall-of-records`);
  return res.json();
}

export async function getInsights() {
  const res = await fetch(`${BASE}/stats-all?type=insights`);
  return res.json();
}

export async function getUpcomingGames() {
  const res = await fetch('/api/upcoming-games');
  if (!res.ok) throw new Error('Could not load upcoming games');
  return res.json();
}

// TODO: Implement this endpoint when data is available
export async function getTopPerformers(teamName) {
  return {};
}

export async function getHeadToHead(home, away) {
  const res = await fetch(
    `/api/head-to-head/${encodeURIComponent(home)}/${encodeURIComponent(away)}`
  );
  return res.json();
}

export async function getMatchById(matchId) {
  try {
    const res = await fetch(`${BASE}/match/${matchId}`);
    if (!res.ok) {
      console.error('Match API error:', res.status, res.statusText);
      const errorData = await res.text();
      console.error('Error details:', errorData);
      return null;
    }
    const data = await res.json();
    if (process.env.NODE_ENV !== 'production') {
      console.log('Match data received:', data);
    }
    return data;
  } catch (error) {
    console.error('Failed to fetch match:', error);
    return null;
  }
}