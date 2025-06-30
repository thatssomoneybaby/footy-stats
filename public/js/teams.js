import { getTeams, getTeamDetails } from './api.js';

const teamsGrid = document.getElementById('teams-grid');
const teamDetails = document.getElementById('team-details');
const teamName = document.getElementById('team-name');
const teamSummary = document.getElementById('team-summary');
const topPerformers = document.getElementById('top-performers');
const matchesList = document.getElementById('matches-list');
const backButton = document.getElementById('back-to-teams');

let currentTeams = [];
let currentTeamGames = [];

// Team color mapping to CSS variables
const teamColorMap = {
  'Adelaide': { primary: '--adelaide-light-blue', secondary: '--adelaide-red' },
  'Brisbane': { primary: '--brisbane-dark-pink', secondary: '--brisbane-deep-yellow' },
  'Brisbane Bears': { primary: '--brisbane-dark-pink', secondary: '--brisbane-deep-yellow' },
  'Brisbane Lions': { primary: '--brisbane-dark-pink', secondary: '--brisbane-deep-yellow' },
  'Carlton': { primary: '--carlton-dark-navy', secondary: '--carlton-white' },
  'Essendon': { primary: '--essendon-red', secondary: '--essendon-black' },
  'Fitzroy': { primary: '--fitzroy-red', secondary: '--fitzroy-blue' },
  'Fremantle': { primary: '--fremantle-indigo', secondary: '--fremantle-gray' },
  'Geelong': { primary: '--geelong-dark-blue', secondary: '--geelong-white' },
  'Gold Coast': { primary: '--goldcoast-red', secondary: '--goldcoast-yellow' },
  'GWS': { primary: '--gws-orange', secondary: '--gws-white' },
  'Greater Western Sydney': { primary: '--gws-orange', secondary: '--gws-white' },
  'Hawthorn': { primary: '--hawthorn-brown', secondary: '--hawthorn-yellow' },
  'Melbourne': { primary: '--melbourne-dark-blue', secondary: '--melbourne-red' },
  'North Melbourne': { primary: '--north-blue', secondary: '--north-white' },
  'Port Adelaide': { primary: '--portadelaide-black', secondary: '--portadelaide-blue' },
  'Richmond': { primary: '--richmond-yellow', secondary: '--richmond-black' },
  'St Kilda': { primary: '--stkilda-red', secondary: '--stkilda-white' },
  'Sydney': { primary: '--sydney-red', secondary: '--sydney-white' },
  'West Coast': { primary: '--westcoast-blue', secondary: '--westcoast-yellow' },
  'Western Bulldogs': { primary: '--bulldogs-blue', secondary: '--bulldogs-white' },
  'Footscray': { primary: '--bulldogs-blue', secondary: '--bulldogs-white' },
  'University': { primary: '--university-blue', secondary: '--university-black' }
};

// Function to get team colors
function getTeamColors(teamName) {
  return teamColorMap[teamName] || { primary: '--afl-blue', secondary: '--afl-blue-dark' };
}

// Load teams on page load
async function loadTeams() {
  try {
    currentTeams = await getTeams();
    renderTeams(currentTeams);
  } catch (error) {
    console.error('Error loading teams:', error);
    teamsGrid.innerHTML = '<p class="text-red-600">Error loading teams. Please try again.</p>';
  }
}

