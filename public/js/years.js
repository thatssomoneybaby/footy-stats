

/* ------------------------------------------------------------------
   Years tab logic
   ---------------------------------------------------------------
   Hits RPC-backed endpoints:

     /api/years-all                 → get_years()
     /api/years-summary?year=YYYY   → season_summary()
     /api/season-matches?year=YYYY&rounds=true
     /api/season-matches?year=YYYY[&round=RX]

   Helper wrappers are imported from public/js/api.js
------------------------------------------------------------------ */

import {
  getYears,
  getSeasonSummary,
  getRoundsForYear,
  getSeasonMatches
} from './api.js';

/* ------------------------------------------------------------------
   DOM elements
------------------------------------------------------------------ */
const yearBar      = document.getElementById('year-bar');
const seasonTitle  = document.getElementById('season-title');
const matchesTable = document.getElementById('matches-table');

/* ------------------------------------------------------------------
   State holders
------------------------------------------------------------------ */
let currentYear  = null;
const roundsCache  = {};  // { [year]: ['R1','R2',...]}
const matchesCache = {};  // { [year]: [match,row...] }

/* ------------------------------------------------------------------
   Boot
------------------------------------------------------------------ */
loadYears();

/* ------------------------------------------------------------------
   Load all seasons and render buttons
------------------------------------------------------------------ */
async function loadYears() {
  const years = await getYears();  // [{ season, total_matches }]
  if (!years.length) {
    yearBar.innerHTML =
      '<p class="text-red-600">Failed to load seasons.</p>';
    return;
  }

  years.forEach(({ season }) => {
    const btn = document.createElement('button');
    btn.textContent = season;
    btn.className =
      'px-3 py-1.5 bg-white border border-gray-300 rounded ' +
      'hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';

    btn.onclick = () => {
      [...yearBar.children].forEach(b => b.className =
        'px-3 py-1.5 bg-white border border-gray-300 rounded ' +
        'hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700');
      btn.className =
        'px-3 py-1.5 bg-afl-blue text-white border border-afl-blue rounded text-sm font-medium';
      loadSeason(season);
    };

    yearBar.appendChild(btn);
  });
}

/* ------------------------------------------------------------------
   Fetch summary + rounds
------------------------------------------------------------------ */
async function loadSeason(year) {
  currentYear = year;
  seasonTitle.textContent = `Season ${year}`;
  matchesTable.innerHTML =
    '<p class="text-gray-600 py-4">Loading season data…</p>';

  const [summary, rounds] = await Promise.all([
    getSeasonSummary(year),
    roundsCache[year] ? Promise.resolve(roundsCache[year])
                      : getRoundsForYear(year)
  ]);

  if (!summary) {
    matchesTable.innerHTML =
      '<p class="text-red-600">Failed to load season summary.</p>';
    return;
  }
  roundsCache[year] = rounds;
  renderSeason(summary, rounds.map(r => r.round));
}

/* ------------------------------------------------------------------
   Render tiles + round buttons
------------------------------------------------------------------ */
function renderSeason(summary, rounds) {
  matchesTable.innerHTML = '';

  // summary tiles
  matchesTable.appendChild(buildSummaryTiles(summary));

  // round buttons
  const roundsDiv = document.createElement('div');
  roundsDiv.className = 'flex flex-wrap gap-2 mb-4';
  rounds.forEach(r => {
    const btn = document.createElement('button');
    btn.textContent = r;
    btn.className =
      'px-2.5 py-1 bg-white border border-gray-300 rounded text-xs ' +
      'hover:bg-gray-50 transition-colors';

    btn.onclick = () => {
      [...roundsDiv.children].forEach(b => b.className =
        'px-2.5 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50 transition-colors');
      btn.className =
        'px-2.5 py-1 bg-afl-blue text-white border border-afl-blue rounded text-xs';
      loadSeasonMatches(currentYear, r);
    };
    roundsDiv.appendChild(btn);
  });
  matchesTable.appendChild(roundsDiv);

  // placeholder for match list
  const list = document.createElement('div');
  list.id = 'matches-list';
  list.innerHTML =
    '<p class="text-gray-600 py-4">Select a round to view matches.</p>';
  matchesTable.appendChild(list);
}

function buildSummaryTiles(s) {
  const div = document.createElement('div');
  div.className = 'grid grid-cols-2 md:grid-cols-5 gap-4 mb-6';
  div.innerHTML = `
    ${tile('Matches',          s.total_matches, 'afl-blue')}
    ${tile('Avg Score',        s.avg_game_score, 'green-700', 'green')}
    ${tile('Highest Score',    s.highest_score, 'yellow-700', 'yellow')}
    ${tile('Biggest Margin',   s.biggest_margin, 'purple-700', 'purple')}
    ${tile('Premiers',         s.premiers ?? '—', 'red-700', 'red', 'text-xl')}
  `;
  return div;
}

function tile(label, value, color, shade = 'blue', extra = '') {
  return `
    <div class="bg-${shade}-50 p-4 rounded-lg text-center">
      <p class="font-medium text-${color} mb-1">${label}</p>
      <p class="text-2xl font-bold ${extra}">${value}</p>
    </div>`;
}

/* ------------------------------------------------------------------
   Load matches
------------------------------------------------------------------ */
async function loadSeasonMatches(year, round) {
  const list = document.getElementById('matches-list');
  list.innerHTML = '<p class="text-gray-600 py-4">Loading matches…</p>';

  if (!matchesCache[year])
    matchesCache[year] = await getSeasonMatches(year); // cache once

  const matches = round
    ? matchesCache[year].filter(m => m.round === round)
    : matchesCache[year];

  if (!matches.length) {
    list.innerHTML =
      '<p class="text-gray-600 py-4">No matches found.</p>';
    return;
  }

  list.innerHTML = '';
  matches.forEach(m => list.appendChild(renderMatch(m)));
}

function renderMatch(m) {
  const div = document.createElement('div');
  div.className =
    'p-4 border border-gray-200 rounded-lg bg-gray-50 mb-2';

  div.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex flex-col">
        <span class="font-medium text-gray-900">
          ${m.match_home_team} vs ${m.match_away_team}
        </span>
        <span class="text-xs text-gray-500">
          ${m.match_date} | ${m.venue ?? ''}
        </span>
      </div>
      <div class="text-right">
        <span class="font-semibold text-gray-900">
          ${m.match_home_score} – ${m.match_away_score}
        </span>
        <p class="text-xs text-gray-500">
          Margin ${Math.abs(m.margin)} pts
        </p>
      </div>
    </div>`;
  return div;
}