export async function getTeamMatchYears(teamName) {
  const res = await fetch(
    `/api/team-match-years?team=${encodeURIComponent(teamName)}`
  );
  if (!res.ok) {
    console.error('Year fetch API error:', res.status, res.statusText);
    return [];
  }
  return res.json(); // [{ match_year: 2024 }, ...]
}

// API functions mapped to consolidated endpoints
const BASE = '/api';

export async function getYears() {
  try {
    const res = await fetch(`${BASE}/years`);
    if (!res.ok) {
      console.error('Years API error:', res.status, res.statusText);
      const errorData = await res.text();
      console.error('Error details:', errorData);
      return [];
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch years:', error);
    return [];
  }
}


/**
 * Fetch the high‑level summary for a single AFL season.
 * Server route: /api/years-summary?year=2024
 */
export async function getSeasonSummary(year) {
  const res = await fetch(`${BASE}/years?year=${year}`);
  if (!res.ok) {
    console.error('Season summary API error:', res.status, res.statusText);
    return null;
  }
  return res.json(); // { season, total_matches, avg_game_score, ... }
}

/**
 * Fetch the distinct round labels for a season (e.g. "R1", "QF", "GF").
 * Server route: /api/season-matches?year=2024&rounds=true
 */
export async function getRoundsForYear(year) {
  const res = await fetch(`${BASE}/years?year=${year}&rounds=true`);
  if (!res.ok) {
    console.error('Rounds API error:', res.status, res.statusText);
    return [];
  }
  return res.json(); // [{ round: 'R1' }, { round: 'R2' }, ...]
}

/**
 * Fetch all matches for a season, or for a specific round.
 * Server routes:
 *   /api/season-matches?year=2024
 *   /api/season-matches?year=2024&round=R5
 */
export async function getSeasonMatches(year, round = null) {
  const url = round
    ? `${BASE}/years?year=${year}&round=${encodeURIComponent(round)}`
    : `${BASE}/years?year=${year}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('Season matches API error:', res.status, res.statusText);
    return [];
  }
  return res.json(); // array of match objects
}

/**
 * Fetch all teams.
 * Supabase RPC: get_teams  →  /api/teams-all
 */
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
    return data;
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    return [];
  }
}

/**
 * Fetch the summary JSON for a single team.
 * Server route: /api/teams-all?teamName=Essendon
 *
 * @param {string} teamName – Team name as stored in DB
 * @returns {Promise<Object>} JSON blob from the team_summary RPC
 */
export async function getTeamSummary(teamName) {
  try {
    const res = await fetch(
      `${BASE}/teams-all?teamName=${encodeURIComponent(teamName)}`
    );
    if (!res.ok) {
      console.error('Team summary API error:', res.status, res.statusText);
      const errorData = await res.text();
      console.error('Error details:', errorData);
      return null;
    }
    return res.json();
  } catch (error) {
    console.error('Failed to fetch team summary:', error);
    return null;
  }
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

/**
 * Fetch all matches for a team in a single AFL season.
 * Server route: /api/team-matches?team=ESS&year=2002
 *
 * @param {string} teamName - Team name as stored in the DB (e.g. "Essendon")
 * @param {number|string} year - Four‑digit season year (e.g. 2002)
 * @returns {Promise<Array>} Array of match objects for that season
 */
export async function getTeamMatchesByYear(teamName, year) {
  const res = await fetch(
    `/api/team-matches?team=${encodeURIComponent(teamName)}&year=${year}`
  );
  if (!res.ok) {
    console.error('Season matches API error:', res.status, res.statusText);
    return [];
  }
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
    return data;
  } catch (error) {
    console.error('Failed to fetch match:', error);
    return null;
  }
}