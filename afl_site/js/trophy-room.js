import { getHallOfRecords } from './api.js';

const loading = document.getElementById('loading');
const hallOfRecords = document.getElementById('hall-of-records');
const categoryTabs = document.getElementById('category-tabs');
const categoryTitle = document.getElementById('category-title');
const statsGrid = document.getElementById('stats-grid');
const statModal = document.getElementById('stat-modal');
const modalStatTitle = document.getElementById('modal-stat-title');
const modalTop10 = document.getElementById('modal-top-10');
const closeModalButton = document.getElementById('close-stat-modal');

let recordsData = {};
let currentCategory = null;

// Color configurations for categories
const categoryColors = {
  'Scoring': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', button: 'bg-red-100 hover:bg-red-200' },
  'Possession': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', button: 'bg-blue-100 hover:bg-blue-200' },
  'Defence': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', button: 'bg-purple-100 hover:bg-purple-200' },
  'Contest Work': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', button: 'bg-orange-100 hover:bg-orange-200' },
  'Forward Play': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', button: 'bg-green-100 hover:bg-green-200' },
  'Ruck Work': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', button: 'bg-indigo-100 hover:bg-indigo-200' },
  'Game Management': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', button: 'bg-teal-100 hover:bg-teal-200' },
  'Fantasy & Ratings': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', button: 'bg-violet-100 hover:bg-violet-200' }
};

// Load Hall of Records on page load
async function loadHallOfRecords() {
  try {
    console.log('Loading Hall of Records...');
    recordsData = await getHallOfRecords();
    console.log('Hall of Records data received:', Object.keys(recordsData).length, 'categories');
    
    renderCategoryTabs();
    
    // Show first category by default
    const firstCategory = Object.keys(recordsData)[0];
    if (firstCategory) {
      showCategory(firstCategory);
    }
    
    // Hide loading and show content
    loading.classList.add('hidden');
    hallOfRecords.classList.remove('hidden');
  } catch (error) {
    console.error('Error loading Hall of Records:', error);
    loading.innerHTML = `<p class="text-red-600">Error loading Hall of Records: ${error.message}. Please try again.</p>`;
  }
}


function renderCategoryTabs() {
  categoryTabs.innerHTML = '';
  
  Object.entries(recordsData).forEach(([categoryName, categoryData]) => {
    const colors = categoryColors[categoryName] || categoryColors['Scoring'];
    
    const tabButton = document.createElement('button');
    tabButton.className = `px-4 py-2 rounded-lg font-medium transition-colors ${colors.button} ${colors.text} border ${colors.border}`;
    tabButton.innerHTML = `
      <span class="text-lg mr-2">${categoryData.icon}</span>
      ${categoryName}
    `;
    
    tabButton.addEventListener('click', () => showCategory(categoryName));
    categoryTabs.appendChild(tabButton);
  });
}

function showCategory(categoryName) {
  currentCategory = categoryName;
  const categoryData = recordsData[categoryName];
  
  // Update active tab
  categoryTabs.querySelectorAll('button').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2');
  });
  
  const activeTab = Array.from(categoryTabs.querySelectorAll('button'))
    .find(btn => btn.textContent.trim().includes(categoryName));
  if (activeTab) {
    activeTab.classList.add('ring-2', 'ring-offset-2', 'ring-afl-blue');
  }
  
  // Update category title
  categoryTitle.innerHTML = `
    <span class="text-3xl mr-3">${categoryData.icon}</span>
    ${categoryName}
  `;
  
  // Render stats for this category
  renderCategoryStats(categoryData);
}

