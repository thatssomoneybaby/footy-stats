import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.rpc('get_years');
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'DB error' });
  }

  // e.g. [{ season: 2024, total_matches: 207 }, …]
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=30');
  res.json(data);
}