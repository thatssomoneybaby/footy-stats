// Always hit the Vercel‑style serverless functions at /api/*.
// In dev (`npm run dev` with Vercel CLI or a local static file server),
// the functions are still mounted at http://localhost:3000/api/*.
const BASE = '/api';

export async function getYears() {
  const res = await fetch(`${BASE}/years`);
  return res.json();
}

export async function getMatches(year) {
  const res = await fetch(`${BASE}/matches?year=${year}`);
  return res.json();
}

export async function getRounds(year) {
  const res = await fetch(`${BASE}/rounds?year=${year}`);
  return res.json();
}

export async function getRoundMatches(year, round) {
  const res = await fetch(`${BASE}/rounds?year=${year}&round=${encodeURIComponent(round)}`);
  return res.json();
}

export async function getTeams() {
  const res = await fetch(`${BASE}/teams`);
  return res.json();
}

export async function getTeamDetails(teamName) {
  const res = await fetch(`${BASE}/teams/${encodeURIComponent(teamName)}`);
  return res.json();
}

export async function getPlayersAlphabet() {
  const res = await fetch(`${BASE}/players/alphabet`);
  return res.json();
}

export async function getPlayers(letter) {
  const res = await fetch(`${BASE}/players?letter=${encodeURIComponent(letter)}`);
  return res.json();
}

export async function getPlayerDetails(playerId) {
  const res = await fetch(`${BASE}/players/${encodeURIComponent(playerId)}`);
  return res.json();
}

export async function getTrophyRoom() {
  const res = await fetch(`${BASE}/trophy-room`);
  return res.json();
}

export async function getHallOfRecords() {
  const res = await fetch(`${BASE}/hall-of-records`);
  return res.json();
}

export async function getUpcomingGames() {
  const res = await fetch(`${BASE}/upcoming-games`);
  return res.json();
}

export async function getInsights() {
  const res = await fetch(`${BASE}/insights`);
  return res.json();
}

export async function getTopPerformers(teamName) {
  const res = await fetch(`${BASE}/top-performers/${encodeURIComponent(teamName)}`);
  return res.json();
}

export async function getHeadToHead(team1, team2) {
  const res = await fetch(`${BASE}/head-to-head/${encodeURIComponent(team1)}/${encodeURIComponent(team2)}`);
  return res.json();
}