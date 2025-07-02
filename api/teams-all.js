import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamName } = req.query;

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

    if (teamName) {
      // --- NEW: pull one-row summary straight from the DB ---
      const { data: summary, error: summaryErr } = await supabase
        .rpc('get_team_summary', { team_name: teamName });

      if (summaryErr) throw summaryErr;
      const {
        total_matches,
        wins,
        losses,
        highest_score,
        biggest_win_margin,
        grand_finals_won
      } = summary[0];  // the function always returns one row

      const teamStats = {
        total_matches,
        wins,
        losses,
        win_rate: total_matches
          ? +(wins / total_matches * 100).toFixed(1)
          : 0,
        highest_score
      };

      // Biggest win & premierships come pre‑calculated; wrap for the front‑end shape
      const biggestWin = biggest_win_margin || null;
      const grandFinals = { grand_finals_won };

      // Get top 10 disposal getters and top 10 goal kickers (two lean RPCs)
      const [
        { data: disposalsData, error: dispErr },
        { data: goalsData,     error: goalsErr }
      ] = await Promise.all([
        supabase.rpc('get_team_top_disposals', { team_name: teamName, p_limit: 10 }),
        supabase.rpc('get_team_top_goals',     { team_name: teamName, p_limit: 10 })
      ]);

      if (dispErr) throw dispErr;
      if (goalsErr) throw goalsErr;

      const topDisposals = disposalsData;   // already sorted by SQL
      const topGoals     = goalsData;       // already sorted by SQL

      res.json({
        team: teamName,
        stats: teamStats,
        topDisposals,
        topGoals,
        grandFinals,
        biggestWin,
        allGames: []
      });
      
    } else {
      // Teams list endpoint - use efficient SQL function
      const { data: teams, error } = await supabase
        .rpc('get_teams_with_ranges');
      
      if (error) {
        console.error('Teams RPC error:', error);
        // Fallback to the range method if function doesn't exist yet
        const { data: homeTeams, error: homeError } = await supabase
          .from('afl_data')
          .select('match_home_team, match_date')
          .not('match_home_team', 'is', null)
          .neq('match_home_team', '')
          .order('match_date')
          .range(0, 200000);

        if (homeError) throw homeError;

        const { data: awayTeams, error: awayError } = await supabase
          .from('afl_data')
          .select('match_away_team, match_date')
          .not('match_away_team', 'is', null)
          .neq('match_away_team', '')
          .order('match_date')
          .range(0, 200000);

        if (awayError) throw awayError;

        // Process fallback data
        const allTeamMatches = [
          ...homeTeams.map(t => ({ team_name: t.match_home_team, match_date: t.match_date })),
          ...awayTeams.map(t => ({ team_name: t.match_away_team, match_date: t.match_date }))
        ];
        
        const teamStats = {};
        allTeamMatches.forEach(row => {
          const teamName = row.team_name;
          if (!teamStats[teamName]) {
            teamStats[teamName] = {
              team_name: teamName,
              match_dates: []
            };
          }
          if (row.match_date) {
            teamStats[teamName].match_dates.push(row.match_date);
          }
        });

        const fallbackTeams = Object.values(teamStats)
          .map(team => {
            const years = team.match_dates.map(date => date.substring(0, 4));
            const uniqueYears = [...new Set(years)];
            
            return {
              team_name: team.team_name,
              first_year: uniqueYears.length > 0 ? Math.min(...uniqueYears) : null,
              last_year: uniqueYears.length > 0 ? Math.max(...uniqueYears) : null,
              total_matches: team.match_dates.length
            };
          })
          .filter(team => team.team_name)
          .sort((a, b) => a.team_name.localeCompare(b.team_name));
        
        console.log('Teams found (fallback):', fallbackTeams.length);
        return res.json(fallbackTeams);
      }
      
      console.log('Teams found (RPC):', teams.length);
      res.json(teams);
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch team data' });
  }
}