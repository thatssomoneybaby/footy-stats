import { supabase as sbClient } from '../db.js';

const ROUND_ORDER = {
  EF: 101,  // Elimination Final
  QF: 102,  // Qualifying Final
  SF: 103,  // Semi Final
  PF: 104,  // Preliminary Final
  GF: 105   // Grand Final
};

function roundSortKey(value) {
  if (value == null) return 0;
  const v = String(value).trim().toUpperCase();
  // Extract first numeric chunk (handles labels like "R1", "Round 12")
  const m = v.match(/(\d+)/);
  if (m) {
    const num = parseInt(m[1], 10);
    if (!Number.isNaN(num)) return num;
  }
  if (ROUND_ORDER[v] != null) return ROUND_ORDER[v];
  // Unknown labels go to the end
  return 1000;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, rounds, round, matches, ladder } = req.query;

  try {
    // 1️⃣  No query params  →  list of seasons
    if (!year) {
      const { data, error } = await sbClient.rpc('get_years');
      if (error) throw error;
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=30');
      return res.json(data);
    }

    const yr = parseInt(year, 10);
    if (!Number.isFinite(yr)) {
      return res.status(400).json({ error: 'Invalid year parameter' });
    }

    // 2️⃣  ?year=YYYY&rounds=true  → list of rounds
    if (rounds === 'true') {
      const { data, error } = await sbClient.rpc('get_rounds_for_year', { p_year: yr });
      if (error) throw error;
      // Map DB shape → UI: { round }
      const rows = (data || []).map(r => ({ round: r.round ?? r.round_number ?? r.label ?? String(r) }));
      rows.sort((a, b) => roundSortKey(a.round) - roundSortKey(b.round));
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=30');
      return res.json(rows);
    }

    // 3️⃣  ?year=YYYY&ladder=true  → full season ladder
    if (ladder === 'true') {
      const { data, error } = await sbClient.rpc('season_ladder', { p_year: yr });
      if (error) throw error;
      // Ensure ladder_pos is present; map common aliases, round percentage to 1 decimal place
      const rows = (data || []).map((r, idx) => {
        const pctRaw = Number(r.percentage ?? r.pct ?? 0);
        const pct = Number.isFinite(pctRaw) ? Math.round(pctRaw * 10) / 10 : 0;
        return {
          ladder_pos: r.ladder_pos ?? r.position ?? r.rank ?? (idx + 1),
          team: r.team ?? r.team_name ?? r.club ?? '',
          wins: r.wins ?? r.w ?? 0,
          losses: r.losses ?? r.l ?? 0,
          draws: r.draws ?? r.d ?? 0,
          percentage: pct
        };
      });
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.json(rows);
    }

    // 4️⃣  ?year=YYYY&matches=true  → all matches for the season
    if (matches === 'true') {
      const { data, error } = await sbClient.rpc('season_matches', {
        p_year: yr,
        p_round: null        // null returns every round
      });
      if (error) throw error;
      const rows = (data || []).map(m => ({
        match_id: m.match_id,
        match_date: m.match_date,
        round: m.round ?? m.round_number ?? m.match_round,
        venue: m.venue ?? m.venue_name,
        match_home_team: m.match_home_team ?? m.home_team,
        match_away_team: m.match_away_team ?? m.away_team,
        match_home_score: m.match_home_score ?? m.home_score,
        match_away_score: m.match_away_score ?? m.away_score,
        margin: m.margin,
        winner: m.winner
      }));
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.json(rows);
    }

    // 5️⃣  ?year=YYYY&round=RX  → matches for a single round
    if (round) {
      const { data, error } = await sbClient.rpc('season_matches', {
        p_year: yr,
        p_round: round
      });
      if (error) throw error;
      const rows = (data || []).map(m => ({
        match_id: m.match_id,
        match_date: m.match_date,
        round: m.round ?? m.round_number ?? m.match_round,
        venue: m.venue ?? m.venue_name,
        match_home_team: m.match_home_team ?? m.home_team,
        match_away_team: m.match_away_team ?? m.away_team,
        match_home_score: m.match_home_score ?? m.home_score,
        match_away_score: m.match_away_score ?? m.away_score,
        margin: m.margin,
        winner: m.winner
      }));
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.json(rows);
    }

    // 6️⃣  ?year=YYYY (no round)  → season summary
    const { data, error } = await sbClient.rpc('season_summary', { p_year: yr });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    // Map DB → UI keys for summary tiles (ensure no undefineds)
    // Robust numeric extraction with generous fallbacks for different SQL aliases
    const avgRaw = Number(
      row?.avg_total_points_per_game ??
      row?.avg_game_score ??
      row?.avg_points_per_game ??
      row?.avg_total_points ??
      0
    );
    const avgScore = Number.isFinite(avgRaw) ? Math.round(avgRaw * 10) / 10 : 0;
    const highRaw = Number(
      row?.highest_score ??
      row?.highest_team_score ??
      row?.highest_game_score ??
      row?.max_team_score ??
      row?.max_score ??
      0
    );
    const highestScore = Number.isFinite(highRaw) ? Math.round(highRaw) : 0;
    const marginRaw = Number(
      row?.biggest_margin ??
      row?.biggest_win ??
      row?.max_margin ??
      row?.largest_margin ??
      row?.highest_margin ??
      row?.max_game_margin ??
      0
    );
    const biggestMargin = Number.isFinite(marginRaw) ? Math.round(marginRaw) : 0;

    const mapped = {
      season: row?.season ?? yr,
      total_matches: row?.games ?? row?.total_matches ?? row?.total_games ?? 0,
      avg_game_score: avgScore,
      highest_score: highestScore,
      biggest_margin: biggestMargin,
      // Pass through optional fields when present (used by optional tiles)
      premiers: row?.premiers ?? null,
      top_goals_player: row?.top_goals_player ?? null,
      top_goals_total: row?.top_goals_total ?? null,
      top_goals_team: row?.top_goals_team ?? null,
      top_disposals_player: row?.top_disposals_player ?? null,
      top_disposals_total: row?.top_disposals_total ?? null,
      top_disposals_team: row?.top_disposals_team ?? null,
      top_kicks_player: row?.top_kicks_player ?? null,
      top_kicks_total: row?.top_kicks_total ?? null,
      top_kicks_team: row?.top_kicks_team ?? null,
      top_handballs_player: row?.top_handballs_player ?? null,
      top_handballs_total: row?.top_handballs_total ?? null,
      top_handballs_team: row?.top_handballs_team ?? null,
      top_marks_player: row?.top_marks_player ?? null,
      top_marks_total: row?.top_marks_total ?? null,
      top_marks_team: row?.top_marks_team ?? null,
      top_tackles_player: row?.top_tackles_player ?? null,
      top_tackles_total: row?.top_tackles_total ?? null,
      top_tackles_team: row?.top_tackles_team ?? null
    };
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'DB error' });
  }
}
