import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const app = express();
app.use(cors());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Endpoint: get all available years
app.get('/years', async (_, res) => {
  try {
    const { data: yearsData, error } = await supabase
      .from('afl_data')
      .select('match_date')
      .not('match_date', 'is', null);
    
    if (error) throw error;
    
    const years = [...new Set(
      yearsData
        .map(row => row.match_date?.substring(0, 4))
        .filter(year => year && /^\d{4}$/.test(year))
    )].sort((a, b) => b.localeCompare(a));
    
    res.json(years);
  } catch (error) {
    console.error('Error fetching years:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

// Endpoint: get all matches for a given year
app.get('/matches', async (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'Year required' });

  try {
    const { data: matches, error } = await supabase
      .from('afl_data')
      .select('*')
      .gte('match_date', `${year}-01-01`)
      .lt('match_date', `${parseInt(year) + 1}-01-01`);
    
    if (error) throw error;
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Endpoint: get all unique teams with their year range
app.get('/teams', async (_, res) => {
  try {
    const { data: homeTeams, error: homeError } = await supabase
      .from('afl_data')
      .select('match_home_team as team_name, match_date, match_id')
      .not('match_home_team', 'is', null)
      .neq('match_home_team', '');

    if (homeError) throw homeError;

    const { data: awayTeams, error: awayError } = await supabase
      .from('afl_data')
      .select('match_away_team as team_name, match_date, match_id')
      .not('match_away_team', 'is', null)
      .neq('match_away_team', '');

    if (awayError) throw awayError;

    // Combine and aggregate
    const allTeamMatches = [
      ...homeTeams.map(t => ({ team_name: t.match_home_team, match_date: t.match_date, match_id: t.match_id })),
      ...awayTeams.map(t => ({ team_name: t.match_away_team, match_date: t.match_date, match_id: t.match_id }))
    ];
    
    const teamStats = {};
    allTeamMatches.forEach(row => {
      const teamName = row.team_name;
      if (!teamStats[teamName]) {
        teamStats[teamName] = {
          team_name: teamName,
          match_dates: [],
          match_ids: new Set()
        };
      }
      if (row.match_date) {
        teamStats[teamName].match_dates.push(row.match_date);
      }
      if (row.match_id) {
        teamStats[teamName].match_ids.add(row.match_id);
      }
    });

    const teams = Object.values(teamStats)
      .map(team => {
        const years = team.match_dates.map(date => date.substring(0, 4));
        const uniqueYears = [...new Set(years)];
        
        return {
          team_name: team.team_name,
          first_year: uniqueYears.length > 0 ? Math.min(...uniqueYears) : null,
          last_year: uniqueYears.length > 0 ? Math.max(...uniqueYears) : null,
          total_matches: team.match_ids.size
        };
      })
      .filter(team => team.team_name)
      .sort((a, b) => a.team_name.localeCompare(b.team_name));
    
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Endpoint: get team stats and summary
app.get('/teams/:teamName', async (req, res) => {
  const { teamName } = req.params;
  
  try {
    // Get all matches for this team
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

    // Get player stats
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
      .map(p => ({ ...p, avg_disposals: (p.total_disposals / p.games_played).toFixed(1) }))
      .sort((a, b) => b.total_disposals - a.total_disposals)
      .slice(0, 10);

    const topGoals = Object.values(playerStats)
      .map(p => ({ ...p, avg_goals: (p.total_goals / p.games_played).toFixed(1) }))
      .sort((a, b) => b.total_goals - a.total_goals)
      .slice(0, 10);

    res.json({
      team: teamName,
      stats: teamStats,
      topDisposals,
      topGoals
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

// Endpoint: get alphabet letters with player counts
app.get('/players/alphabet', async (_, res) => {
  try {
    const { data: playersData, error } = await supabase
      .from('afl_data')
      .select('player_first_name, player_last_name, player_id')
      .not('player_id', 'is', null)
      .neq('player_id', '')
      .not('player_first_name', 'is', null)
      .neq('player_first_name', '')
      .not('player_last_name', 'is', null)
      .neq('player_last_name', '');

    if (error) throw error;

    // Count unique players by first letter
    const letterCounts = {};
    const uniquePlayers = new Set();
    
    playersData.forEach(row => {
      const playerId = row.player_id;
      if (!uniquePlayers.has(playerId) && row.player_last_name) {
        uniquePlayers.add(playerId);
        const letter = row.player_last_name.charAt(0).toUpperCase();
        if (/[A-Z]/.test(letter)) {
          letterCounts[letter] = (letterCounts[letter] || 0) + 1;
        }
      }
    });

    const letters = Object.entries(letterCounts)
      .map(([letter, player_count]) => ({ letter, player_count }))
      .sort((a, b) => a.letter.localeCompare(b.letter));

    res.json(letters);
  } catch (error) {
    console.error('Error fetching players alphabet:', error);
    res.status(500).json({ error: 'Failed to fetch players alphabet' });
  }
});

// Endpoint: get players by letter
app.get('/players', async (req, res) => {
  const { letter } = req.query;
  
  if (!letter) {
    return res.status(400).json({ error: 'Letter parameter required' });
  }
  
  try {
    const { data: playersData, error } = await supabase
      .from('afl_data')
      .select(`
        player_id, player_first_name, player_last_name,
        disposals, goals, match_date
      `)
      .not('player_id', 'is', null)
      .neq('player_id', '')
      .not('player_first_name', 'is', null)
      .neq('player_first_name', '')
      .not('player_last_name', 'is', null)
      .neq('player_last_name', '')
      .ilike('player_last_name', `${letter}%`);

    if (error) throw error;

    // Aggregate by player
    const playerStats = {};
    playersData.forEach(row => {
      const playerId = row.player_id;
      if (!playerStats[playerId]) {
        playerStats[playerId] = {
          player_id: playerId,
          player_first_name: row.player_first_name,
          player_last_name: row.player_last_name,
          total_games: 0,
          total_disposals: 0,
          total_goals: 0,
          years: new Set()
        };
      }
      
      playerStats[playerId].total_games++;
      playerStats[playerId].total_disposals += parseInt(row.disposals) || 0;
      playerStats[playerId].total_goals += parseInt(row.goals) || 0;
      
      if (row.match_date) {
        playerStats[playerId].years.add(row.match_date.substring(0, 4));
      }
    });

    const players = Object.values(playerStats)
      .map(player => ({
        ...player,
        first_year: player.years.size > 0 ? Math.min(...Array.from(player.years)) : null,
        last_year: player.years.size > 0 ? Math.max(...Array.from(player.years)) : null
      }))
      .filter(player => player.total_games > 0)
      .sort((a, b) => {
        const lastNameCompare = a.player_last_name.localeCompare(b.player_last_name);
        return lastNameCompare !== 0 ? lastNameCompare : a.player_first_name.localeCompare(b.player_first_name);
      });

    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Endpoint: get individual player stats
app.get('/players/:playerId', async (req, res) => {
  const { playerId } = req.params;
  
  try {
    const { data: playerData, error } = await supabase
      .from('afl_data')
      .select(`
        player_first_name, player_last_name, player_id,
        disposals, goals, match_date, match_id, match_round, venue_name,
        match_home_team, match_away_team, player_team,
        kicks, handballs, marks, tackles
      `)
      .eq('player_id', playerId);

    if (error) throw error;

    if (playerData.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Calculate career stats
    const playerName = {
      player_first_name: playerData[0].player_first_name,
      player_last_name: playerData[0].player_last_name
    };

    let totalDisposals = 0;
    let totalGoals = 0;
    let totalGames = 0;
    const years = new Set();

    playerData.forEach(game => {
      totalDisposals += parseInt(game.disposals) || 0;
      totalGoals += parseInt(game.goals) || 0;
      totalGames++;
      if (game.match_date) {
        years.add(game.match_date.substring(0, 4));
      }
    });

    const playerStats = {
      ...playerName,
      total_games: totalGames,
      total_disposals: totalDisposals,
      total_goals: totalGoals,
      first_year: years.size > 0 ? Math.min(...Array.from(years)) : null,
      last_year: years.size > 0 ? Math.max(...Array.from(years)) : null
    };

    // Sort games by date desc
    const allGames = playerData
      .sort((a, b) => new Date(b.match_date) - new Date(a.match_date));

    res.json({
      player: playerStats,
      allGames: allGames
    });
  } catch (error) {
    console.error('Error fetching player details:', error);
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
});

// Endpoint: get trophy room - top performers
app.get('/trophy-room', async (_, res) => {
  try {
    const keyStats = [
      { name: 'Total Goals', column: 'goals', icon: '⚽', category: 'Scoring' },
      { name: 'Total Disposals', column: 'disposals', icon: '🎯', category: 'Possession' },
      { name: 'Total Tackles', column: 'tackles', icon: '💪', category: 'Defence' }
    ];

    const trophyHolders = [];

    for (const stat of keyStats) {
      try {
        const { data: result, error } = await supabase
          .from('afl_data')
          .select(`
            player_first_name, player_last_name, player_id,
            ${stat.column}
          `)
          .not(stat.column, 'is', null)
          .neq(stat.column, '')
          .gt(stat.column, 0);

        if (error) {
          console.error(`Error fetching ${stat.name}:`, error);
          continue;
        }

        // Aggregate by player
        const playerStats = {};
        result.forEach(row => {
          const playerId = row.player_id;
          if (!playerStats[playerId]) {
            playerStats[playerId] = {
              player_first_name: row.player_first_name,
              player_last_name: row.player_last_name,
              player_id: playerId,
              stat_value: 0,
              games_played: 0
            };
          }
          playerStats[playerId].stat_value += parseInt(row[stat.column]) || 0;
          playerStats[playerId].games_played += 1;
        });

        const topPlayer = Object.values(playerStats)
          .sort((a, b) => b.stat_value - a.stat_value)[0];

        if (topPlayer) {
          trophyHolders.push({
            ...stat,
            player: topPlayer
          });
        }
      } catch (statError) {
        console.error(`Error processing stat ${stat.name}:`, statError);
      }
    }

    res.json(trophyHolders);
  } catch (error) {
    console.error('Trophy room error:', error);
    res.status(500).json({ error: 'Failed to load trophy room' });
  }
});

// For Vercel deployment, we need to handle both development and production
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  app.listen(port, () => {
    console.log(`✅ API running on http://localhost:${port}`);
  });
}

// Export the app for Vercel
export default app;