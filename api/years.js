import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { year, rounds, round, matches } = req.query;

  try {
    // 1️⃣  No query params  →  list of seasons
    if (!year) {
      const { data, error } = await sb.rpc('get_years');
      if (error) throw error;
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=30');
      return res.json(data);
    }

    const yr = parseInt(year, 10);

    // 2️⃣  ?year=YYYY&rounds=true  → list of rounds
    if (rounds === 'true') {
      const { data, error } = await sb.rpc('get_rounds_for_year', { p_year: yr });
      if (error) throw error;
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=30');
      return res.json(data);
    }

    // 3️⃣  ?year=YYYY&matches=true  → all matches for the season
    if (matches === 'true') {
      const { data, error } = await sb.rpc('season_matches', {
        p_year: yr,
        p_round: null        // null returns every round
      });
      if (error) throw error;
      return res.json(data);
    }

    // 4️⃣  ?year=YYYY&round=RX  → matches for a single round
    if (round) {
      const { data, error } = await sb.rpc('season_matches', {
        p_year: yr,
        p_round: round
      });
      if (error) throw error;
      return res.json(data);
    }

    // 5️⃣  ?year=YYYY (no round)  → season summary
    const { data, error } = await sb.rpc('season_summary', { p_year: yr });
    if (error) throw error;
    return res.json(Array.isArray(data) ? data[0] : data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'DB error' });
  }
}