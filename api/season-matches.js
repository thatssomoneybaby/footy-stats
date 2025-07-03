import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, round, rounds } = req.query;
  if (!year) {
    return res.status(400).json({ error: 'Missing ?year=' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // 1️⃣  Just need the list of rounds?
  if (rounds === 'true') {
    const { data, error } = await supabase.rpc('get_rounds_for_year', {
      p_year: parseInt(year, 10)
    });
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'DB error' });
    }
    // [{ round: 'R1' }, { round: 'R2' }, …]
    return res.json(data);
  }

  // 2️⃣  Full match list (optionally filtered by round)
  const { data, error } = await supabase.rpc('season_matches', {
    p_year: parseInt(year, 10),
    p_round: round ?? null            // null → all rounds
  });
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'DB error' });
  }

  // array of matches for that season / round
  res.json(data);
}