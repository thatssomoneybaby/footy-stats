import { supabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type } = req.query;

  try {
    // Using shared Supabase client

    if (type === 'trophy-room') {
      // Career leaders via RPC over mv_player_career_totals
      const { data, error } = await supabase
        .rpc('trophy_room_career_leaders', { p_limit: 10 });
      if (error) return res.status(500).json({ error: 'Failed to load trophy leaders' });

      // Map only the three headline stats used by the UI
      const wanted = {
        goals:      { name: 'Total Goals',      icon: '⚽', category: 'Scoring' },
        disposals:  { name: 'Total Disposals',  icon: '🎯', category: 'Possession' },
        tackles:    { name: 'Total Tackles',    icon: '💪', category: 'Defence' }
      };

      const byStat = (data || []).reduce((acc, r) => {
        const key = String(r.stat_key || '').toLowerCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {});

      const trophies = Object.entries(wanted).map(([key, meta]) => {
        const rows = (byStat[key] || []).sort((a,b) => Number(b.value||0) - Number(a.value||0));
        const top = rows[0];
        if (!top) return null;
        const [first, ...rest] = (top.player_name || '').split(' ');
        return {
          name: meta.name,
          icon: meta.icon,
          category: meta.category,
          player: {
            player_first_name: first || '',
            player_last_name: rest.join(' '),
            player_id: top.player_id,
            stat_value: Number(top.value || 0),
            games_played: Number(top.games || 0)
          }
        };
      }).filter(Boolean);

      res.json(trophies);
      
    } else if (type === 'insights') {
      // Insights - most recent game info
      const { data: recentGame, error } = await supabase
        .from('mv_season_matches')
        .select(`
          home_team, away_team,
          home_score, away_score,
          winner, margin, match_date, venue_name
        `)
        .not('winner', 'is', null)
        .not('margin', 'is', null)
        .order('match_date', { ascending: false })
        .limit(1);

      if (error) throw error;

      const insights = [];
      if (recentGame && recentGame.length > 0) {
        const game = recentGame[0];
        const loser = game.winner === game.home_team 
          ? game.away_team 
          : game.home_team;
        
        insights.push({
          type: 'recent_game',
          title: 'Most Recent Game',
          description: `${game.winner} defeated ${loser} by ${Math.abs(parseInt(game.margin))} points`,
          icon: '🏈'
        });
      }

      res.json(insights);
      
    } else if (type === 'hall-of-records') {
      // Single-season records via RPC over mv_player_season_totals
      const { data, error } = await supabase
        .rpc('hall_of_records_season_leaders', { p_limit: 10 });
      if (error) return res.status(500).json({ error: 'Failed to load hall of records' });

      const categoryMeta = {
        scoring:   { title: 'Scoring',    icon: '⚽', color: 'red' },
        possession:{ title: 'Possession', icon: '🏐', color: 'blue' },
        defence:   { title: 'Defence',    icon: '🛡️', color: 'purple' }
      };

      const hallOfRecords = {};

      // Seed categories
      Object.entries(categoryMeta).forEach(([key, meta]) => {
        hallOfRecords[meta.title] = { icon: meta.icon, color: meta.color, records: {} };
      });

      // Group rows into categories and stats
      for (const row of (data || [])) {
        const categoryKey = String(row.category || '').toLowerCase();
        const meta = categoryMeta[categoryKey] || categoryMeta.scoring;
        const cat = hallOfRecords[meta.title];
        const statLabel = row.stat_label || row.stat_key || 'Stat';
        if (!cat.records[statLabel]) {
          cat.records[statLabel] = { icon: meta.icon, top10: [] };
        }
        const [first, ...rest] = (row.player_name || '').split(' ');
        cat.records[statLabel].top10.push({
          player_first_name: first || '',
          player_last_name: rest.join(' '),
          player_id: row.player_id,
          stat_value: Number(row.value || 0),
          games_played: Number(row.games || 0),
          avg_per_game: Number(row.value_per_game || 0).toFixed(1),
          first_year: row.season,
          last_year: row.season
        });
      }

      res.json(hallOfRecords);
      
    } else if (type === 'team-details') {
      // Deprecated path – use /api/teams-all?teamName=...
      return res.status(400).json({ error: 'Use /api/teams-all?teamName=...' });
      
    } else {
      res.status(400).json({ error: 'Missing or invalid type parameter' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats data' });
  }
}
