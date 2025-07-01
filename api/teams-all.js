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
      // Team details endpoint - this is now handled in stats-all.js with type=team-details
      // But we'll keep this for backward compatibility
      const { data: allMatches, error: matchesError } = await supabase
        .from('afl_data')
        .select(`
          match_id, match_home_team, match_away_team, match_winner,
          match_home_team_score, match_away_team_score, match_margin,
          match_date, match_round, venue_name
        `)
        .or(`match_home_team.eq.${teamName},match_away_team.eq.${teamName}`);

      if (matchesError) throw matchesError;

      // Remove duplicates
      const uniqueMatches = allMatches.reduce((acc, match) => {
        if (!acc.find(m => m.match_id === match.match_id)) {
          acc.push(match);
        }
        return acc;
      }, []);

      const teamStats = {
        total_matches: uniqueMatches.length,
        wins: uniqueMatches.filter(m => m.match_winner === teamName).length,
        losses: uniqueMatches.filter(m => m.match_winner && m.match_winner !== teamName).length
      };

      // Calculate highest and lowest scores
      const teamScores = uniqueMatches.map(match => {
        return match.match_home_team === teamName 
          ? parseInt(match.match_home_team_score) || 0
          : parseInt(match.match_away_team_score) || 0;
      }).filter(score => score > 0);

      teamStats.highest_score = Math.max(...teamScores, 0);
      teamStats.lowest_score = Math.min(...teamScores, Infinity) === Infinity ? 0 : Math.min(...teamScores);

      // Get player stats for this team
      const { data: playerData, error: playerError } = await supabase
        .from('afl_data')
        .select(`
          player_first_name, player_last_name, player_id,
          disposals, goals
        `)
        .eq('player_team', teamName)
        .not('disposals', 'is', null)
        .neq('disposals', '');

      if (playerError) throw playerError;

      // Aggregate player stats
      const playerStats = {};
      playerData.forEach(row => {
        const playerId = row.player_id;
        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_first_name: row.player_first_name,
            player_last_name: row.player_last_name,
            total_disposals: 0,
            total_goals: 0,
            games_played: 0
          };
        }
        playerStats[playerId].total_disposals += parseInt(row.disposals) || 0;
        playerStats[playerId].total_goals += parseInt(row.goals) || 0;
        playerStats[playerId].games_played += 1;
      });

      const topDisposals = Object.values(playerStats)
        .sort((a, b) => b.total_disposals - a.total_disposals)
        .slice(0, 10);

      const topGoals = Object.values(playerStats)
        .sort((a, b) => b.total_goals - a.total_goals)
        .slice(0, 10);

      // Grand Finals count
      const grandFinals = uniqueMatches
        .filter(m => 
          (m.match_round === 'GF' || m.match_round === 'Grand Final') && 
          m.match_winner === teamName
        );

      // Find biggest win
      const wins = uniqueMatches
        .filter(m => m.match_winner === teamName && m.match_margin)
        .map(m => ({ ...m, margin: parseInt(m.match_margin) || 0 }))
        .sort((a, b) => b.margin - a.margin);

      const biggestWin = wins.length > 0 ? wins[0] : null;

      res.json({
        team: teamName,
        stats: teamStats,
        topDisposals,
        topGoals,
        grandFinals: { grand_finals_won: grandFinals.length },
        biggestWin,
        allGames: uniqueMatches.slice(0, 50).sort((a, b) => 
          new Date(b.match_date) - new Date(a.match_date)
        )
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