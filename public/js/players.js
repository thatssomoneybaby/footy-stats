import { getPlayersAlphabet, getPlayers, getPlayerDetails } from './api.js';

const alphabetContainer = document.getElementById('alphabet-container');
const playersGrid = document.getElementById('players-grid');
const playerSearch = document.getElementById('player-search');
const sortPlayers = document.getElementById('sort-players');
const playerDetails = document.getElementById('player-details');
const playerName = document.getElementById('player-name');
const playerSummary = document.getElementById('player-summary');
const gamesList = document.getElementById('games-list');
const closeDetailsButton = document.getElementById('close-player-details');
const selectedLetterSpan = document.getElementById('selected-letter');

let currentLetter = null;
let allPlayers = [];
let filteredPlayers = [];
let currentPlayerGames = [];
let currentSortColumn = null;
let currentSortDirection = 'desc';

// Load alphabet on page load
async function loadAlphabet() {
  try {
    const letters = await getPlayersAlphabet();
    renderAlphabet(letters);
  } catch (error) {
    console.error('Error loading alphabet:', error);
    alphabetContainer.innerHTML = '<p class="text-red-600 text-center">Error loading player index. Please try again.</p>';
  }
}

function renderAlphabet(letters) {
  alphabetContainer.innerHTML = '';
  
  letters.forEach(letterData => {
    const letterButton = document.createElement('button');
    letterButton.className = 'px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-afl-blue hover:text-white transition-colors font-medium';
    const cnt = letterData.count ?? letterData.player_count ?? 0;
    letterButton.textContent = `${letterData.letter} (${cnt})`;
    letterButton.addEventListener('click', () => loadPlayersForLetter(letterData.letter));

    alphabetContainer.appendChild(letterButton);
  });
}

async function loadPlayersForLetter(letter) {
  currentLetter = letter;
  selectedLetterSpan.textContent = letter;
  
  // Update active button
  alphabetContainer.querySelectorAll('button').forEach(btn => {
    btn.classList.remove('bg-afl-blue', 'text-white');
    btn.classList.add('bg-white');
  });
  
  const activeButton = Array.from(alphabetContainer.querySelectorAll('button'))
    .find(btn => btn.textContent.startsWith(letter));
  if (activeButton) {
    activeButton.classList.add('bg-afl-blue', 'text-white');
    activeButton.classList.remove('bg-white');
  }
  
  try {
    playersGrid.innerHTML = '<p class="text-gray-600 col-span-full text-center">Loading players...</p>';
    allPlayers = await getPlayers(letter);
    filteredPlayers = [...allPlayers];
    renderPlayers(filteredPlayers);
  } catch (error) {
    console.error('Error loading players:', error);
    playersGrid.innerHTML = '<p class="text-red-600 col-span-full text-center">Error loading players. Please try again.</p>';
  }
}

function renderPlayers(players) {
  playersGrid.innerHTML = '';
  
  if (players.length === 0) {
    playersGrid.innerHTML = '<p class="text-gray-600 col-span-full text-center">No players found.</p>';
    return;
  }

  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';
    
    const fullName = `${player.player_first_name} ${player.player_last_name}`;
    const avgDisposals = player.avg_disposals ? parseFloat(player.avg_disposals).toFixed(1) : 'N/A';
    const avgGoals = player.avg_goals ? parseFloat(player.avg_goals).toFixed(1) : 'N/A';
    
    playerCard.innerHTML = `
      <h3 class="font-semibold text-gray-900 mb-2">${fullName}</h3>
      <div class="text-sm text-gray-600 space-y-1">
        <p><span class="font-medium">Career:</span> ${player.first_year} - ${player.last_year}</p>
        <p><span class="font-medium">Games:</span> ${player.total_games}</p>
        <p><span class="font-medium">Total Disposals:</span> ${player.total_disposals || 0}</p>
        <p><span class="font-medium">Avg Disposals:</span> ${avgDisposals}</p>
        <p><span class="font-medium">Total Goals:</span> ${player.total_goals || 0}</p>
        <p><span class="font-medium">Avg Goals:</span> ${avgGoals}</p>
      </div>
    `;
    
    playerCard.addEventListener('click', () => showPlayerDetails(player.player_id));
    playersGrid.appendChild(playerCard);
  });
}

