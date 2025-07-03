import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year } = req.query;
  if (!year) {
    return res.status(400).json({ error: 'Missing ?year=' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.rpc('season_summary', {
    p_year: parseInt(year, 10)
  });
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'DB error' });
  }

  // single JSON row with tiles data
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=30');
  res.json(Array.isArray(data) ? data[0] : data);
}