function renderCategoryStats(categoryData) {
  statsGrid.innerHTML = '';
  
  Object.entries(categoryData.records).forEach(([statName, statData]) => {
    const statSection = document.createElement('div');
    statSection.className = 'bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden';
    
    const leader = statData.top10[0]; // Get the #1 player
    const playerName = `${leader.player_first_name} ${leader.player_last_name}`;
    
    // Format team info
    let teamInfo = '';
    if (leader.teamGuernseys && leader.teamGuernseys.length > 0) {
      const teams = leader.teamGuernseys.map(tg => tg.player_team);
      const uniqueTeams = [...new Set(teams)];
      teamInfo = uniqueTeams.length === 1 ? uniqueTeams[0] : `${uniqueTeams.join(', ')}`;
    }
    
    statSection.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-xl font-bold text-gray-900 flex items-center">
            <span class="text-2xl mr-2">${statData.icon}</span>
            ${statName}
          </h4>
          <button class="view-all-btn px-3 py-1 text-sm bg-afl-blue text-white rounded-lg hover:bg-afl-blue-dark transition-colors" data-stat-name="${statName}">
            View Top 10
          </button>
        </div>
        
        <div class="flex items-center justify-between">
          <div>
            <h5 class="text-2xl font-bold text-afl-blue">${playerName}</h5>
            <p class="text-gray-600 text-sm">${teamInfo}</p>
            <p class="text-sm text-gray-500">${leader.first_year} - ${leader.last_year}</p>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold text-gray-900">${leader.stat_value.toLocaleString()}</div>
            <div class="text-sm text-gray-500">
              ${leader.games_played} games • ${parseFloat(leader.avg_per_game).toFixed(1)} avg
            </div>
          </div>
        </div>
        
        <!-- Mini top 3 preview -->
        <div class="mt-4 pt-4 border-t border-gray-100">
          <h6 class="text-sm font-medium text-gray-700 mb-2">Top 3:</h6>
          <div class="space-y-1">
            ${statData.top10.slice(0, 3).map((player, index) => `
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">
                  ${index + 1}. ${player.player_first_name} ${player.player_last_name}
                </span>
                <span class="font-medium">${player.stat_value.toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    // Add click handler for "View Top 10" button
    const viewAllBtn = statSection.querySelector('.view-all-btn');
    viewAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showStatModal(statName, statData);
    });
    
    statsGrid.appendChild(statSection);
  });
}

function showStatModal(statName, statData) {
  modalStatTitle.textContent = `${statData.icon} ${statName} - Top 10 All-Time`;
  
  modalTop10.innerHTML = '';
  
  statData.top10.forEach((player, index) => {
    const playerCard = document.createElement('div');
    playerCard.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
    
    // Format team info
    let teamInfo = '';
    if (player.teamGuernseys && player.teamGuernseys.length > 0) {
      const teams = player.teamGuernseys.map(tg => tg.player_team);
      const uniqueTeams = [...new Set(teams)];
      teamInfo = uniqueTeams.length === 1 ? uniqueTeams[0] : `${uniqueTeams.join(', ')}`;
    }
    
    // Medal for top 3
    let medal = '';
    if (index === 0) medal = '🥇';
    else if (index === 1) medal = '🥈';
    else if (index === 2) medal = '🥉';
    
    playerCard.innerHTML = `
      <div class="flex items-center">
        <div class="text-2xl font-bold text-gray-400 mr-4 w-8">
          ${medal || (index + 1)}
        </div>
        <div>
          <h5 class="font-bold text-gray-900">${player.player_first_name} ${player.player_last_name}</h5>
          <p class="text-sm text-gray-600">${teamInfo}</p>
          <p class="text-xs text-gray-500">${player.first_year} - ${player.last_year}</p>
        </div>
      </div>
      <div class="text-right">
        <div class="text-2xl font-bold text-afl-blue">${player.stat_value.toLocaleString()}</div>
        <div class="text-sm text-gray-500">
          ${player.games_played} games
        </div>
        <div class="text-sm text-gray-500">
          ${parseFloat(player.avg_per_game).toFixed(1)} avg
        </div>
      </div>
    `;
    
    modalTop10.appendChild(playerCard);
  });
  
  statModal.classList.remove('hidden');
}

function closeStatModal() {
  statModal.classList.add('hidden');
}

// Event listeners
closeModalButton.addEventListener('click', closeStatModal);
statModal.addEventListener('click', (e) => {
  if (e.target === statModal) {
    closeStatModal();
  }
});

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !statModal.classList.contains('hidden')) {
    closeStatModal();
  }
});

// Initialize page
loadHallOfRecords();