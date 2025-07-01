import { getUpcomingGames, getInsights, getHeadToHead } from './api.js';

// Team color mapping
const teamColors = {
  'Adelaide': { primary: '#004B8D', secondary: '#E21937', light: '#E3F2FD' },
  'Brisbane': { primary: '#A30046', secondary: '#FDBE57', light: '#FCE4EC' },
  'Carlton': { primary: '#031A29', secondary: '#FFFFFF', light: '#E8F5E8' },
  'Collingwood': { primary: '#000000', secondary: '#FFFFFF', light: '#F5F5F5' },
  'Essendon': { primary: '#CC2031', secondary: '#010101', light: '#FFEBEE' },
  'Fremantle': { primary: '#2A0D54', secondary: '#A2ACB4', light: '#F3E5F5' },
  'Geelong': { primary: '#002B5C', secondary: '#FFFFFF', light: '#E8F5E8' },
  'Gold Coast': { primary: '#E02112', secondary: '#FFDD00', light: '#FFF3E0' },
  'Greater Western Sydney': { primary: '#F47920', secondary: '#FFFFFF', light: '#FFF3E0' },
  'Hawthorn': { primary: '#4D2004', secondary: '#FBBF15', light: '#FFF8E1' },
  'Melbourne': { primary: '#0F1131', secondary: '#CC2031', light: '#E8EAF6' },
  'North Melbourne': { primary: '#1A3B8E', secondary: '#FFFFFF', light: '#E3F2FD' },
  'Port Adelaide': { primary: '#000000', secondary: '#008AAB', light: '#F5F5F5' },
  'Richmond': { primary: '#FFD200', secondary: '#000000', light: '#FFFDE7' },
  'St Kilda': { primary: '#000000', secondary: '#ED1B2F', light: '#F5F5F5' },
  'Sydney': { primary: '#E1251B', secondary: '#FFFFFF', light: '#FFEBEE' },
  'West Coast': { primary: '#F2A900', secondary: '#003087', light: '#FFF8E1' },
  'Western Bulldogs': { primary: '#20539D', secondary: '#BD002B', light: '#E3F2FD' }
};

function getTeamColors(teamName) {
  return teamColors[teamName] || { primary: '#1A3B8E', secondary: '#FFFFFF', light: '#E3F2FD' };
}

// DOM elements
const upcomingGamesLoading = document.getElementById('upcoming-games-loading');
const upcomingGamesContent = document.getElementById('upcoming-games-content');
const upcomingGamesError = document.getElementById('upcoming-games-error');

const insightsLoading = document.getElementById('insights-loading');
const insightsContent = document.getElementById('insights-content');
const insightsError = document.getElementById('insights-error');

// Load upcoming games using real getUpcomingGames data
async function loadUpcomingGames() {
  try {
    upcomingGamesLoading.classList.remove('hidden');

    const games = await getUpcomingGames();   // ← now real data
    renderUpcomingGames(games);

    upcomingGamesContent.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    upcomingGamesError.classList.remove('hidden');
  } finally {
    upcomingGamesLoading.classList.add('hidden');
  }
}

