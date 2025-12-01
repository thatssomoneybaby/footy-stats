import { supabase } from '../db.js';

// Returns total_unique_players and letter_counts (A..Z) based on mv_player_totals
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Count total unique players (one row per player in mv_player_totals)
    const { count: totalCount, error: totalErr } = await supabase
      .from('mv_player_totals')
      .select('player_id', { count: 'exact', head: true });
    if (totalErr) throw totalErr;

    // Count by first letter of last name
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const letter_counts = {};
    for (const L of letters) {
      const { count, error } = await supabase
        .from('mv_player_totals')
        .select('player_id', { count: 'exact', head: true })
        .ilike('player_last_name', `${L}%`);
      if (error) {
        // Fallback attempt with 'last_name'
        const { count: c2, error: e2 } = await supabase
          .from('mv_player_totals')
          .select('player_id', { count: 'exact', head: true })
          .ilike('last_name', `${L}%`);
        letter_counts[L] = (c2 ?? 0);
      } else {
        letter_counts[L] = (count ?? 0);
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ total_unique_players: totalCount ?? 0, letter_counts });
  } catch (err) {
    console.error('players-index error:', err);
    return res.status(500).json({ error: 'Failed to compute player index' });
  }
}

