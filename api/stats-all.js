import { supabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type } = req.query;

  try {
    // Using shared Supabase client

    if (type === 'trophy-room') {
      // Career leaders via single RPC. Pass through and standardize shape.
      const { data, error } = await supabase
        .rpc('trophy_room_career_leaders', { p_limit: 10 });
      if (error) return res.status(500).json({ error: 'Failed to load trophy room leaders', details: error.message });

      // Expect RPC rows to already include: category, stat_key, stat_label, player_id,
      // player_name, primary_team, games_played, stat_value, avg_per_game.
      const leaders = Array.isArray(data) ? data : [];
      // Cache leaders for a bit – highly stable
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');
      return res.json({ leaders });
      
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

      // Insights recap can change often – avoid caching
      res.setHeader('Cache-Control', 'no-store');
      res.json(insights);
      
    } else if (type === 'spotlight') {
      // Build a random spotlight from a mix of interesting data
      const picks = ['player_career', 'historic_blowout', 'historic_thriller', 'monster_game'];
      const choice = picks[Math.floor(Math.random() * picks.length)];

      if (choice === 'player_career') {
        const { data, error } = await supabase.rpc('trophy_room_career_leaders', { p_limit: 10 });
        if (error) return res.status(500).json({ error: 'Failed spotlight leaders', details: error.message });
        const rows = Array.isArray(data) ? data : [];
        if (!rows.length) return res.json({ type: 'empty' });

        // Group by stat_key for variety; pick a random stat, then a random entry within its top 10
        const byKey = rows.reduce((acc, r) => {
          const k = String(r.stat_key || 'misc').toLowerCase();
          (acc[k] ||= []).push(r);
          return acc;
        }, {});

        // Prefer some core stats if available; otherwise any key
        const preferred = ['goals','games','disposals','kicks','marks','tackles','hitouts'];
        const keys = Object.keys(byKey);
        const pool = preferred.filter(k => byKey[k]?.length).concat(keys.filter(k => !preferred.includes(k)));
        const statKey = pool[Math.floor(Math.random() * pool.length)];
        const group = byKey[statKey] || rows;
        const pick = group[Math.floor(Math.random() * Math.min(group.length, 10))];

        return res.json({
          type: 'player_career',
          title: pick.stat_label || 'Career Leader',
          blurb: `${pick.player_name} (${pick.primary_team || 'AFL'})`,
          value: Number(pick.value ?? pick.stat_value ?? 0),
          games: Number(pick.games ?? pick.games_played ?? 0),
          avg: Number(pick.value_per_game ?? pick.avg_per_game ?? 0),
          player_id: pick.player_id,
          team: pick.primary_team || null
        });
      }

      if (choice === 'historic_blowout') {
        const { data, error } = await supabase
          .from('mv_season_matches')
          .select('match_id, season, match_round, match_date, home_team, away_team, home_score, away_score, winner, margin, venue_name')
          .not('winner', 'is', null)
          .not('margin', 'is', null)
          .order('margin', { ascending: false })
          .limit(25);
        if (error) return res.status(500).json({ error: 'Failed spotlight blowout' });
        const rows = data || [];
        if (!rows.length) return res.json({ type: 'empty' });
        const pick = rows[Math.floor(Math.random() * rows.length)];
        const loser = pick.winner === pick.home_team ? pick.away_team : pick.home_team;
        return res.json({
          type: 'historic_blowout',
          title: 'Historic Blowout',
          blurb: `${pick.winner} beat ${loser} by ${Math.abs(Number(pick.margin))} pts (${pick.season}, ${pick.match_round})`,
          match_id: pick.match_id,
          season: pick.season,
          home_team: pick.home_team,
          away_team: pick.away_team,
          venue: pick.venue_name,
          margin: Number(pick.margin) || 0
        });
      }

      if (choice === 'historic_thriller') {
        const { data, error } = await supabase
          .from('mv_season_matches')
          .select('match_id, season, match_round, match_date, home_team, away_team, winner, margin, venue_name')
          .gt('margin', 0)
          .order('margin', { ascending: true })
          .limit(25);
        if (error) return res.status(500).json({ error: 'Failed spotlight thriller' });
        const rows = data || [];
        if (!rows.length) return res.json({ type: 'empty' });
        const pick = rows[Math.floor(Math.random() * rows.length)];
        const loser = pick.winner === pick.home_team ? pick.away_team : pick.home_team;
        return res.json({
          type: 'historic_thriller',
          title: 'One-Point Thriller',
          blurb: `${pick.winner} edged ${loser} by ${Math.abs(Number(pick.margin))} pt (${pick.season}, ${pick.match_round})`,
          match_id: pick.match_id,
          season: pick.season,
          home_team: pick.home_team,
          away_team: pick.away_team,
          venue: pick.venue_name,
          margin: Number(pick.margin) || 0
        });
      }

      // monster_game: either top disposals or top goals single game
      const statPick = Math.random() < 0.5 ? 'disposals' : 'goals';
      const { data: mdata, error: merr } = await supabase
        .from('mv_match_player_stats')
        .select(`match_id, match_date, match_round, player_id, player_team, player_name, disposals, goals, venue_name, match_home_team, match_away_team`)
        .order(statPick, { ascending: false, nullsFirst: false })
        .limit(25);
      if (merr) return res.status(500).json({ error: 'Failed spotlight monster game' });
      const mrows = mdata || [];
      if (!mrows.length) return res.json({ type: 'empty' });
      const mpick = mrows[Math.floor(Math.random() * mrows.length)];
      const val = Number(mpick[statPick]) || 0;
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        type: 'monster_game',
        title: statPick === 'disposals' ? 'Possession Masterclass' : 'Goal Kicking Clinic',
        blurb: `${mpick.player_name} (${mpick.player_team}) — ${val} ${statPick} (${mpick.match_round})`,
        player_id: mpick.player_id,
        match_id: mpick.match_id,
        stat_key: statPick,
        value: val
      });

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

      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');
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