async function showPlayerDetails(playerId) {
  try {
    const playerData = await getPlayerDetails(playerId);
    displayPlayerDetails(playerData);
  } catch (error) {
    console.error('Error loading player details:', error);
    alert('Error loading player details. Please try again.');
  }
}

function displayPlayerDetails(playerData) {
  const player = playerData.player;
  const teamGuernseys = playerData.teamGuernseys || [];
  const games = playerData.allGames || [];
  
  const fullName = `${player.player_first_name} ${player.player_last_name}`;
  playerName.textContent = fullName;
  
  // Find debut game (earliest game with data)
  let debutGame = null;
  if (games.length > 0) {
    debutGame = games
      .filter(game => game.match_date) // Must have a date
      .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))[0];
  }
  
  // Create team/guernsey display — prefer API teams_path if present
  let teamGuernseysDisplay = player.teams_path || '';
  if (!teamGuernseysDisplay && teamGuernseys.length > 0) {
    const groupedByTeam = {};
    teamGuernseys.forEach(entry => {
      if (!groupedByTeam[entry.player_team]) {
        groupedByTeam[entry.player_team] = [];
      }
      groupedByTeam[entry.player_team].push(entry);
    });
    
    const teamDisplays = Object.entries(groupedByTeam).map(([team, entries]) => {
      if (entries.length === 1) {
        return `${team} (#${entries[0].guernsey_number})`;
      } else {
        // Multiple numbers for this team - show chronologically
        const numbers = entries
          .sort((a, b) => new Date(a.first_game) - new Date(b.first_game))
          .map(e => e.guernsey_number)
          .join('→');
        return `${team} (#${numbers})`;
      }
    });
    
    teamGuernseysDisplay = teamDisplays.join(', ');
  }

  // Format debut information — prefer API-provided fields
  let debutInfo = 'N/A';
  if (player.debut_date) {
    const debutDate = new Date(player.debut_date).toLocaleDateString('en-AU');
    const rnd = player.debut_round_label ? ` ${player.debut_round_label}` : '';
    const opp = player.debut_opponent ? ` ${player.debut_opponent}` : '';
    const ven = player.debut_venue ? ` @ ${player.debut_venue}` : '';
    debutInfo = `${debutDate}${rnd}${opp}${ven}`.trim();
  } else if (debutGame) {
    const debutDate = new Date(debutGame.match_date).toLocaleDateString('en-AU');
    const rnd = debutGame.match_round ? ` ${debutGame.match_round}` : '';
    const opp = debutGame.opponent ? ` ${debutGame.opponent}` : '';
    const ven = debutGame.venue_name ? ` @ ${debutGame.venue_name}` : '';
    debutInfo = `${debutDate}${rnd}${opp}${ven}`;
  }

  // Calculate best single game performances from actual game data
  const bestStats = {
    disposals: Math.max(...games.map(g => parseInt(g.disposals) || 0)),
    goals: Math.max(...games.map(g => parseInt(g.goals) || 0)),
    kicks: Math.max(...games.map(g => parseInt(g.kicks) || 0)),
    handballs: Math.max(...games.map(g => parseInt(g.handballs) || 0)),
    marks: Math.max(...games.map(g => parseInt(g.marks) || 0)),
    tackles: Math.max(...games.map(g => parseInt(g.tackles) || 0))
  };

  // Handle case where no valid data exists (all zeros)
  Object.keys(bestStats).forEach(key => {
    if (bestStats[key] === 0 || bestStats[key] === -Infinity) {
      // Check if this stat exists in any game for this player
      const hasAnyData = games.some(g => g[key] !== null && g[key] !== undefined && g[key] !== '');
      bestStats[key] = hasAnyData ? 0 : null;
    }
  });

  // Career stats with better formatting - across the screen
  const avgDisposals = player.avg_disposals != null ? Number(player.avg_disposals).toFixed(1) : 'N/A';
  const avgGoals     = player.avg_goals != null ? Number(player.avg_goals).toFixed(1) : 'N/A';
  const avgKicks     = player.avg_kicks != null ? Number(player.avg_kicks).toFixed(1) : 'N/A';
  const avgHandballs = player.avg_handballs != null ? Number(player.avg_handballs).toFixed(1) : 'N/A';
  const avgMarks     = player.avg_marks != null ? Number(player.avg_marks).toFixed(1) : 'N/A';
  const avgTackles   = player.avg_tackles != null ? Number(player.avg_tackles).toFixed(1) : 'N/A';
  
  playerSummary.innerHTML = `
    <!-- Basic Info Row -->
    <div class="mb-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div class="text-center">
          <div class="font-semibold text-afl-blue text-sm">Career Span</div>
          <div class="text-lg font-bold">${player.first_year} - ${player.last_year}</div>
        </div>
        <div class="text-center">
          <div class="font-semibold text-afl-blue text-sm">Total Games</div>
          <div class="text-xl font-bold text-afl-blue">${player.total_games}</div>
        </div>
        <div class="text-center">
          <div class="font-semibold text-afl-blue text-sm">Teams</div>
          <div class="text-sm font-medium">${teamGuernseysDisplay || 'N/A'}</div>
        </div>
        <div class="text-center">
          <div class="font-semibold text-afl-blue text-sm">Debut</div>
          <div class="text-sm font-medium">${debutInfo}</div>
        </div>
      </div>
    </div>

    <!-- Career Averages Section -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Career Averages</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="text-center p-3 bg-blue-50 rounded-lg">
          <div class="font-semibold text-gray-700 text-sm">Disposals</div>
          <div class="text-xl font-bold text-blue-600">${avgDisposals}</div>
          <div class="text-xs text-gray-500">Total: ${player.total_disposals || 0}</div>
        </div>
        <div class="text-center p-3 bg-green-50 rounded-lg">
          <div class="font-semibold text-gray-700 text-sm">Goals</div>
          <div class="text-xl font-bold text-green-600">${avgGoals}</div>
          <div class="text-xs text-gray-500">Total: ${player.total_goals || 0}</div>
        </div>
        <div class="text-center p-3 bg-purple-50 rounded-lg">
          <div class="font-semibold text-gray-700 text-sm">Kicks</div>
          <div class="text-xl font-bold text-purple-600">${avgKicks}</div>
          <div class="text-xs text-gray-500">Total: ${player.total_kicks || 0}</div>
        </div>
        <div class="text-center p-3 bg-orange-50 rounded-lg">
          <div class="font-semibold text-gray-700 text-sm">Handballs</div>
          <div class="text-xl font-bold text-orange-600">${avgHandballs}</div>
          <div class="text-xs text-gray-500">Total: ${player.total_handballs || 0}</div>
        </div>
        <div class="text-center p-3 bg-yellow-50 rounded-lg">
          <div class="font-semibold text-gray-700 text-sm">Marks</div>
          <div class="text-xl font-bold text-yellow-600">${avgMarks}</div>
          <div class="text-xs text-gray-500">Total: ${player.total_marks || 0}</div>
        </div>
        <div class="text-center p-3 bg-red-50 rounded-lg">
          <div class="font-semibold text-gray-700 text-sm">Tackles</div>
          <div class="text-xl font-bold text-red-600">${avgTackles}</div>
          <div class="text-xs text-gray-500">Total: ${player.total_tackles || 0}</div>
        </div>
      </div>
    </div>

    <!-- Best Game Stats -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Best Single Game Performance</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="text-center p-2 bg-gray-100 rounded">
          <div class="font-semibold text-gray-600 text-sm">Disposals</div>
          <div class="text-lg font-bold">${player.best_disposals ?? (bestStats.disposals !== null ? bestStats.disposals : 'N/A')}</div>
        </div>
        <div class="text-center p-2 bg-gray-100 rounded">
          <div class="font-semibold text-gray-600 text-sm">Goals</div>
          <div class="text-lg font-bold">${player.best_goals ?? (bestStats.goals !== null ? bestStats.goals : 'N/A')}</div>
        </div>
        <div class="text-center p-2 bg-gray-100 rounded">
          <div class="font-semibold text-gray-600 text-sm">Kicks</div>
          <div class="text-lg font-bold">${player.best_kicks ?? (bestStats.kicks !== null ? bestStats.kicks : 'N/A')}</div>
        </div>
        <div class="text-center p-2 bg-gray-100 rounded">
          <div class="font-semibold text-gray-600 text-sm">Handballs</div>
          <div class="text-lg font-bold">${player.best_handballs ?? (bestStats.handballs !== null ? bestStats.handballs : 'N/A')}</div>
        </div>
        <div class="text-center p-2 bg-gray-100 rounded">
          <div class="font-semibold text-gray-600 text-sm">Marks</div>
          <div class="text-lg font-bold">${player.best_marks ?? (bestStats.marks !== null ? bestStats.marks : 'N/A')}</div>
        </div>
        <div class="text-center p-2 bg-gray-100 rounded">
          <div class="font-semibold text-gray-600 text-sm">Tackles</div>
          <div class="text-lg font-bold">${player.best_tackles ?? (bestStats.tackles !== null ? bestStats.tackles : 'N/A')}</div>
        </div>
      </div>
    </div>
  `;
  
  // Store games data for sorting
  currentPlayerGames = games;
  
  // Display games and update count
  renderPlayerGames(games);
  
  // Update games count
  const gamesCountElement = document.getElementById('games-count');
  if (gamesCountElement) {
    gamesCountElement.textContent = `${games.length} games`;
  }
  
  playerDetails.classList.remove('hidden');
}