// Load insights
async function loadInsights() {
  try {
    const insights = await getInsights();
    
    if (insights && insights.length > 0) {
      renderInsights(insights);
      insightsLoading.classList.add('hidden');
      insightsContent.classList.remove('hidden');
    } else {
      insightsLoading.classList.add('hidden');
      insightsError.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading insights:', error);
    insightsLoading.classList.add('hidden');
    insightsError.classList.remove('hidden');
  }
}

function renderUpcomingGames(games) {
  upcomingGamesContent.innerHTML = '';
  
  if (games.length === 0) {
    upcomingGamesContent.innerHTML = `
      <div class="text-center py-4">
        <p class="text-gray-600 mb-2">No upcoming games available</p>
        <p class="text-sm text-gray-500">The AFL season may not have started yet or all scheduled games are complete.</p>
      </div>
    `;
    return;
  }

  games.forEach((game, index) => {
    const gameDate = new Date(game.date);
    const dateStr = gameDate.toLocaleDateString('en-AU', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const gameCard = document.createElement('div');
    gameCard.className = 'bg-gray-50 rounded-lg border border-gray-100 p-4 mb-4';
    
    gameCard.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-medium text-gray-900">
          ${game.status === 'LIVE' ? `<span class="live-dot">LIVE</span>` : ''}
          ${game.hteam} vs ${game.ateam}
        </div>
        <div class="text-right">
          <div class="text-sm font-medium text-afl-blue">${dateStr}</div>
          <div class="text-xs text-gray-500">${game.venue || 'TBA'}</div>
        </div>
      </div>
      <div class="mt-2 text-xs text-gray-600">
        <div>Round ${game.round} • ${game.roundname}</div>
        ${index === 0 ? `<div class="mt-1 text-blue-600 font-medium">Next game ⚡</div>` : ''}
      </div>
      <button onclick="showGameInsights('${game.hteam}', '${game.ateam}')" class="mt-2 text-xs text-afl-blue hover:text-afl-blue-dark font-medium cursor-pointer">View detailed insights →</button>
    `;
    
    upcomingGamesContent.appendChild(gameCard);
  });
  
  // Add "View All" link
  const viewAllLink = document.createElement('div');
  viewAllLink.className = 'text-center pt-2 border-t border-gray-100';
  viewAllLink.innerHTML = `
    <a href="https://www.afl.com.au/fixture" target="_blank" class="text-sm text-afl-blue hover:text-afl-blue-dark font-medium">
      View Full Fixture →
    </a>
  `;
  upcomingGamesContent.appendChild(viewAllLink);
}

function renderInsights(insights) {
  insightsContent.innerHTML = '';
  
  insights.slice(0, 5).forEach(insight => {
    const insightCard = document.createElement('div');
    insightCard.className = 'p-4 bg-gray-50 rounded-lg border border-gray-100';
    
    insightCard.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="text-2xl">${insight.icon}</div>
        <div class="flex-1">
          <h3 class="font-medium text-gray-900 mb-1">${insight.title}</h3>
          <p class="text-sm text-gray-700 mb-2">${insight.description}</p>
          <p class="text-xs text-gray-500">${insight.details}</p>
        </div>
      </div>
    `;
    
    insightsContent.appendChild(insightCard);
  });
  
  // Add "Explore More" link
  const exploreLink = document.createElement('div');
  exploreLink.className = 'text-center pt-2 border-t border-gray-100';
  exploreLink.innerHTML = `
    <a href="trophy-room.html" class="text-sm text-afl-blue hover:text-afl-blue-dark font-medium">
      Explore Trophy Room →
    </a>
  `;
  insightsContent.appendChild(exploreLink);
}

// Show detailed insights for a specific game
window.showGameInsights = async function(homeTeam, awayTeam) {
  try {
    const homeColors = getTeamColors(homeTeam);
    const awayColors = getTeamColors(awayTeam);
    
    // Create a modal with team colors
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-6xl w-full max-h-screen overflow-y-auto p-8">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-bold text-gray-900">${homeTeam} vs ${awayTeam} - Head-to-Head Analysis</h2>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-gray-500 hover:text-gray-700 text-3xl font-bold">&times;</button>
        </div>
        <div id="game-insights-content">
          <div class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-afl-blue"></div>
            <p class="mt-4 text-lg text-gray-600">Loading head-to-head analysis...</p>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load head-to-head specific data
    const h2hData = await getHeadToHead(homeTeam, awayTeam);
    
    const content = document.getElementById('game-insights-content');
    content.innerHTML = `
      <!-- Head-to-Head Summary -->
      <div class="mb-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200">
        <h3 class="text-xl font-bold text-gray-900 mb-4 text-center">Head-to-Head Record</h3>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div style="background-color: ${homeColors.light}; border-left: 4px solid ${homeColors.primary};" class="p-4 rounded">
            <div class="text-2xl font-bold" style="color: ${homeColors.primary};">${h2hData.summary[homeTeam] || 0}</div>
            <div class="text-sm text-gray-600">${homeTeam} wins</div>
          </div>
          <div class="p-4 rounded bg-gray-100">
            <div class="text-xl font-bold text-gray-700">${h2hData.summary.totalGames || 0}</div>
            <div class="text-sm text-gray-600">Total meetings</div>
          </div>
          <div style="background-color: ${awayColors.light}; border-right: 4px solid ${awayColors.primary};" class="p-4 rounded">
            <div class="text-2xl font-bold" style="color: ${awayColors.primary};">${h2hData.summary[awayTeam] || 0}</div>
            <div class="text-sm text-gray-600">${awayTeam} wins</div>
          </div>
        </div>
      </div>

      ${h2hData.lastMeeting ? `
      <!-- Last Meeting -->
      <div class="mb-8 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 class="text-xl font-bold text-gray-900 mb-4">🏆 Last Meeting</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="text-lg font-semibold text-gray-800">
              ${h2hData.lastMeeting.match_winner} defeated ${h2hData.lastMeeting.match_winner === h2hData.lastMeeting.match_home_team ? h2hData.lastMeeting.match_away_team : h2hData.lastMeeting.match_home_team} 
              by ${h2hData.lastMeeting.margin} points
            </div>
            <div class="text-sm text-gray-600 mt-2">
              ${h2hData.lastMeeting.match_home_team} ${h2hData.lastMeeting.home_score} - ${h2hData.lastMeeting.away_score} ${h2hData.lastMeeting.match_away_team}
            </div>
            <div class="text-sm text-gray-600">
              ${new Date(h2hData.lastMeeting.match_date).toLocaleDateString('en-AU')} • ${h2hData.lastMeeting.venue_name} • ${h2hData.lastMeeting.match_round}
            </div>
          </div>
          
          ${h2hData.lastMeetingPerformers ? `
          <div>
            <h4 class="font-semibold text-gray-800 mb-2">Top Performers from That Game</h4>
            ${h2hData.lastMeetingPerformers.topGoals.length > 0 ? `
              <div class="mb-3">
                <div class="text-sm font-medium text-gray-700">Goals:</div>
                ${h2hData.lastMeetingPerformers.topGoals.slice(0, 3).map(player => `
                  <div class="text-sm" style="color: ${getTeamColors(player.player_team).primary};">
                    ${player.player_first_name} ${player.player_last_name} (${player.player_team}) - ${player.goals}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${h2hData.lastMeetingPerformers.topDisposals.length > 0 ? `
              <div>
                <div class="text-sm font-medium text-gray-700">Disposals:</div>
                ${h2hData.lastMeetingPerformers.topDisposals.slice(0, 3).map(player => `
                  <div class="text-sm" style="color: ${getTeamColors(player.player_team).primary};">
                    ${player.player_first_name} ${player.player_last_name} (${player.player_team}) - ${player.disposals}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      <!-- Team Comparison in this Matchup -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Home Team -->
        <div style="background-color: ${homeColors.light}; border-left: 6px solid ${homeColors.primary};" class="rounded-lg p-6">
          <h3 class="text-xl font-semibold mb-4" style="color: ${homeColors.primary};">${homeTeam} (Home)</h3>
          
          ${h2hData.biggestWins[homeTeam] ? `
          <div class="mb-6 p-4 bg-green-50 rounded border border-green-200">
            <h4 class="font-semibold text-green-800 mb-2">🔥 Biggest Win Against ${awayTeam}</h4>
            <div class="text-sm text-green-700">
              Won by ${h2hData.biggestWins[homeTeam].margin} points
            </div>
            <div class="text-xs text-green-600">
              ${new Date(h2hData.biggestWins[homeTeam].match_date).getFullYear()} • ${h2hData.biggestWins[homeTeam].venue_name}
            </div>
          </div>
          ` : '<div class="mb-6 p-4 bg-gray-50 rounded"><div class="text-sm text-gray-600">No wins against this opponent in recent history</div></div>'}

          <div class="mb-4">
            <h4 class="font-semibold mb-2" style="color: ${homeColors.primary};">Recent Meetings (${homeTeam} perspective)</h4>
            <div class="text-sm" style="color: ${homeColors.primary};">
              ${h2hData.headToHeadHistory.slice(0, 5).map(game => {
                const isWin = game.match_winner === homeTeam;
                return `<span class="${isWin ? 'text-green-600 font-bold' : 'text-red-600'}">${isWin ? 'W' : 'L'}</span>`;
              }).join(' ')}
            </div>
            <div class="text-xs text-gray-600 mt-1">Last 5 meetings (most recent first)</div>
          </div>
        </div>
        
        <!-- Away Team -->
        <div style="background-color: ${awayColors.light}; border-right: 6px solid ${awayColors.primary};" class="rounded-lg p-6">
          <h3 class="text-xl font-semibold mb-4" style="color: ${awayColors.primary};">${awayTeam} (Away)</h3>
          
          ${h2hData.biggestWins[awayTeam] ? `
          <div class="mb-6 p-4 bg-green-50 rounded border border-green-200">
            <h4 class="font-semibold text-green-800 mb-2">🔥 Biggest Win Against ${homeTeam}</h4>
            <div class="text-sm text-green-700">
              Won by ${h2hData.biggestWins[awayTeam].margin} points
            </div>
            <div class="text-xs text-green-600">
              ${new Date(h2hData.biggestWins[awayTeam].match_date).getFullYear()} • ${h2hData.biggestWins[awayTeam].venue_name}
            </div>
          </div>
          ` : '<div class="mb-6 p-4 bg-gray-50 rounded"><div class="text-sm text-gray-600">No wins against this opponent in recent history</div></div>'}

          <div class="mb-4">
            <h4 class="font-semibold mb-2" style="color: ${awayColors.primary};">Recent Meetings (${awayTeam} perspective)</h4>
            <div class="text-sm" style="color: ${awayColors.primary};">
              ${h2hData.headToHeadHistory.slice(0, 5).map(game => {
                const isWin = game.match_winner === awayTeam;
                return `<span class="${isWin ? 'text-green-600 font-bold' : 'text-red-600'}">${isWin ? 'W' : 'L'}</span>`;
              }).join(' ')}
            </div>
            <div class="text-xs text-gray-600 mt-1">Last 5 meetings (most recent first)</div>
          </div>
        </div>
      </div>

      <!-- Recent History Table -->
      ${h2hData.headToHeadHistory.length > 0 ? `
      <div class="mt-8 overflow-x-auto">
        <h3 class="text-xl font-bold text-gray-900 mb-4">Recent Meeting History</h3>
        <table class="w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Date</th>
              <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Match</th>
              <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Winner</th>
              <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Margin</th>
              <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Venue</th>
            </tr>
          </thead>
          <tbody>
            ${h2hData.headToHeadHistory.slice(0, 8).map(game => `
              <tr class="border-t border-gray-100">
                <td class="px-4 py-2 text-sm text-gray-600">${new Date(game.match_date).toLocaleDateString('en-AU')}</td>
                <td class="px-4 py-2 text-sm">${game.match_home_team} vs ${game.match_away_team}</td>
                <td class="px-4 py-2 text-sm font-semibold" style="color: ${getTeamColors(game.match_winner).primary};">${game.match_winner}</td>
                <td class="px-4 py-2 text-sm">${game.margin} pts</td>
                <td class="px-4 py-2 text-sm text-gray-600">${game.venue_name}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
    `;
    
  } catch (error) {
    console.error('Error loading game insights:', error);
    const content = document.getElementById('game-insights-content');
    if (content) {
      content.innerHTML = '<div class="text-center py-8"><p class="text-red-600">Unable to load head-to-head analysis. Please try again.</p></div>';
    }
  }
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadUpcomingGames();
  loadInsights();

  // Live updates after DOM is ready
  import('./live.js').then(({ listenLiveGames }) => {
    listenLiveGames({
      onGame:   (g) => updateLiveCard(g),
      onRemove: (g) => markFinalScore(g)
    });
  });
});