function renderTeams(teams) {
  teamsGrid.innerHTML = '';
  
  if (teams.length === 0) {
    teamsGrid.innerHTML = '<p class="text-gray-600 col-span-full text-center">No teams found.</p>';
    return;
  }

  teams.forEach(team => {
    const teamCard = document.createElement('div');
    const colors = getTeamColors(team.team_name);
    
    // Apply team colors as CSS custom properties
    teamCard.style.setProperty('--team-primary', `var(${colors.primary})`);
    teamCard.style.setProperty('--team-secondary', `var(${colors.secondary})`);
    
    teamCard.className = 'p-4 border-2 rounded-lg hover:shadow-lg cursor-pointer transition-all duration-200 transform hover:scale-105';
    teamCard.style.borderColor = `var(${colors.primary})`;
    teamCard.style.background = `linear-gradient(135deg, var(${colors.primary})15, var(${colors.secondary})10)`;
    
    teamCard.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-lg" style="color: var(${colors.primary})">${team.team_name}</h3>
        <div class="w-4 h-4 rounded-full" style="background: var(${colors.primary})"></div>
      </div>
      <div class="text-sm space-y-2">
        <p class="flex justify-between">
          <span class="font-medium text-gray-700">Years:</span> 
          <span class="font-semibold" style="color: var(${colors.primary})">${team.first_year} - ${team.last_year}</span>
        </p>
        <p class="flex justify-between">
          <span class="font-medium text-gray-700">Total Matches:</span> 
          <span class="font-semibold" style="color: var(${colors.primary})">${team.total_matches}</span>
        </p>
      </div>
      <div class="mt-3 pt-3 border-t" style="border-color: var(${colors.primary})30">
        <div class="text-xs text-center font-medium" style="color: var(${colors.primary})">
          Click to view details
        </div>
      </div>
    `;
    
    teamCard.addEventListener('click', () => loadTeamDetails(team.team_name));
    teamsGrid.appendChild(teamCard);
  });
}

async function loadTeamDetails(teamName) {
  try {
    const details = await getTeamDetails(teamName);
    renderTeamDetails(details);
    
    // Hide teams grid and show details
    document.querySelector('.max-w-7xl').children[0].style.display = 'none';
    teamDetails.classList.remove('hidden');
  } catch (error) {
    console.error('Error loading team details:', error);
    alert('Error loading team details. Please try again.');
  }
}

function renderTeamDetails(details) {
  // Set team name
  teamName.textContent = details.team;
  
  // Store all games for filtering
  currentTeamGames = details.allGames || [];
  
  // Render summary stats
  const stats = details.stats;
  const winPercentage = stats.total_matches > 0 ? ((stats.wins / stats.total_matches) * 100).toFixed(1) : 0;
  
  teamSummary.innerHTML = `
    <div class="bg-blue-50 p-4 rounded-lg">
      <h4 class="font-semibold text-afl-blue mb-1">Total Matches</h4>
      <p class="text-2xl font-bold text-gray-900">${stats.total_matches || 0}</p>
    </div>
    <div class="bg-green-50 p-4 rounded-lg">
      <h4 class="font-semibold text-green-700 mb-1">Win Rate</h4>
      <p class="text-2xl font-bold text-gray-900">${winPercentage}%</p>
      <p class="text-sm text-gray-600">${stats.wins || 0}W - ${stats.losses || 0}L</p>
    </div>
    <div class="bg-yellow-50 p-4 rounded-lg">
      <h4 class="font-semibold text-yellow-700 mb-1">Highest Score</h4>
      <p class="text-2xl font-bold text-gray-900">${stats.highest_score || 0}</p>
    </div>
    <div class="bg-red-50 p-4 rounded-lg">
      <h4 class="font-semibold text-red-700 mb-1">Biggest Win</h4>
      <p class="text-2xl font-bold text-gray-900">${stats.biggest_win_margin || 0} pts</p>
    </div>
    <div class="bg-purple-50 p-4 rounded-lg">
      <h4 class="font-semibold text-purple-700 mb-1">Grand Finals</h4>
      <p class="text-2xl font-bold text-gray-900">${details.grandFinals?.grand_finals_won || 0}</p>
      <p class="text-sm text-gray-600">Premierships</p>
    </div>
  `;
  
  // Render top performers
  topPerformers.innerHTML = '';
  
  if (details.topDisposals && details.topDisposals.length > 0) {
    const disposalsCard = document.createElement('div');
    disposalsCard.className = 'bg-white border border-gray-200 rounded-lg p-6';
    
    let disposalsList = '';
    details.topDisposals.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      disposalsList += `
        <div class="flex items-center justify-between py-2 ${index < details.topDisposals.length - 1 ? 'border-b border-gray-100' : ''}">
          <div class="flex items-center space-x-3">
            <span class="text-sm font-medium w-8">${medal}</span>
            <div>
              <p class="font-medium text-gray-900">${player.player_first_name} ${player.player_last_name}</p>
              <p class="text-xs text-gray-500">${player.games_played} games</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-gray-900">${player.total_disposals || 0}</p>
            <p class="text-xs text-gray-500">${parseFloat(player.avg_disposals || 0).toFixed(1)}/game</p>
          </div>
        </div>
      `;
    });
    
    disposalsCard.innerHTML = `
      <h4 class="text-lg font-semibold text-gray-900 mb-4">🏆 Top 10 Disposal Getters</h4>
      <div class="space-y-1">
        ${disposalsList}
      </div>
    `;
    topPerformers.appendChild(disposalsCard);
  }
  
  if (details.topGoals && details.topGoals.length > 0) {
    const goalsCard = document.createElement('div');
    goalsCard.className = 'bg-white border border-gray-200 rounded-lg p-6';
    
    let goalsList = '';
    details.topGoals.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      goalsList += `
        <div class="flex items-center justify-between py-2 ${index < details.topGoals.length - 1 ? 'border-b border-gray-100' : ''}">
          <div class="flex items-center space-x-3">
            <span class="text-sm font-medium w-8">${medal}</span>
            <div>
              <p class="font-medium text-gray-900">${player.player_first_name} ${player.player_last_name}</p>
              <p class="text-xs text-gray-500">${player.games_played} games</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-gray-900">${player.total_goals || 0}</p>
            <p class="text-xs text-gray-500">${parseFloat(player.avg_goals || 0).toFixed(1)}/game</p>
          </div>
        </div>
      `;
    });
    
    goalsCard.innerHTML = `
      <h4 class="text-lg font-semibold text-gray-900 mb-4">⚽ Top 10 Goal Kickers</h4>
      <div class="space-y-1">
        ${goalsList}
      </div>
    `;
    topPerformers.appendChild(goalsCard);
  }
  
  // Create year buttons
  createTeamYearButtons();
  
  // Clear matches list initially
  matchesList.innerHTML = '<p class="text-gray-600 text-center py-4">Select a year to view matches.</p>';
}

function createTeamYearButtons() {
  const teamYears = document.getElementById('team-years');
  const teamRounds = document.getElementById('team-rounds');
  
  // Clear existing buttons
  teamYears.innerHTML = '';
  teamRounds.innerHTML = '';
  teamRounds.classList.add('hidden');
  
  // Get unique years from games
  const years = [...new Set(currentTeamGames.map(game => 
    new Date(game.match_date).getFullYear()
  ))].sort((a, b) => b - a);
  
  years.forEach(year => {
    const btn = document.createElement('button');
    btn.innerText = year;
    btn.className = 'px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';
    btn.onclick = () => {
      // Update button states
      document.querySelectorAll('#team-years button').forEach(b => {
        b.className = 'px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';
      });
      btn.className = 'px-3 py-1.5 bg-afl-blue text-white border border-afl-blue rounded text-sm font-medium';
      
      // Show rounds for this year
      showTeamRounds(year);
    };
    teamYears.appendChild(btn);
  });
}

function showTeamRounds(year) {
  const teamRounds = document.getElementById('team-rounds');
  
  // Get games for this year
  const yearGames = currentTeamGames.filter(game => 
    new Date(game.match_date).getFullYear() === year
  );
  
  // Get unique rounds
  const rounds = [...new Set(yearGames.map(game => game.match_round))]
    .sort((a, b) => parseInt(a) - parseInt(b));
  
  // Clear and show rounds
  teamRounds.innerHTML = '';
  teamRounds.classList.remove('hidden');
  
  rounds.forEach(round => {
    const btn = document.createElement('button');
    btn.textContent = `Round ${round}`;
    btn.className = 'px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';
    btn.onclick = () => {
      // Update button states
      document.querySelectorAll('#team-rounds button').forEach(b => {
        b.className = 'px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';
      });
      btn.className = 'px-3 py-1.5 bg-afl-blue text-white border border-afl-blue rounded text-sm font-medium';
      
      // Show games for this round
      showTeamGames(year, round);
    };
    teamRounds.appendChild(btn);
  });
  
  // Clear matches list
  matchesList.innerHTML = '<p class="text-gray-600 text-center py-4">Select a round to view matches.</p>';
}

function showTeamGames(year, round) {
  // Get games for this year and round
  const games = currentTeamGames.filter(game => 
    new Date(game.match_date).getFullYear() === year && 
    game.match_round === round
  );
  
  matchesList.innerHTML = '';
  
  if (games.length === 0) {
    matchesList.innerHTML = '<p class="text-gray-600 text-center py-4">No games found for this round.</p>';
    return;
  }
  
  games.forEach(game => {
    const matchDiv = document.createElement('div');
    matchDiv.className = 'p-4 border border-gray-200 rounded-lg bg-gray-50';
    
    const isHome = game.match_home_team === teamName.textContent;
    const opponent = isHome ? game.match_away_team : game.match_home_team;
    const teamScore = isHome ? game.match_home_team_score : game.match_away_team_score;
    const opponentScore = isHome ? game.match_away_team_score : game.match_home_team_score;
    const result = game.match_winner === teamName.textContent ? 'W' : 'L';
    const resultColor = result === 'W' ? 'text-green-600' : 'text-red-600';
    const homeAway = isHome ? 'HOME' : 'AWAY';
    
    matchDiv.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="text-center">
            <span class="font-bold ${resultColor} text-2xl">${result}</span>
            <p class="text-xs text-gray-500">${homeAway}</p>
          </div>
          <div>
            <p class="font-medium text-gray-900">vs ${opponent}</p>
            <p class="text-sm text-gray-600">${game.match_date} - Round ${game.match_round}</p>
            <p class="text-sm text-gray-600">${game.venue_name}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-semibold text-gray-900 text-lg">${teamScore} - ${opponentScore}</p>
          <p class="text-sm text-gray-600">Margin: ${Math.abs(game.match_margin || 0)} pts</p>
        </div>
      </div>
    `;
    
    matchesList.appendChild(matchDiv);
  });
}

// Event listeners
backButton.addEventListener('click', () => {
  teamDetails.classList.add('hidden');
  document.querySelector('.max-w-7xl').children[0].style.display = 'block';
});

// Initialize page
loadTeams();