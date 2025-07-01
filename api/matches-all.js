import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, round, years, rounds } = req.query;

  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Missing database credentials'
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    if (years === 'true') {
      // Years endpoint - use efficient SQL function
      const { data: yearData, error } = await supabase
        .rpc('get_distinct_years');
      
      if (error) {
        console.error('Years RPC error:', error);
        // Fallback to the range method if function doesn't exist yet
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('afl_data')
          .select('match_date')
          .not('match_date', 'is', null)
          .order('match_date')
          .range(0, 200000);
        
        if (fallbackError) throw fallbackError;
        
        const years = [...new Set(
          fallbackData
            .map(row => row.match_date?.substring(0, 4))
            .filter(year => year && /^\d{4}$/.test(year))
        )].sort((a, b) => b.localeCompare(a));
        
        console.log('Years found (fallback):', years.length, 'Years:', years);
        return res.json(years);
      }
      
      const years = yearData.map(row => row.year);
      console.log('Years found (RPC):', years.length, 'Years:', years);
      return res.json(years);
      
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
        // Rounds for a year – let PostgreSQL do the heavy lifting via an RPC
        const { data: roundData, error } = await supabase
          .rpc('get_rounds_for_year', { yr: Number(year) });

        if (error) throw error;

        return res.json(roundData);
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
          .range(0, 10000); // Get more matches for the year

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