function renderPlayerGames(games) {
  gamesList.innerHTML = '';
  
  if (games.length === 0) {
    gamesList.innerHTML = '<p class="text-gray-600 text-center">No games found.</p>';
    return;
  }

  // Determine which stats are available across all games to show only relevant columns
  const hasDisposals = games.some(g => g.disposals !== null && g.disposals !== undefined && g.disposals !== '');
  const hasKicks = games.some(g => g.kicks !== null && g.kicks !== undefined && g.kicks !== '');
  const hasHandballs = games.some(g => g.handballs !== null && g.handballs !== undefined && g.handballs !== '');
  const hasMarks = games.some(g => g.marks !== null && g.marks !== undefined && g.marks !== '');
  const hasTackles = games.some(g => g.tackles !== null && g.tackles !== undefined && g.tackles !== '');
  const hasBehinds = games.some(g => g.behinds !== null && g.behinds !== undefined && g.behinds !== '');
  const hasHitouts = games.some(g => g.hitouts !== null && g.hitouts !== undefined && g.hitouts !== '');
  const hasFreeKicks = games.some(g => g.free_kicks_for !== null && g.free_kicks_for !== undefined && g.free_kicks_for !== '');
  const hasFantasy = games.some(g => g.afl_fantasy_score !== null && g.afl_fantasy_score !== undefined && g.afl_fantasy_score !== '');
  
  // Modern AFL stats (available from 2012+)
  const hasPressureActs = games.some(g => g.pressure_acts !== null && g.pressure_acts !== undefined && g.pressure_acts !== '');
  const hasGroundBallGets = games.some(g => g.ground_ball_gets !== null && g.ground_ball_gets !== undefined && g.ground_ball_gets !== '');
  const hasContestedPoss = games.some(g => g.contested_possessions !== null && g.contested_possessions !== undefined && g.contested_possessions !== '');
  const hasUncontestedPoss = games.some(g => g.uncontested_possessions !== null && g.uncontested_possessions !== undefined && g.uncontested_possessions !== '');
  const hasInsideFifties = games.some(g => g.inside_fifties !== null && g.inside_fifties !== undefined && g.inside_fifties !== '');
  const hasClearances = games.some(g => g.clearances !== null && g.clearances !== undefined && g.clearances !== '');
  const hasIntercepts = games.some(g => g.intercepts !== null && g.intercepts !== undefined && g.intercepts !== '');
  const hasRebounds = games.some(g => g.rebounds !== null && g.rebounds !== undefined && g.rebounds !== '');
  const hasOnePercenters = games.some(g => g.one_percenters !== null && g.one_percenters !== undefined && g.one_percenters !== '');
  const hasScoreInvolvements = games.some(g => g.score_involvements !== null && g.score_involvements !== undefined && g.score_involvements !== '');
  const hasGoalAssists = games.some(g => g.goal_assists !== null && g.goal_assists !== undefined && g.goal_assists !== '');
  const hasMetresGained = games.some(g => g.metres_gained !== null && g.metres_gained !== undefined && g.metres_gained !== '');
  const hasClangers = games.some(g => g.clangers !== null && g.clangers !== undefined && g.clangers !== '');
  const hasEffectiveDisposals = games.some(g => g.effective_disposals !== null && g.effective_disposals !== undefined && g.effective_disposals !== '');

  // Create scrollable container for the table
  const tableContainer = document.createElement('div');
  tableContainer.className = 'overflow-x-auto';
  
  // Create table with headers
  const table = document.createElement('table');
  table.className = 'w-full text-sm border-collapse';
  
  // Build dynamic header based on available stats with tooltips and sorting
  let headerCells = `
    <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b bg-gray-50 sticky left-0 cursor-pointer hover:bg-gray-100" data-sort="match_date" title="Click to sort by date">
      Date <span class="sort-indicator text-xs">↕️</span>
    </th>
    <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b bg-gray-50">Opponent</th>
    <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b bg-gray-50">Venue</th>
    <th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="match_round" title="Click to sort by round">
      Round <span class="sort-indicator text-xs">↕️</span>
    </th>
    <th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="goals" title="Goals - Click to sort">
      Goals <span class="sort-indicator text-xs">↕️</span>
    </th>
  `;
  
  if (hasBehinds) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="behinds" title="Behinds - Click to sort">Beh <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasDisposals) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="disposals" title="Disposals - Click to sort">Disp <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasEffectiveDisposals) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="effective_disposals" title="Effective Disposals - Click to sort">ED <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasKicks) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="kicks" title="Kicks - Click to sort">Kicks <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasHandballs) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="handballs" title="Handballs - Click to sort">HB <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasMarks) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="marks" title="Marks - Click to sort">Marks <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasTackles) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="tackles" title="Tackles - Click to sort">Tack <span class="sort-indicator text-xs">↕️</span></th>`;
  
  // Contest work
  if (hasContestedPoss) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="contested_possessions" title="Contested Possessions - Click to sort">CP <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasUncontestedPoss) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="uncontested_possessions" title="Uncontested Possessions - Click to sort">UP <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasGroundBallGets) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="ground_ball_gets" title="Ground Ball Gets - Click to sort">GBG <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasClearances) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="clearances" title="Clearances - Click to sort">Clr <span class="sort-indicator text-xs">↕️</span></th>`;
  
  // Forward work
  if (hasInsideFifties) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="inside_fifties" title="Inside 50s - Click to sort">I50 <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasScoreInvolvements) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="score_involvements" title="Score Involvements - Click to sort">SI <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasGoalAssists) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="goal_assists" title="Goal Assists - Click to sort">GA <span class="sort-indicator text-xs">↕️</span></th>`;
  
  // Defensive work
  if (hasIntercepts) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="intercepts" title="Intercepts - Click to sort">Int <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasRebounds) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="rebounds" title="Rebounds - Click to sort">Reb <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasPressureActs) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="pressure_acts" title="Pressure Acts - Click to sort">PA <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasOnePercenters) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="one_percenters" title="One Percenters - Click to sort">1% <span class="sort-indicator text-xs">↕️</span></th>`;
  
  // Other stats
  if (hasMetresGained) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="metres_gained" title="Metres Gained - Click to sort">MG <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasClangers) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="clangers" title="Clangers - Click to sort">Clang <span class="sort-indicator text-xs">↕️</span></th>`;
  if (hasHitouts) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="hitouts" title="Hitouts - Click to sort">HO <span class="sort-indicator text-xs">↕️</span></th>`;
  
  if (hasFreeKicks) {
    headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="free_kicks_for" title="Free Kicks For - Click to sort">FF <span class="sort-indicator text-xs">↕️</span></th>`;
    headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="free_kicks_against" title="Free Kicks Against - Click to sort">FA <span class="sort-indicator text-xs">↕️</span></th>`;
  }
  if (hasFantasy) headerCells += `<th class="px-3 py-2 text-center font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100" data-sort="afl_fantasy_score" title="AFL Fantasy Score - Click to sort">Fantasy <span class="sort-indicator text-xs">↕️</span></th>`;
  
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${headerCells}</tr>`;
  table.appendChild(thead);
  
  // Table body
  const tbody = document.createElement('tbody');
  
  games.forEach((game, index) => {
    const gameRow = document.createElement('tr');
    gameRow.className = `hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`;
    
    const gameDate = game.match_date ? new Date(game.match_date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    }) : '-';
    const opponent = game.opponent || '—';
    const venue = game.venue_name || '—';
    const round = game.match_round || '-';
    
    // Build dynamic row based on available stats
    let rowCells = `
      <td class="px-3 py-2 border-b text-sm font-medium sticky left-0 bg-white">${gameDate}</td>
      <td class="px-3 py-2 border-b text-sm">${opponent}</td>
      <td class="px-3 py-2 border-b text-sm text-gray-600">${venue}</td>
      <td class="px-3 py-2 border-b text-sm text-center">${round}</td>
      <td class="px-3 py-2 border-b text-sm text-center font-bold ${game.goals > 0 ? 'text-green-600' : ''}">${game.goals || 0}</td>
    `;
    
    if (hasBehinds) rowCells += `<td class="px-3 py-2 border-b text-sm text-center">${game.behinds || 0}</td>`;
    if (hasDisposals) rowCells += `<td class="px-3 py-2 border-b text-sm text-center font-medium text-blue-600">${game.disposals || '-'}</td>`;
    if (hasEffectiveDisposals) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-blue-500">${game.effective_disposals || '-'}</td>`;
    if (hasKicks) rowCells += `<td class="px-3 py-2 border-b text-sm text-center">${game.kicks || '-'}</td>`;
    if (hasHandballs) rowCells += `<td class="px-3 py-2 border-b text-sm text-center">${game.handballs || '-'}</td>`;
    if (hasMarks) rowCells += `<td class="px-3 py-2 border-b text-sm text-center">${game.marks || '-'}</td>`;
    if (hasTackles) rowCells += `<td class="px-3 py-2 border-b text-sm text-center">${game.tackles || '-'}</td>`;
    
    // Contest work
    if (hasContestedPoss) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-orange-600">${game.contested_possessions || '-'}</td>`;
    if (hasUncontestedPoss) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-teal-600">${game.uncontested_possessions || '-'}</td>`;
    if (hasGroundBallGets) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-yellow-600">${game.ground_ball_gets || '-'}</td>`;
    if (hasClearances) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-indigo-600">${game.clearances || '-'}</td>`;
    
    // Forward work
    if (hasInsideFifties) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-green-500">${game.inside_fifties || '-'}</td>`;
    if (hasScoreInvolvements) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-green-600">${game.score_involvements || '-'}</td>`;
    if (hasGoalAssists) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-green-700">${game.goal_assists || '-'}</td>`;
    
    // Defensive work
    if (hasIntercepts) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-red-500">${game.intercepts || '-'}</td>`;
    if (hasRebounds) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-red-600">${game.rebounds || '-'}</td>`;
    if (hasPressureActs) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-red-700">${game.pressure_acts || '-'}</td>`;
    if (hasOnePercenters) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-gray-700">${game.one_percenters || '-'}</td>`;
    
    // Other stats
    if (hasMetresGained) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-purple-500">${game.metres_gained || '-'}</td>`;
    if (hasClangers) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-orange-500">${game.clangers || '-'}</td>`;
    if (hasHitouts) rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-gray-600">${game.hitouts || '-'}</td>`;
    
    if (hasFreeKicks) {
      rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-green-600">${game.free_kicks_for || '-'}</td>`;
      rowCells += `<td class="px-3 py-2 border-b text-sm text-center text-red-600">${game.free_kicks_against || '-'}</td>`;
    }
    if (hasFantasy) rowCells += `<td class="px-3 py-2 border-b text-sm text-center font-medium text-purple-600">${game.afl_fantasy_score || '-'}</td>`;
    
    gameRow.innerHTML = rowCells;
    tbody.appendChild(gameRow);
  });
  
  table.appendChild(tbody);
  tableContainer.appendChild(table);
  gamesList.appendChild(tableContainer);

  // Add click event listeners to sortable headers
  const sortableHeaders = table.querySelectorAll('th[data-sort]');
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const sortColumn = header.getAttribute('data-sort');
      sortPlayerGames(sortColumn);
    });
  });
}

