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
    console.log('Years data received:', data);
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
    console.log('Teams data received:', data);
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
  return res.json();          // returns an array of fixture objects
}

export async function getTopPerformers(teamName) {
  // Placeholder - not implemented in consolidated version  
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
    console.log('Match data received:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch match:', error);
    return null;
  }
}