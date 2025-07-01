import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { letter, playerId, alphabet } = req.query;

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

    if (alphabet === 'true') {
      // Players alphabet endpoint - use efficient SQL function
      const { data: alphabetData, error } = await supabase
        .rpc('get_player_alphabet');

      if (error) {
        console.error('Player alphabet RPC error:', error);
        // Fallback to range method if function doesn't exist yet
        const { data: playersData, error: fallbackError } = await supabase
          .from('afl_data')
          .select('player_first_name, player_last_name, player_id')
          .not('player_id', 'is', null)
          .neq('player_id', '')
          .not('player_first_name', 'is', null)
          .neq('player_first_name', '')
          .not('player_last_name', 'is', null)
          .neq('player_last_name', '')
          .range(0, 200000);

        if (fallbackError) throw fallbackError;

        // Process fallback data
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

        console.log('Player alphabet found (fallback):', letters.length);
        return res.json(letters);
      }

      console.log('Player alphabet found (RPC):', alphabetData.length);
      res.json(alphabetData);
      
    } else if (playerId) {
      // Individual player details
      const { data: playerData, error } = await supabase
        .from('afl_data')
        .select(`
          player_first_name, player_last_name, player_id,
          disposals, goals, match_date
        `)
        .eq('player_id', playerId)
        .range(0, 50000); // Get all games for this player

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

      // Get recent games
      const { data: allGames, error: gamesError } = await supabase
        .from('afl_data')
        .select(`
          match_id, match_date, match_round, venue_name,
          match_home_team, match_away_team, player_team,
          disposals, goals, kicks, handballs, marks, tackles
        `)
        .eq('player_id', playerId)
        .order('match_date', { ascending: false })
        .range(0, 200); // Get more games for player history

      if (gamesError) throw gamesError;

      res.json({
        player: playerStats,
        allGames: allGames || []
      });
      
    } else if (letter) {
      // Players by letter - use efficient SQL function
      const { data: players, error } = await supabase
        .rpc('get_players_by_letter', { search_letter: letter });

      if (error) {
        console.error('Players by letter RPC error:', error);
        // Fallback to range method if function doesn't exist yet
        const { data: playersData, error: fallbackError } = await supabase
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
          .ilike('player_last_name', `${letter}%`)
          .range(0, 200000);

        if (fallbackError) throw fallbackError;

        // Process fallback data
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

        const fallbackPlayers = Object.values(playerStats)
          .map(player => ({
            ...player,
            avg_disposals: player.total_games > 0 
              ? (player.total_disposals / player.total_games).toFixed(1) 
              : '0.0',
            avg_goals: player.total_games > 0 
              ? (player.total_goals / player.total_games).toFixed(1) 
              : '0.0',
            first_year: player.years.size > 0 ? Math.min(...Array.from(player.years)) : null,
            last_year: player.years.size > 0 ? Math.max(...Array.from(player.years)) : null
          }))
          .filter(player => player.total_games > 0)
          .sort((a, b) => {
            const lastNameCompare = a.player_last_name.localeCompare(b.player_last_name);
            return lastNameCompare !== 0 ? lastNameCompare : a.player_first_name.localeCompare(b.player_first_name);
          })
          .slice(0, 50);

        console.log('Players by letter found (fallback):', fallbackPlayers.length);
        return res.json(fallbackPlayers);
      }

      console.log('Players by letter found (RPC):', players.length);
      res.json(players);
      
    } else {
      res.status(400).json({ error: 'Missing required parameter' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
}