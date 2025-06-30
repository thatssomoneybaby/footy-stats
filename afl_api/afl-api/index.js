import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const app = express();
app.use(cors()); // Allow frontend to access this

const db = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

// Endpoint: get all available years
app.get('/years', async (_, res) => {
  try {
    const years = await db.execute(`
      SELECT DISTINCT substr(match_date, 1, 4) AS year
      FROM AFL_data
      WHERE year GLOB '[1-2][0-9][0-9][0-9]'
      ORDER BY year DESC
    `);
    res.json(years.rows.map(row => row.year));
  } catch (error) {
    console.error('Error fetching years:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

// Endpoint: get all matches for a given year
app.get('/matches', (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'Year required' });

  const matches = db.prepare(`
    SELECT * FROM AFL_data
    WHERE strftime('%Y', match_date) = ?
  `).all(year);

  res.json(matches);
});

// Endpoint: get all unique teams with their year range
app.get('/teams', (_, res) => {
  const teams = db.prepare(`
    SELECT 
      team_name,
      MIN(substr(match_date, 1, 4)) as first_year,
      MAX(substr(match_date, 1, 4)) as last_year,
      COUNT(DISTINCT match_id) as total_matches
    FROM (
      SELECT match_home_team as team_name, match_date, match_id FROM AFL_data
      UNION
      SELECT match_away_team as team_name, match_date, match_id FROM AFL_data
    )
    WHERE team_name IS NOT NULL AND team_name != ''
    GROUP BY team_name
    ORDER BY team_name
  `).all();
  
  res.json(teams);
});

// Endpoint: get team stats and summary
app.get('/teams/:teamName', (req, res) => {
  const { teamName } = req.params;
  
  // Get basic team stats - count actual matches, not player rows
  const teamStats = db.prepare(`
    SELECT 
      COUNT(DISTINCT match_id) as total_matches,
      SUM(CASE WHEN match_winner = ? THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN match_winner != ? AND match_winner IS NOT NULL THEN 1 ELSE 0 END) as losses,
      MAX(CASE WHEN match_home_team = ? THEN CAST(match_home_team_score AS INTEGER) ELSE CAST(match_away_team_score AS INTEGER) END) as highest_score,
      MIN(CASE WHEN match_home_team = ? THEN CAST(match_home_team_score AS INTEGER) ELSE CAST(match_away_team_score AS INTEGER) END) as lowest_score,
      MAX(CAST(match_margin AS INTEGER)) as biggest_win_margin,
      MIN(CAST(match_margin AS INTEGER)) as biggest_loss_margin
    FROM (
      SELECT DISTINCT match_id, match_home_team, match_away_team, match_winner, 
             match_home_team_score, match_away_team_score, match_margin
      FROM AFL_data 
      WHERE match_home_team = ? OR match_away_team = ?
    )
  `).get(teamName, teamName, teamName, teamName, teamName, teamName);

  // Get top 10 disposal getters for this team
  const topDisposals = db.prepare(`
    SELECT 
      player_first_name,
      player_last_name,
      SUM(CAST(disposals AS INTEGER)) as total_disposals,
      COUNT(DISTINCT match_id) as games_played,
      AVG(CAST(disposals AS INTEGER)) as avg_disposals
    FROM AFL_data 
    WHERE player_team = ? 
      AND disposals IS NOT NULL 
      AND disposals != ''
    GROUP BY player_id, player_first_name, player_last_name
    ORDER BY total_disposals DESC 
    LIMIT 10
  `).all(teamName);

  // Get top 10 goal kickers for this team
  const topGoals = db.prepare(`
    SELECT 
      player_first_name,
      player_last_name,
      SUM(CAST(goals AS INTEGER)) as total_goals,
      COUNT(DISTINCT match_id) as games_played,
      AVG(CAST(goals AS INTEGER)) as avg_goals
    FROM AFL_data 
    WHERE player_team = ? 
      AND goals IS NOT NULL 
      AND goals != ''
    GROUP BY player_id, player_first_name, player_last_name
    ORDER BY total_goals DESC 
    LIMIT 10
  `).all(teamName);

  // Get grand finals wins (counting Grand Final matches where team won)
  const grandFinals = db.prepare(`
    SELECT COUNT(DISTINCT match_id) as grand_finals_won
    FROM (
      SELECT DISTINCT match_id, match_winner, match_round
      FROM AFL_data 
      WHERE (match_home_team = ? OR match_away_team = ?)
        AND (match_round = 'GF' OR match_round = 'Grand Final')
        AND match_winner = ?
    )
  `).get(teamName, teamName, teamName);

  // Get all games for this team (for year filtering)
  const allGames = db.prepare(`
    SELECT DISTINCT match_id, match_home_team, match_away_team, match_winner, 
           match_home_team_score, match_away_team_score, match_margin, 
           match_date, match_round, venue_name
    FROM AFL_data 
    WHERE match_home_team = ? OR match_away_team = ?
    ORDER BY match_date DESC
  `).all(teamName, teamName);

  res.json({
    team: teamName,
    stats: teamStats,
    topDisposals: topDisposals,
    topGoals: topGoals,
    grandFinals: grandFinals,
    allGames: allGames
  });
});

// Endpoint: get alphabet letters with player counts
app.get('/players/alphabet', (_, res) => {
  const letters = db.prepare(`
    SELECT 
      UPPER(SUBSTR(player_last_name, 1, 1)) as letter,
      COUNT(DISTINCT player_id) as player_count
    FROM AFL_data
    WHERE player_id IS NOT NULL AND player_id != ''
      AND player_first_name IS NOT NULL AND player_first_name != ''
      AND player_last_name IS NOT NULL AND player_last_name != ''
    GROUP BY letter
    HAVING letter GLOB '[A-Z]'
    ORDER BY letter
  `).all();
  
  res.json(letters);
});

// Endpoint: get players by letter
app.get('/players', (req, res) => {
  const { letter } = req.query;
  
  if (!letter) {
    return res.status(400).json({ error: 'Letter parameter required' });
  }
  
  const players = db.prepare(`
    SELECT 
      player_id,
      player_first_name,
      player_last_name,
      COUNT(DISTINCT match_id) as total_games,
      SUM(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE 0 END) as total_disposals,
      SUM(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE 0 END) as total_goals,
      CASE 
        WHEN SUM(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN 1 ELSE 0 END) > 0 
        THEN AVG(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE NULL END)
        ELSE NULL 
      END as avg_disposals,
      CASE 
        WHEN SUM(CASE WHEN goals IS NOT NULL AND goals != '' THEN 1 ELSE 0 END) > 0 
        THEN AVG(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE NULL END)
        ELSE NULL 
      END as avg_goals,
      MIN(substr(match_date, 1, 4)) as first_year,
      MAX(substr(match_date, 1, 4)) as last_year
    FROM AFL_data
    WHERE player_id IS NOT NULL AND player_id != ''
      AND player_first_name IS NOT NULL AND player_first_name != ''
      AND player_last_name IS NOT NULL AND player_last_name != ''
      AND UPPER(SUBSTR(player_last_name, 1, 1)) = UPPER(?)
    GROUP BY player_id, player_first_name, player_last_name
    HAVING total_games > 0
    ORDER BY player_last_name, player_first_name
  `).all(letter);
  
  res.json(players);
});

// Endpoint: get individual player stats and summary
app.get('/players/:playerId', (req, res) => {
  const { playerId } = req.params;
  
  // Get player career stats
  const playerStats = db.prepare(`
    SELECT 
      player_first_name,
      player_last_name,
      COUNT(DISTINCT match_id) as total_games,
      SUM(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE 0 END) as total_disposals,
      SUM(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE 0 END) as total_goals,
      SUM(CASE WHEN kicks IS NOT NULL AND kicks != '' THEN CAST(kicks AS INTEGER) ELSE 0 END) as total_kicks,
      SUM(CASE WHEN handballs IS NOT NULL AND handballs != '' THEN CAST(handballs AS INTEGER) ELSE 0 END) as total_handballs,
      SUM(CASE WHEN marks IS NOT NULL AND marks != '' THEN CAST(marks AS INTEGER) ELSE 0 END) as total_marks,
      SUM(CASE WHEN tackles IS NOT NULL AND tackles != '' THEN CAST(tackles AS INTEGER) ELSE 0 END) as total_tackles,
      CASE 
        WHEN SUM(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN 1 ELSE 0 END) > 0 
        THEN AVG(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE NULL END)
        ELSE NULL 
      END as avg_disposals,
      CASE 
        WHEN SUM(CASE WHEN goals IS NOT NULL AND goals != '' THEN 1 ELSE 0 END) > 0 
        THEN AVG(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE NULL END)
        ELSE NULL 
      END as avg_goals,
      CASE 
        WHEN SUM(CASE WHEN kicks IS NOT NULL AND kicks != '' THEN 1 ELSE 0 END) > 0 
        THEN AVG(CASE WHEN kicks IS NOT NULL AND kicks != '' THEN CAST(kicks AS INTEGER) ELSE NULL END)
        ELSE NULL 
      END as avg_kicks,
      CASE 
        WHEN SUM(CASE WHEN handballs IS NOT NULL AND handballs != '' THEN 1 ELSE 0 END) > 0 
        THEN AVG(CASE WHEN handballs IS NOT NULL AND handballs != '' THEN CAST(handballs AS INTEGER) ELSE NULL END)
        ELSE NULL 
      END as avg_handballs,
      CASE 
        WHEN SUM(CASE WHEN marks IS NOT NULL AND marks != '' THEN 1 ELSE 0 END) > 0 
        THEN AVG(CASE WHEN marks IS NOT NULL AND marks != '' THEN CAST(marks AS INTEGER) ELSE NULL END)
        ELSE NULL 
      END as avg_marks,
      CASE 
        WHEN SUM(CASE WHEN tackles IS NOT NULL AND tackles != '' THEN 1 ELSE 0 END) > 0 
        THEN AVG(CASE WHEN tackles IS NOT NULL AND tackles != '' THEN CAST(tackles AS INTEGER) ELSE NULL END)
        ELSE NULL 
      END as avg_tackles,
      MIN(substr(match_date, 1, 4)) as first_year,
      MAX(substr(match_date, 1, 4)) as last_year,
      MAX(CASE WHEN disposals IS NOT NULL AND disposals != '' THEN CAST(disposals AS INTEGER) ELSE NULL END) as best_disposals_game,
      MAX(CASE WHEN goals IS NOT NULL AND goals != '' THEN CAST(goals AS INTEGER) ELSE NULL END) as best_goals_game,
      MAX(CASE WHEN kicks IS NOT NULL AND kicks != '' THEN CAST(kicks AS INTEGER) ELSE NULL END) as best_kicks_game,
      MAX(CASE WHEN handballs IS NOT NULL AND handballs != '' THEN CAST(handballs AS INTEGER) ELSE NULL END) as best_handballs_game,
      MAX(CASE WHEN marks IS NOT NULL AND marks != '' THEN CAST(marks AS INTEGER) ELSE NULL END) as best_marks_game,
      MAX(CASE WHEN tackles IS NOT NULL AND tackles != '' THEN CAST(tackles AS INTEGER) ELSE NULL END) as best_tackles_game
    FROM AFL_data 
    WHERE player_id = ?
    GROUP BY player_id, player_first_name, player_last_name
  `).get(playerId);

  // Get team and guernsey combinations for this player
  const teamGuernseys = db.prepare(`
    SELECT DISTINCT 
      player_team,
      guernsey_number,
      MIN(match_date) as first_game,
      MAX(match_date) as last_game,
      COUNT(DISTINCT match_id) as games_with_number
    FROM AFL_data 
    WHERE player_id = ?
      AND player_team IS NOT NULL 
      AND guernsey_number IS NOT NULL
      AND player_team != ''
      AND guernsey_number != ''
    GROUP BY player_team, guernsey_number
    ORDER BY first_game
  `).all(playerId);

  // Get all games with all available stats
  const allGames = db.prepare(`
    SELECT 
      match_id, match_date, match_round, venue_name,
      match_home_team, match_away_team, player_team,
      disposals, goals, kicks, handballs, marks, tackles, behinds,
      hitouts, free_kicks_for, free_kicks_against, 
      afl_fantasy_score, supercoach_score,
      pressure_acts, ground_ball_gets, contested_possessions, 
      uncontested_possessions, inside_fifties, clearances,
      intercepts, rebounds, one_percenters, contested_marks,
      score_involvements, goal_assists, metres_gained,
      effective_disposals, clangers, turnovers
    FROM AFL_data 
    WHERE player_id = ?
    ORDER BY match_date DESC
  `).all(playerId);

  res.json({
    player: playerStats,
    teamGuernseys: teamGuernseys,
    allGames: allGames
  });
});

// Endpoint: get trophy room - comprehensive top 10 for each stat category
app.get('/hall-of-records', (_, res) => {
  try {
    // Comprehensive stat categories with all available AFL statistics
    const statCategories = {
      'Scoring': {
        icon: '⚽',
        color: 'red',
        stats: [
          { name: 'Goals', column: 'goals', icon: '⚽' },
          { name: 'Behinds', column: 'behinds', icon: '🎯' },
          { name: 'Goal Assists', column: 'goal_assists', icon: '🤝' },
          { name: 'Score Involvements', column: 'score_involvements', icon: '🎭' },
          { name: 'Score Launches', column: 'score_launches', icon: '🚀' },
          { name: 'Shots at Goal', column: 'shots_at_goal', icon: '🏹' },
          { name: 'Marks Inside 50', column: 'marks_inside_fifty', icon: '🎯' }
        ]
      },
      'Possession': {
        icon: '🏐',
        color: 'blue',
        stats: [
          { name: 'Disposals', column: 'disposals', icon: '🎯' },
          { name: 'Kicks', column: 'kicks', icon: '🦵' },
          { name: 'Handballs', column: 'handballs', icon: '✋' },
          { name: 'Effective Disposals', column: 'effective_disposals', icon: '🎪' },
          { name: 'Contested Possessions', column: 'contested_possessions', icon: '⚔️' },
          { name: 'Uncontested Possessions', column: 'uncontested_possessions', icon: '🎾' },
          { name: 'Ground Ball Gets', column: 'ground_ball_gets', icon: '⚾' },
          { name: 'Metres Gained', column: 'metres_gained', icon: '📏' },
          { name: 'Bounces', column: 'bounces', icon: '⚡' }
        ]
      },
      'Defence': {
        icon: '🛡️',
        color: 'purple',
        stats: [
          { name: 'Tackles', column: 'tackles', icon: '💪' },
          { name: 'Intercepts', column: 'intercepts', icon: '🛡️' },
          { name: 'Rebounds', column: 'rebounds', icon: '↩️' },
          { name: 'One Percenters', column: 'one_percenters', icon: '💯' },
          { name: 'Spoils', column: 'spoils', icon: '❌' },
          { name: 'Pressure Acts', column: 'pressure_acts', icon: '⚡' },
          { name: 'Intercept Marks', column: 'intercept_marks', icon: '🚫' },
          { name: 'Defensive Half Pressure Acts', column: 'def_half_pressure_acts', icon: '🏠' },
          { name: 'Tackles Inside 50', column: 'tackles_inside_fifty', icon: '🎯' }
        ]
      },
      'Contest Work': {
        icon: '⚔️',
        color: 'orange',
        stats: [
          { name: 'Clearances', column: 'clearances', icon: '🚀' },
          { name: 'Centre Clearances', column: 'centre_clearances', icon: '🎯' },
          { name: 'Stoppage Clearances', column: 'stoppage_clearances', icon: '⏸️' },
          { name: 'Contested Marks', column: 'contested_marks', icon: '🥊' },
          { name: 'Marks', column: 'marks', icon: '🙌' },
          { name: 'Marks on Lead', column: 'marks_on_lead', icon: '🏃' }
        ]
      },
      'Forward Play': {
        icon: '🏈',
        color: 'green',
        stats: [
          { name: 'Inside 50s', column: 'inside_fifties', icon: '🎯' },
          { name: 'Forward 50 Ground Ball Gets', column: 'f50_ground_ball_gets', icon: '⚾' }
        ]
      },
      'Ruck Work': {
        icon: '🏀',
        color: 'indigo',
        stats: [
          { name: 'Hitouts', column: 'hitouts', icon: '🏀' },
          { name: 'Hitouts to Advantage', column: 'hitouts_to_advantage', icon: '✅' },
          { name: 'Ruck Contests', column: 'ruck_contests', icon: '🤜' }
        ]
      },
      'Game Management': {
        icon: '🧠',
        color: 'teal',
        stats: [
          { name: 'Free Kicks For', column: 'free_kicks_for', icon: '✅' },
          { name: 'Free Kicks Against', column: 'free_kicks_against', icon: '❌' },
          { name: 'Clangers', column: 'clangers', icon: '💥' },
          { name: 'Turnovers', column: 'turnovers', icon: '🔄' }
        ]
      },
      'Fantasy & Ratings': {
        icon: '🏆',
        color: 'violet',
        stats: [
          { name: 'AFL Fantasy Score', column: 'afl_fantasy_score', icon: '🏆' },
          { name: 'SuperCoach Score', column: 'supercoach_score', icon: '👑' },
          { name: 'Rating Points', column: 'rating_points', icon: '⭐' },
          { name: 'Brownlow Votes', column: 'brownlow_votes', icon: '🏅' }
        ]
      }
    };

    const hallOfRecords = {};

    // Process each category
    Object.entries(statCategories).forEach(([categoryName, categoryData]) => {
      hallOfRecords[categoryName] = {
        ...categoryData,
        records: {}
      };

      // Process each stat in the category
      categoryData.stats.forEach(stat => {
        try {
          // Get top 10 career totals for this stat
          const top10 = db.prepare(`
            SELECT 
              player_first_name,
              player_last_name,
              player_id,
              SUM(CAST(${stat.column} AS INTEGER)) as stat_value,
              COUNT(DISTINCT match_id) as games_played,
              AVG(CAST(${stat.column} AS INTEGER)) as avg_per_game,
              MIN(substr(match_date, 1, 4)) as first_year,
              MAX(substr(match_date, 1, 4)) as last_year
            FROM AFL_data 
            WHERE ${stat.column} IS NOT NULL 
              AND ${stat.column} != ''
              AND CAST(${stat.column} AS INTEGER) > 0
            GROUP BY player_id, player_first_name, player_last_name
            ORDER BY stat_value DESC 
            LIMIT 10
          `).all();

          // Get team/guernsey info for each player
          const enrichedTop10 = top10.map(player => {
            const teamGuernseys = db.prepare(`
              SELECT DISTINCT 
                player_team,
                guernsey_number,
                MIN(match_date) as first_game,
                COUNT(DISTINCT match_id) as games_with_number
              FROM AFL_data 
              WHERE player_id = ?
                AND player_team IS NOT NULL 
                AND guernsey_number IS NOT NULL
                AND player_team != ''
                AND guernsey_number != ''
              GROUP BY player_team, guernsey_number
              ORDER BY first_game
            `).all(player.player_id);
            
            return {
              ...player,
              teamGuernseys: teamGuernseys
            };
          });

          if (enrichedTop10.length > 0) {
            hallOfRecords[categoryName].records[stat.name] = {
              ...stat,
              top10: enrichedTop10
            };
          }
        } catch (statError) {
          console.error(`Error processing stat ${stat.name}:`, statError);
        }
      });
    });

    res.json(hallOfRecords);
  } catch (error) {
    console.error('Hall of Records error:', error);
    res.status(500).json({ error: 'Failed to load Hall of Records' });
  }
});

// Keep the old endpoint for backward compatibility
app.get('/trophy-room', (_, res) => {
  try {
    // Simplified version - just return a few key stats
    const keyStats = [
      { name: 'Total Goals', column: 'goals', icon: '⚽', category: 'Scoring' },
      { name: 'Total Disposals', column: 'disposals', icon: '🎯', category: 'Possession' },
      { name: 'Total Tackles', column: 'tackles', icon: '💪', category: 'Defence' }
    ];

    const trophyHolders = [];

    keyStats.forEach(stat => {
      try {
        const result = db.prepare(`
          SELECT 
            player_first_name,
            player_last_name,
            player_id,
            SUM(CAST(${stat.column} AS INTEGER)) as stat_value,
            COUNT(DISTINCT match_id) as games_played,
            AVG(CAST(${stat.column} AS INTEGER)) as avg_per_game
          FROM AFL_data 
          WHERE ${stat.column} IS NOT NULL 
            AND ${stat.column} != ''
            AND CAST(${stat.column} AS INTEGER) > 0
          GROUP BY player_id, player_first_name, player_last_name
          ORDER BY stat_value DESC 
          LIMIT 1
        `).get();
        
        if (result) {
          const teamGuernseys = db.prepare(`
            SELECT DISTINCT 
              player_team,
              guernsey_number,
              MIN(match_date) as first_game,
              COUNT(DISTINCT match_id) as games_with_number
            FROM AFL_data 
            WHERE player_id = ?
              AND player_team IS NOT NULL 
              AND guernsey_number IS NOT NULL
              AND player_team != ''
              AND guernsey_number != ''
            GROUP BY player_team, guernsey_number
            ORDER BY first_game
          `).all(result.player_id);
          
          result.teamGuernseys = teamGuernseys;
          
          trophyHolders.push({
            ...stat,
            player: result
          });
        }
      } catch (statError) {
        console.error(`Error processing stat ${stat.name}:`, statError);
      }
    });

    res.json(trophyHolders);
  } catch (error) {
    console.error('Trophy room error:', error);
    res.status(500).json({ error: 'Failed to load trophy room' });
  }
});

// Endpoint: get upcoming games from Squiggle API with enhanced data
app.get('/upcoming-games', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    console.log(`Fetching games for year: ${currentYear}`);
    
    const response = await fetch(`https://api.squiggle.com.au/?q=games;year=${currentYear};complete=0`, {
      headers: {
        'User-Agent': 'AFL-Stats-Server/1.0 (server@example.com)'
      }
    });
    
    if (!response.ok) {
      console.error(`Squiggle API error: ${response.status} ${response.statusText}`);
      res.json([]);
      return;
    }
    
    const data = await response.json();
    console.log(`Squiggle response:`, { 
      hasGames: !!data.games, 
      gameCount: data.games?.length || 0,
      sampleGame: data.games?.[0] 
    });
    
    // If no games available (e.g., season hasn't started), provide demo data for testing
    if (!data.games || data.games.length === 0) {
      // Create some sample upcoming games for demonstration
      const demoGames = [
        {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
          hteam: 'Adelaide',
          ateam: 'Richmond', 
          venue: 'Adelaide Oval',
          round: 1
        },
        {
          date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
          hteam: 'Collingwood',
          ateam: 'Carlton',
          venue: 'MCG',
          round: 1
        }
      ];
      
      // Enhance demo games with data
      const enhancedDemoGames = demoGames.map(game => {
        const homeTeam = game.hteam;
        const awayTeam = game.ateam;
        
        // Get last 5 meetings between these teams
        const headToHead = db.prepare(`
          SELECT DISTINCT 
            match_date,
            match_home_team,
            match_away_team,
            match_winner,
            CAST(match_home_team_score AS INTEGER) as home_score,
            CAST(match_away_team_score AS INTEGER) as away_score,
            CAST(match_margin AS INTEGER) as margin,
            venue_name
          FROM AFL_data
          WHERE (match_home_team = ? AND match_away_team = ?) 
             OR (match_home_team = ? AND match_away_team = ?)
          ORDER BY match_date DESC
          LIMIT 5
        `).all(homeTeam, awayTeam, awayTeam, homeTeam);
        
        // Get current form (last 5 games for each team)
        const homeForm = db.prepare(`
          SELECT DISTINCT 
            match_date,
            match_winner,
            CASE WHEN match_home_team = ? THEN match_home_team_score ELSE match_away_team_score END as team_score,
            CASE WHEN match_home_team = ? THEN match_away_team_score ELSE match_home_team_score END as opponent_score
          FROM AFL_data
          WHERE match_home_team = ? OR match_away_team = ?
          ORDER BY match_date DESC
          LIMIT 5
        `).all(homeTeam, homeTeam, homeTeam, homeTeam);
        
        const awayForm = db.prepare(`
          SELECT DISTINCT 
            match_date,
            match_winner,
            CASE WHEN match_home_team = ? THEN match_home_team_score ELSE match_away_team_score END as team_score,
            CASE WHEN match_home_team = ? THEN match_away_team_score ELSE match_home_team_score END as opponent_score
          FROM AFL_data
          WHERE match_home_team = ? OR match_away_team = ?
          ORDER BY match_date DESC
          LIMIT 5
        `).all(awayTeam, awayTeam, awayTeam, awayTeam);
        
        return {
          ...game,
          headToHead,
          homeForm,
          awayForm,
          isDemo: true
        };
      });
      
      res.json(enhancedDemoGames);
      return;
    }
    
    if (data.games && data.games.length > 0) {
      // Filter for future games only
      const now = new Date();
      const upcomingGames = data.games
        .filter(game => new Date(game.date) > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5); // Get next 5 games
      
      // Enhance each game with head-to-head data
      const enhancedGames = upcomingGames.map(game => {
        const homeTeam = game.hteam;
        const awayTeam = game.ateam;
        
        // Get last 5 meetings between these teams
        const headToHead = db.prepare(`
          SELECT DISTINCT 
            match_date,
            match_home_team,
            match_away_team,
            match_winner,
            CAST(match_home_team_score AS INTEGER) as home_score,
            CAST(match_away_team_score AS INTEGER) as away_score,
            CAST(match_margin AS INTEGER) as margin,
            venue_name
          FROM AFL_data
          WHERE (match_home_team = ? AND match_away_team = ?) 
             OR (match_home_team = ? AND match_away_team = ?)
          ORDER BY match_date DESC
          LIMIT 5
        `).all(homeTeam, awayTeam, awayTeam, homeTeam);
        
        // Get current form (last 5 games for each team)
        const homeForm = db.prepare(`
          SELECT DISTINCT 
            match_date,
            match_winner,
            CASE WHEN match_home_team = ? THEN match_home_team_score ELSE match_away_team_score END as team_score,
            CASE WHEN match_home_team = ? THEN match_away_team_score ELSE match_home_team_score END as opponent_score
          FROM AFL_data
          WHERE match_home_team = ? OR match_away_team = ?
          ORDER BY match_date DESC
          LIMIT 5
        `).all(homeTeam, homeTeam, homeTeam, homeTeam);
        
        const awayForm = db.prepare(`
          SELECT DISTINCT 
            match_date,
            match_winner,
            CASE WHEN match_home_team = ? THEN match_home_team_score ELSE match_away_team_score END as team_score,
            CASE WHEN match_home_team = ? THEN match_away_team_score ELSE match_home_team_score END as opponent_score
          FROM AFL_data
          WHERE match_home_team = ? OR match_away_team = ?
          ORDER BY match_date DESC
          LIMIT 5
        `).all(awayTeam, awayTeam, awayTeam, awayTeam);
        
        return {
          ...game,
          headToHead,
          homeForm,
          awayForm
        };
      });
      
      res.json(enhancedGames);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching upcoming games:', error);
    res.json([]); // Return empty array on error
  }
});

// Endpoint: get top performers for a specific team
app.get('/top-performers/:teamName', (req, res) => {
  try {
    const { teamName } = req.params;
    
    // Get the most recent year we have data for
    const latestYear = db.prepare(`
      SELECT MAX(substr(match_date, 1, 4)) as year
      FROM AFL_data
      WHERE substr(match_date, 1, 4) GLOB '[1-2][0-9][0-9][0-9]'
    `).get();
    
    const currentYear = latestYear ? latestYear.year : new Date().getFullYear();
    
    // Get top 5 goal kickers for this team this season
    const topGoals = db.prepare(`
      SELECT 
        player_first_name,
        player_last_name,
        SUM(CAST(goals AS INTEGER)) as total_goals,
        COUNT(DISTINCT match_id) as games_played,
        AVG(CAST(goals AS INTEGER)) as avg_goals
      FROM AFL_data 
      WHERE player_team = ? 
        AND strftime('%Y', match_date) = ?
        AND goals IS NOT NULL 
        AND goals != ''
        AND CAST(goals AS INTEGER) > 0
      GROUP BY player_id, player_first_name, player_last_name
      ORDER BY total_goals DESC 
      LIMIT 5
    `).all(teamName, currentYear.toString());

    // Get top 5 disposal getters for this team this season
    const topDisposals = db.prepare(`
      SELECT 
        player_first_name,
        player_last_name,
        SUM(CAST(disposals AS INTEGER)) as total_disposals,
        COUNT(DISTINCT match_id) as games_played,
        AVG(CAST(disposals AS INTEGER)) as avg_disposals
      FROM AFL_data 
      WHERE player_team = ? 
        AND strftime('%Y', match_date) = ?
        AND disposals IS NOT NULL 
        AND disposals != ''
        AND CAST(disposals AS INTEGER) > 0
      GROUP BY player_id, player_first_name, player_last_name
      ORDER BY total_disposals DESC 
      LIMIT 5
    `).all(teamName, currentYear.toString());

    // Get team's recent form (last 5 games)
    const recentForm = db.prepare(`
      SELECT DISTINCT 
        match_date,
        match_home_team,
        match_away_team,
        match_winner,
        CAST(match_home_team_score AS INTEGER) as home_score,
        CAST(match_away_team_score AS INTEGER) as away_score,
        CAST(match_margin AS INTEGER) as margin,
        venue_name,
        CASE WHEN match_home_team = ? THEN 'Home' ELSE 'Away' END as home_away,
        CASE WHEN match_winner = ? THEN 'W' ELSE 'L' END as result
      FROM AFL_data
      WHERE (match_home_team = ? OR match_away_team = ?)
        AND strftime('%Y', match_date) = ?
      ORDER BY match_date DESC
      LIMIT 5
    `).all(teamName, teamName, teamName, teamName, currentYear.toString());

    // Get biggest win and loss margins this season
    const biggestWin = db.prepare(`
      SELECT DISTINCT 
        match_date,
        match_home_team,
        match_away_team,
        CAST(match_margin AS INTEGER) as margin,
        venue_name
      FROM AFL_data
      WHERE match_winner = ?
        AND strftime('%Y', match_date) = ?
      ORDER BY CAST(match_margin AS INTEGER) DESC
      LIMIT 1
    `).get(teamName, currentYear.toString());

    const biggestLoss = db.prepare(`
      SELECT DISTINCT 
        match_date,
        match_home_team,
        match_away_team,
        CAST(match_margin AS INTEGER) as margin,
        venue_name
      FROM AFL_data
      WHERE (match_home_team = ? OR match_away_team = ?)
        AND match_winner != ?
        AND strftime('%Y', match_date) = ?
      ORDER BY CAST(match_margin AS INTEGER) DESC
      LIMIT 1
    `).get(teamName, teamName, teamName, currentYear.toString());

    res.json({
      team: teamName,
      season: currentYear,
      topGoals,
      topDisposals,
      recentForm,
      biggestWin,
      biggestLoss
    });
  } catch (error) {
    console.error('Error getting top performers:', error);
    res.status(500).json({ error: 'Failed to get top performers' });
  }
});

// Endpoint: get head-to-head analysis between two specific teams
app.get('/head-to-head/:team1/:team2', (req, res) => {
  try {
    const { team1, team2 } = req.params;
    
    // Get the most recent year we have data for
    const latestYear = db.prepare(`
      SELECT MAX(substr(match_date, 1, 4)) as year
      FROM AFL_data
      WHERE substr(match_date, 1, 4) GLOB '[1-2][0-9][0-9][0-9]'
    `).get();
    
    const currentYear = latestYear ? latestYear.year : new Date().getFullYear();

    // Get last 10 meetings between these teams
    const headToHeadHistory = db.prepare(`
      SELECT DISTINCT 
        match_date,
        match_home_team,
        match_away_team,
        match_winner,
        CAST(match_home_team_score AS INTEGER) as home_score,
        CAST(match_away_team_score AS INTEGER) as away_score,
        CAST(match_margin AS INTEGER) as margin,
        venue_name,
        match_round
      FROM AFL_data
      WHERE (match_home_team = ? AND match_away_team = ?) 
         OR (match_home_team = ? AND match_away_team = ?)
      ORDER BY match_date DESC
      LIMIT 10
    `).all(team1, team2, team2, team1);

    // Get the most recent meeting details
    const lastMeeting = headToHeadHistory[0];
    
    // Get top performers from the last meeting
    let lastMeetingPerformers = null;
    if (lastMeeting) {
      const lastMeetingId = db.prepare(`
        SELECT DISTINCT match_id 
        FROM AFL_data 
        WHERE match_date = ? 
          AND ((match_home_team = ? AND match_away_team = ?) OR (match_home_team = ? AND match_away_team = ?))
        LIMIT 1
      `).get(lastMeeting.match_date, lastMeeting.match_home_team, lastMeeting.match_away_team, lastMeeting.match_away_team, lastMeeting.match_home_team);

      if (lastMeetingId) {
        // Get top performers from that specific game
        const topGoalsLastMeeting = db.prepare(`
          SELECT 
            player_first_name,
            player_last_name,
            player_team,
            CAST(goals AS INTEGER) as goals,
            CAST(disposals AS INTEGER) as disposals
          FROM AFL_data 
          WHERE match_id = ?
            AND goals IS NOT NULL 
            AND goals != ''
            AND CAST(goals AS INTEGER) > 0
          ORDER BY CAST(goals AS INTEGER) DESC 
          LIMIT 5
        `).all(lastMeetingId.match_id);

        const topDisposalsLastMeeting = db.prepare(`
          SELECT 
            player_first_name,
            player_last_name,
            player_team,
            CAST(disposals AS INTEGER) as disposals,
            CAST(goals AS INTEGER) as goals
          FROM AFL_data 
          WHERE match_id = ?
            AND disposals IS NOT NULL 
            AND disposals != ''
            AND CAST(disposals AS INTEGER) > 0
          ORDER BY CAST(disposals AS INTEGER) DESC 
          LIMIT 5
        `).all(lastMeetingId.match_id);

        lastMeetingPerformers = {
          topGoals: topGoalsLastMeeting,
          topDisposals: topDisposalsLastMeeting
        };
      }
    }

    // Get head-to-head record summary
    const team1Wins = headToHeadHistory.filter(game => game.match_winner === team1).length;
    const team2Wins = headToHeadHistory.filter(game => game.match_winner === team2).length;

    // Get biggest wins for each team against the other
    const team1BiggestWin = db.prepare(`
      SELECT DISTINCT 
        match_date,
        match_home_team,
        match_away_team,
        CAST(match_margin AS INTEGER) as margin,
        venue_name,
        match_round
      FROM AFL_data
      WHERE match_winner = ?
        AND ((match_home_team = ? AND match_away_team = ?) OR (match_home_team = ? AND match_away_team = ?))
      ORDER BY CAST(match_margin AS INTEGER) DESC
      LIMIT 1
    `).get(team1, team1, team2, team2, team1);

    const team2BiggestWin = db.prepare(`
      SELECT DISTINCT 
        match_date,
        match_home_team,
        match_away_team,
        CAST(match_margin AS INTEGER) as margin,
        venue_name,
        match_round
      FROM AFL_data
      WHERE match_winner = ?
        AND ((match_home_team = ? AND match_away_team = ?) OR (match_home_team = ? AND match_away_team = ?))
      ORDER BY CAST(match_margin AS INTEGER) DESC
      LIMIT 1
    `).get(team2, team1, team2, team2, team1);

    res.json({
      team1,
      team2,
      headToHeadHistory,
      lastMeeting,
      lastMeetingPerformers,
      summary: {
        [team1]: team1Wins,
        [team2]: team2Wins,
        totalGames: headToHeadHistory.length
      },
      biggestWins: {
        [team1]: team1BiggestWin,
        [team2]: team2BiggestWin
      }
    });
  } catch (error) {
    console.error('Error getting head-to-head analysis:', error);
    res.status(500).json({ error: 'Failed to get head-to-head analysis' });
  }
});

// Endpoint: get interesting insights from historical data
app.get('/insights', (_, res) => {
  try {
    const insights = [];

    // Most recent game result
    const recentGame = db.prepare(`
      SELECT DISTINCT 
        match_home_team,
        match_away_team,
        CAST(match_home_team_score AS INTEGER) as match_home_team_score,
        CAST(match_away_team_score AS INTEGER) as match_away_team_score,
        match_winner,
        CAST(match_margin AS INTEGER) as match_margin,
        match_date,
        venue_name
      FROM AFL_data
      WHERE match_winner IS NOT NULL 
        AND match_margin IS NOT NULL
        AND match_margin != ''
      ORDER BY match_date DESC
      LIMIT 1
    `).get();

    if (recentGame) {
      console.log('Recent game data:', recentGame);
      const loser = recentGame.match_winner === recentGame.match_home_team ? recentGame.match_away_team : recentGame.match_home_team;
      insights.push({
        type: 'recent_game',
        title: 'Most Recent Game',
        description: `${recentGame.match_winner} defeated ${loser} by ${Math.abs(recentGame.match_margin)} points`,
        details: `${recentGame.match_home_team} ${recentGame.match_home_team_score} - ${recentGame.match_away_team_score} ${recentGame.match_away_team}`,
        icon: '🏈'
      });
    }

    // Top 5 disposal getters this season
    const currentYear = new Date().getFullYear();
    const topDisposals = db.prepare(`
      SELECT 
        player_first_name,
        player_last_name,
        player_team,
        SUM(CAST(disposals AS INTEGER)) as total_disposals,
        COUNT(DISTINCT match_id) as games
      FROM AFL_data
      WHERE strftime('%Y', match_date) = ?
        AND disposals IS NOT NULL 
        AND disposals != ''
        AND CAST(disposals AS INTEGER) > 0
      GROUP BY player_id, player_first_name, player_last_name, player_team
      ORDER BY total_disposals DESC
      LIMIT 5
    `).all(currentYear.toString());

    if (topDisposals.length > 0) {
      insights.push({
        type: 'top_disposals',
        title: `${currentYear} Top Disposal Getters`,
        description: `${topDisposals[0].player_first_name} ${topDisposals[0].player_last_name} leads with ${topDisposals[0].total_disposals} disposals`,
        details: topDisposals.map((p, i) => `${i+1}. ${p.player_first_name} ${p.player_last_name} (${p.total_disposals})`).join(', '),
        icon: '🎯'
      });
    }

    // Top 5 goal kickers this season
    const topGoals = db.prepare(`
      SELECT 
        player_first_name,
        player_last_name,
        player_team,
        SUM(CAST(goals AS INTEGER)) as total_goals,
        COUNT(DISTINCT match_id) as games
      FROM AFL_data
      WHERE strftime('%Y', match_date) = ?
        AND goals IS NOT NULL 
        AND goals != ''
        AND CAST(goals AS INTEGER) > 0
      GROUP BY player_id, player_first_name, player_last_name, player_team
      ORDER BY total_goals DESC
      LIMIT 5
    `).all(currentYear.toString());

    if (topGoals.length > 0) {
      insights.push({
        type: 'top_goals',
        title: `${currentYear} Leading Goalkickers`,
        description: `${topGoals[0].player_first_name} ${topGoals[0].player_last_name} leads with ${topGoals[0].total_goals} goals`,
        details: topGoals.map((p, i) => `${i+1}. ${p.player_first_name} ${p.player_last_name} (${p.total_goals})`).join(', '),
        icon: '⚽'
      });
    }

    // Highest single game score this season
    const highestScore = db.prepare(`
      SELECT DISTINCT
        match_home_team,
        match_away_team,
        CAST(match_home_team_score AS INTEGER) as match_home_team_score,
        CAST(match_away_team_score AS INTEGER) as match_away_team_score,
        match_date,
        venue_name,
        CASE 
          WHEN CAST(match_home_team_score AS INTEGER) > CAST(match_away_team_score AS INTEGER) THEN CAST(match_home_team_score AS INTEGER)
          ELSE CAST(match_away_team_score AS INTEGER)
        END as highest_score,
        CASE 
          WHEN CAST(match_home_team_score AS INTEGER) > CAST(match_away_team_score AS INTEGER) THEN match_home_team
          ELSE match_away_team
        END as high_scoring_team
      FROM AFL_data
      WHERE strftime('%Y', match_date) = ?
        AND match_home_team_score IS NOT NULL
        AND match_away_team_score IS NOT NULL
        AND match_home_team_score != ''
        AND match_away_team_score != ''
      ORDER BY highest_score DESC
      LIMIT 1
    `).get(currentYear.toString());

    if (highestScore) {
      insights.push({
        type: 'highest_score',
        title: `${currentYear} Highest Team Score`,
        description: `${highestScore.high_scoring_team} scored ${highestScore.highest_score} points`,
        details: `${highestScore.match_home_team} ${highestScore.match_home_team_score} - ${highestScore.match_away_team_score} ${highestScore.match_away_team}`,
        icon: '🔥'
      });
    }

    // Biggest winning margin this season
    const biggestWin = db.prepare(`
      SELECT DISTINCT
        match_home_team,
        match_away_team,
        match_winner,
        match_margin,
        match_date,
        venue_name
      FROM AFL_data
      WHERE strftime('%Y', match_date) = ?
        AND match_margin IS NOT NULL
      ORDER BY CAST(match_margin AS INTEGER) DESC
      LIMIT 1
    `).get(currentYear.toString());

    if (biggestWin) {
      const loser = biggestWin.match_winner === biggestWin.match_home_team ? biggestWin.match_away_team : biggestWin.match_home_team;
      insights.push({
        type: 'biggest_win',
        title: `${currentYear} Biggest Winning Margin`,
        description: `${biggestWin.match_winner} defeated ${loser} by ${Math.abs(biggestWin.match_margin)} points`,
        details: `Game played at ${biggestWin.venue_name} on ${biggestWin.match_date}`,
        icon: '💥'
      });
    }

    res.json(insights);
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

app.listen(3000, () => {
  console.log('✅ API running on http://localhost:3000');
});