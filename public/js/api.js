// API functions mapped to consolidated endpoints
const BASE = '/api';

export async function getYears() {
  const res = await fetch(`${BASE}/matches-all?years=true`);
  return res.json();
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
  const res = await fetch(`${BASE}/teams-all`);
  return res.json();
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
  // Placeholder - not implemented in consolidated version
  return [];
}

export async function getTopPerformers(teamName) {
  // Placeholder - not implemented in consolidated version  
  return {};
}

export async function getHeadToHead(team1, team2) {
  // Placeholder - not implemented in consolidated version
  return {};
}