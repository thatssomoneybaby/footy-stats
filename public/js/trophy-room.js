import { getTrophyRoom } from './api.js';

const loading = document.getElementById('loading');
const hallOfRecords = document.getElementById('hall-of-records');
const categoryTabs = document.getElementById('category-tabs');
const categoryTitle = document.getElementById('category-title');
const statsGrid = document.getElementById('stats-grid');
const statModal = document.getElementById('stat-modal');
const modalStatTitle = document.getElementById('modal-stat-title');
const modalTop10 = document.getElementById('modal-top-10');
const closeModalButton = document.getElementById('close-stat-modal');
const landingGoals = document.getElementById('landing-goals');
const landingGames = document.getElementById('landing-games');
const landingDisposals = document.getElementById('landing-disposals');

let leaders = [];
let currentCategory = null;
let categoryStatsMap = {};

const CATEGORY_LABELS = {
  scoring: 'Scoring',
  possession: 'Possession',
  defence: 'Defence',
  ruck: 'Ruck',
  pressure: 'Pressure / Impact',
  impact: 'Pressure / Impact'
};

async function loadTrophyRoom() {
  try {
    leaders = await getTrophyRoom();
    buildCategoryStatsMap();
    renderLandingSection();
    renderCategoryTabs();

    const defaultCategory = Object.keys(categoryStatsMap).find(c => c === 'scoring') || Object.keys(categoryStatsMap)[0];
    if (defaultCategory) showCategory(defaultCategory);

    loading.classList.add('hidden');
    hallOfRecords.classList.remove('hidden');
  } catch (error) {
    console.error('Error loading Trophy Room:', error);
    loading.innerHTML = `<p class="text-red-600">Error loading Trophy Room: ${error.message}. Please try again.</p>`;
  }
}

function renderCategoryTabs() {
  categoryTabs.innerHTML = '';
  const categories = Object.keys(categoryStatsMap);
  categories.forEach(categoryName => {
    const tabButton = document.createElement('button');
    tabButton.className = 'px-4 py-2 rounded-lg font-medium transition-colors bg-white border border-gray-300 hover:bg-gray-100';
    tabButton.textContent = CATEGORY_LABELS[categoryName] || categoryName;
    tabButton.addEventListener('click', () => showCategory(categoryName));
    categoryTabs.appendChild(tabButton);
  });
}

function showCategory(categoryName) {
  currentCategory = categoryName;
  if (categoryTitle) categoryTitle.textContent = CATEGORY_LABELS[categoryName] || categoryName;
  const groups = categoryStatsMap[categoryName] || [];
  renderStatsGrid(groups);
}

function showStatModal(stat) {
  modalStatTitle.textContent = `${stat.stat_label} – Top 10 All-Time`;
  modalTop10.innerHTML = '';

  stat.rows.slice(0, 10).forEach((row, index) => {
    const tr = document.createElement('tr');
    const perGame = row.avg_per_game != null ? Number(row.avg_per_game).toFixed(2) : '-';
    tr.innerHTML = `
      <td class="px-3 py-2">${index + 1}</td>
      <td class="px-3 py-2">${row.player_name}</td>
      <td class="px-3 py-2">${row.primary_team || ''}</td>
      <td class="px-3 py-2 text-right">${row.games_played}</td>
      <td class="px-3 py-2 text-right">${row.stat_value}</td>
      <td class="px-3 py-2 text-right">${perGame}</td>
    `;
    modalTop10.appendChild(tr);
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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !statModal.classList.contains('hidden')) {
    closeStatModal();
  }
});

function getHeadlineLeaders(statKey) {
  return leaders.filter(r => String(r.stat_key || '').toLowerCase() === statKey);
}

function renderLandingSection() {
  renderLandingTable(landingGoals, getHeadlineLeaders('goals'));
  renderLandingTable(landingGames, getHeadlineLeaders('games'));
  renderLandingTable(landingDisposals, getHeadlineLeaders('disposals'));
  wireLandingButtons();
}

function renderLandingTable(container, rows) {
  if (!container) return;
  const tbody = container.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  rows.slice(0, 10).forEach((row, index) => {
    const tr = document.createElement('tr');
    const perGame = row.avg_per_game != null ? Number(row.avg_per_game).toFixed(2) : '-';
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="player">${row.player_name}</td>
      <td class="team">${row.primary_team || ''}</td>
      <td class="games num">${row.games_played}</td>
      <td class="num">${row.stat_value}</td>
      <td class="per-game num">${perGame}</td>
    `;
    tbody.appendChild(tr);
  });
}

function wireLandingButtons() {
  document.querySelectorAll('.leader-card .view-top10').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = String(btn.dataset.stat || '').toLowerCase();
      const rows = leaders.filter(r => String(r.stat_key || '').toLowerCase() === key);
      if (!rows || rows.length === 0) return;
      const stat = {
        stat_key: key,
        stat_label: rows[0].stat_label || `Top 10 ${key}`,
        rows
      };
      showStatModal(stat);
    });
  });
}

function buildCategoryStatsMap() {
  const allowed = new Set(['scoring', 'possession', 'defence', 'ruck', 'pressure', 'impact']);
  const map = {};
  for (const row of leaders) {
    const category = String(row.category || '').toLowerCase();
    if (!allowed.has(category)) continue;
    if (!map[category]) map[category] = {};
    const key = row.stat_key;
    if (!map[category][key]) {
      map[category][key] = { stat_key: key, stat_label: row.stat_label, rows: [] };
    }
    map[category][key].rows.push(row);
  }
  Object.keys(map).forEach(cat => {
    categoryStatsMap[cat] = Object.values(map[cat]);
  });
}

function renderStatsGrid(statGroups) {
  statsGrid.innerHTML = '';
  statGroups.forEach(stat => {
    if (!stat.rows || stat.rows.length === 0) return;
    const leader = stat.rows[0];
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-sm border border-gray-200';
    const leaderPerGame = leader.avg_per_game != null ? Number(leader.avg_per_game).toFixed(2) : '-';

    const preview = stat.rows.slice(0, 3).map((row, idx) => {
      const pg = row.avg_per_game != null ? Number(row.avg_per_game).toFixed(2) : '-';
      return `
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">${idx + 1}. ${row.player_name}</span>
          <span class="font-medium">${row.stat_value} (${pg})</span>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-xl font-bold text-gray-900">${stat.stat_label}</h4>
          <button class="view-top10 px-3 py-1 text-sm bg-afl-blue text-white rounded-lg hover:bg-afl-blue-dark">View Top 10</button>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <h5 class="text-2xl font-bold text-afl-blue">${leader.player_name}</h5>
            <p class="text-gray-600 text-sm">${leader.primary_team || ''}</p>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold text-gray-900">${leader.stat_value.toLocaleString()}</div>
            <div class="text-sm text-gray-500">${leader.games_played} games • ${leaderPerGame} avg</div>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100">
          <h6 class="text-sm font-medium text-gray-700 mb-2">Top 3:</h6>
          <div class="space-y-1">${preview}</div>
        </div>
      </div>
    `;

    card.querySelector('.view-top10').addEventListener('click', () => showStatModal(stat));
    statsGrid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', loadTrophyRoom);