// Function to sort player games
function sortPlayerGames(column) {
  // Toggle sort direction if clicking the same column
  if (currentSortColumn === column) {
    currentSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc';
  } else {
    currentSortColumn = column;
    currentSortDirection = 'desc'; // Default to descending for stats
  }

  // Sort the games array
  const sortedGames = [...currentPlayerGames].sort((a, b) => {
    let valueA, valueB;

    if (column === 'match_date') {
      valueA = new Date(a.match_date);
      valueB = new Date(b.match_date);
    } else if (column === 'match_round') {
      // Handle round sorting (numeric where possible, string otherwise)
      valueA = isNaN(parseInt(a.match_round)) ? a.match_round : parseInt(a.match_round);
      valueB = isNaN(parseInt(b.match_round)) ? b.match_round : parseInt(b.match_round);
    } else {
      // Numeric stats
      valueA = parseInt(a[column]) || 0;
      valueB = parseInt(b[column]) || 0;
    }

    if (currentSortDirection === 'desc') {
      return valueB > valueA ? 1 : valueB < valueA ? -1 : 0;
    } else {
      return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
    }
  });

  // Re-render the table with sorted data
  renderPlayerGames(sortedGames);
  
  // Update sort indicators
  updateSortIndicators();
}

// Function to update sort indicators
function updateSortIndicators() {
  // Reset all indicators
  document.querySelectorAll('.sort-indicator').forEach(indicator => {
    indicator.textContent = '↕️';
  });

  // Update current sort indicator
  if (currentSortColumn) {
    const currentHeader = document.querySelector(`th[data-sort="${currentSortColumn}"] .sort-indicator`);
    if (currentHeader) {
      currentHeader.textContent = currentSortDirection === 'desc' ? '↓' : '↑';
    }
  }
}

