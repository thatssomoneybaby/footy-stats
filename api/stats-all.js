import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type } = req.query;

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    if (type === 'trophy-room') {
      // Trophy room - simple key stats leaders
      const keyStats = [
        { name: 'Total Goals', column: 'goals', icon: '⚽', category: 'Scoring' },
        { name: 'Total Disposals', column: 'disposals', icon: '🎯', category: 'Possession' },
        { name: 'Total Tackles', column: 'tackles', icon: '💪', category: 'Defence' }
      ];

      const trophyHolders = [];
      
      for (const stat of keyStats) {
        const { data: result, error } = await supabase
          .from('afl_data')
          .select(`
            player_first_name, player_last_name, player_id,
            ${stat.column}
          `)
          .not(stat.column, 'is', null)
          .neq(stat.column, '')
          .gt(stat.column, 0)
          .range(0, 200000); // Get enough data for trophy calculations

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
      }
      
      res.json(trophyHolders);
      
    } else if (type === 'insights') {
      // Insights - most recent game info
      const { data: recentGame, error } = await supabase
        .from('afl_data')
        .select(`
          match_home_team, match_away_team,
          match_home_team_score, match_away_team_score,
          match_winner, match_margin, match_date, venue_name
        `)
        .not('match_winner', 'is', null)
        .not('match_margin', 'is', null)
        .neq('match_margin', '')
        .order('match_date', { ascending: false })
        .limit(1);

      if (error) throw error;

      const insights = [];
      if (recentGame && recentGame.length > 0) {
        const game = recentGame[0];
        const loser = game.match_winner === game.match_home_team 
          ? game.match_away_team 
          : game.match_home_team;
        
        insights.push({
          type: 'recent_game',
          title: 'Most Recent Game',
          description: `${game.match_winner} defeated ${loser} by ${Math.abs(parseInt(game.match_margin))} points`,
          icon: '🏈'
        });
      }

      res.json(insights);
      
    } else if (type === 'hall-of-records') {
      // Hall of Records - comprehensive top-10 lists by category
      const statCategories = {
        'Scoring': {
          icon: '⚽',
          color: 'red',
          stats: [
            { name: 'Goals', column: 'goals', icon: '⚽' },
            { name: 'Behinds', column: 'behinds', icon: '🎯' }
          ]
        },
        'Possession': {
          icon: '🏐',
          color: 'blue',
          stats: [
            { name: 'Disposals', column: 'disposals', icon: '🎯' },
            { name: 'Kicks', column: 'kicks', icon: '🦵' },
            { name: 'Handballs', column: 'handballs', icon: '✋' }
          ]
        },
        'Defence': {
          icon: '🛡️',
          color: 'purple',
          stats: [
            { name: 'Tackles', column: 'tackles', icon: '💪' },
            { name: 'Marks', column: 'marks', icon: '🙌' }
          ]
        }
      };

      const hallOfRecords = {};

      // Process each category
      for (const [categoryName, categoryData] of Object.entries(statCategories)) {
        hallOfRecords[categoryName] = {
          ...categoryData,
          records: {}
        };

        // Process each stat in the category
        for (const stat of categoryData.stats) {
          try {
            const { data: statData, error } = await supabase
              .from('afl_data')
              .select(`
                player_first_name, player_last_name, player_id,
                ${stat.column}, match_date
              `)
              .not(stat.column, 'is', null)
              .neq(stat.column, '')
              .gt(stat.column, 0)
              .range(0, 200000); // Get enough data for hall of records

            if (error) {
              console.error(`Error processing stat ${stat.name}:`, error);
              continue;
            }

            // Aggregate by player
            const playerStats = {};
            statData.forEach(row => {
              const playerId = row.player_id;
              if (!playerStats[playerId]) {
                playerStats[playerId] = {
                  player_first_name: row.player_first_name,
                  player_last_name: row.player_last_name,
                  player_id: playerId,
                  stat_value: 0,
                  games_played: 0,
                  years: new Set()
                };
              }
              playerStats[playerId].stat_value += parseInt(row[stat.column]) || 0;
              playerStats[playerId].games_played += 1;
              if (row.match_date) {
                playerStats[playerId].years.add(row.match_date.substring(0, 4));
              }
            });

            // Convert to array and calculate averages
            const top10 = Object.values(playerStats)
              .map(player => ({
                ...player,
                avg_per_game: player.games_played > 0 
                  ? (player.stat_value / player.games_played).toFixed(1) 
                  : '0.0',
                first_year: Math.min(...Array.from(player.years)),
                last_year: Math.max(...Array.from(player.years))
              }))
              .sort((a, b) => b.stat_value - a.stat_value)
              .slice(0, 10);

            if (top10.length > 0) {
              hallOfRecords[categoryName].records[stat.name] = {
                ...stat,
                top10
              };
            }
          } catch (statError) {
            console.error(`Error processing stat ${stat.name}:`, statError);
          }
        }
      }

      res.json(hallOfRecords);
      
    } else if (type === 'team-details') {
      // Team details for team page - comprehensive team statistics
      const { teamName } = req.query;
      
      if (!teamName) {
        return res.status(400).json({ error: 'Missing teamName parameter for team-details' });
      }

      // Get all matches for this team
      const { data: allMatches, error: matchesError } = await supabase
        .from('afl_data')
        .select(`
          match_id, match_home_team, match_away_team, match_winner,
          match_home_team_score, match_away_team_score, match_margin,
          match_date, match_round, venue_name
        `)
        .or(`match_home_team.eq.${teamName},match_away_team.eq.${teamName}`)
        .range(0, 100000); // Get enough data for team's full history

      if (matchesError) throw matchesError;

      // Remove duplicates and calculate team stats
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

      // Find biggest win
      const wins = uniqueMatches
        .filter(m => m.match_winner === teamName && m.match_margin)
        .map(m => ({ ...m, margin: parseInt(m.match_margin) || 0 }))
        .sort((a, b) => b.margin - a.margin);

      const biggestWin = wins.length > 0 ? wins[0] : null;

      // Get player stats for this team
      const { data: playerData, error: playerError } = await supabase
        .from('afl_data')
        .select(`
          player_first_name, player_last_name, player_id,
          disposals, goals, tackles, marks
        `)
        .eq('player_team', teamName)
        .not('disposals', 'is', null)
        .neq('disposals', '')
        .range(0, 100000); // Get enough data for team's player history

      if (playerError) throw playerError;

      // Aggregate player stats
      const playerStats = {};
      playerData.forEach(row => {
        const playerId = row.player_id;
        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_first_name: row.player_first_name,
            player_last_name: row.player_last_name,
            player_id: playerId,
            total_disposals: 0,
            total_goals: 0,
            total_tackles: 0,
            total_marks: 0,
            games_played: 0
          };
        }
        playerStats[playerId].total_disposals += parseInt(row.disposals) || 0;
        playerStats[playerId].total_goals += parseInt(row.goals) || 0;
        playerStats[playerId].total_tackles += parseInt(row.tackles) || 0;
        playerStats[playerId].total_marks += parseInt(row.marks) || 0;
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
      res.status(400).json({ error: 'Missing or invalid type parameter' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats data' });
  }
}