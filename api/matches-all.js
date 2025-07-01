import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, round, years, rounds } = req.query;

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    if (years === 'true') {
      // Years endpoint - get distinct years from matches
      const { data: yearsList, error } = await supabase
        .rpc('get_distinct_years');
      
      if (error) {
        console.error('Years query error:', error);
        // Fallback to raw SQL if RPC doesn't exist
        const { data: fallbackYears, error: fallbackError } = await supabase
          .from('afl_data')
          .select('match_date')
          .not('match_date', 'is', null);
        
        if (fallbackError) throw fallbackError;
        
        const years = [...new Set(
          fallbackYears
            .map(row => row.match_date?.substring(0, 4))
            .filter(year => year && /^\d{4}$/.test(year))
        )].sort((a, b) => b.localeCompare(a));
        
        return res.json(years);
      }
      
      res.json(yearsList.map(row => row.year));
      
    } else if (year && round) {
      // Specific round matches with team names
      const { data: matches, error } = await supabase
        .from('afl_data')
        .select(`
          match_id, match_date, match_round,
          match_home_team, match_away_team,
          match_home_team_score, match_away_team_score,
          match_winner, match_margin, venue_name
        `)
        .gte('match_date', `${year}-01-01`)
        .lt('match_date', `${parseInt(year) + 1}-01-01`)
        .eq('match_round', round)
        .order('match_date');

      if (error) throw error;
      
      // Remove duplicates based on match_id
      const uniqueMatches = matches.reduce((acc, match) => {
        if (!acc.find(m => m.match_id === match.match_id)) {
          acc.push(match);
        }
        return acc;
      }, []);
      
      res.json(uniqueMatches);
      
    } else if (year) {
      if (rounds === 'true') {
        // Rounds for a year - get distinct rounds with match counts
        const { data: roundsData, error } = await supabase
          .from('afl_data')
          .select('match_round, match_id, match_date')
          .gte('match_date', `${year}-01-01`)
          .lt('match_date', `${parseInt(year) + 1}-01-01`)
          .not('match_round', 'is', null)
          .neq('match_round', '');

        if (error) throw error;
        
        // Group by round and calculate stats
        const roundStats = {};
        roundsData.forEach(row => {
          const round = row.match_round;
          if (!roundStats[round]) {
            roundStats[round] = {
              match_round: round,
              match_count: new Set(),
              dates: []
            };
          }
          roundStats[round].match_count.add(row.match_id);
          roundStats[round].dates.push(row.match_date);
        });
        
        const roundsFormatted = Object.values(roundStats).map(stats => ({
          match_round: stats.match_round,
          match_count: stats.match_count.size,
          first_match_date: Math.min(...stats.dates.map(d => new Date(d))).toISOString().split('T')[0],
          last_match_date: Math.max(...stats.dates.map(d => new Date(d))).toISOString().split('T')[0]
        }));
        
        // Sort rounds (numeric first, then alphabetic)
        roundsFormatted.sort((a, b) => {
          const aIsNumeric = /^\d+$/.test(a.match_round);
          const bIsNumeric = /^\d+$/.test(b.match_round);
          
          if (aIsNumeric && bIsNumeric) {
            return parseInt(a.match_round) - parseInt(b.match_round);
          } else if (aIsNumeric) {
            return -1;
          } else if (bIsNumeric) {
            return 1;
          } else {
            return a.match_round.localeCompare(b.match_round);
          }
        });
        
        res.json(roundsFormatted);
        
      } else {
        // All matches for a year
        const { data: matches, error } = await supabase
          .from('afl_data')
          .select(`
            match_id, match_date, match_round,
            match_home_team, match_away_team,
            match_home_team_score, match_away_team_score,
            match_winner, match_margin, venue_name
          `)
          .gte('match_date', `${year}-01-01`)
          .lt('match_date', `${parseInt(year) + 1}-01-01`)
          .order('match_date', { ascending: false })
          .limit(100);

        if (error) throw error;
        
        // Remove duplicates
        const uniqueMatches = matches.reduce((acc, match) => {
          if (!acc.find(m => m.match_id === match.match_id)) {
            acc.push(match);
          }
          return acc;
        }, []);
        
        res.json(uniqueMatches);
      }
    } else {
      res.status(400).json({ error: 'Missing required parameters' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch match data' });
  }
}