// Search functionality
function setupSearch() {
  playerSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    
    if (!currentLetter || allPlayers.length === 0) {
      return; // No letter selected yet
    }
    
    if (searchTerm === '') {
      filteredPlayers = [...allPlayers];
    } else {
      filteredPlayers = allPlayers.filter(player => {
        const fullName = `${player.player_first_name} ${player.player_last_name}`.toLowerCase();
        return fullName.includes(searchTerm);
      });
    }
    
    renderPlayers(filteredPlayers);
  });
}

// Sort functionality
function setupSort() {
  sortPlayers.addEventListener('change', (e) => {
    const sortBy = e.target.value;
    
    if (filteredPlayers.length === 0) return;
    
    filteredPlayers.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.player_last_name} ${a.player_first_name}`.localeCompare(`${b.player_last_name} ${b.player_first_name}`);
        case 'games':
          return b.total_games - a.total_games;
        case 'disposals':
          return (b.total_disposals || 0) - (a.total_disposals || 0);
        case 'goals':
          return (b.total_goals || 0) - (a.total_goals || 0);
        default:
          return 0;
      }
    });
    
    renderPlayers(filteredPlayers);
  });
}

// Close player details
closeDetailsButton.addEventListener('click', () => {
  playerDetails.classList.add('hidden');
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadAlphabet();
  setupSearch();
  setupSort();
});
