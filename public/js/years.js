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
  getSeasonMatches,
  getSeasonLadder
} from './api.js';

/* ------------------------------------------------------------------
   Team colour helpers
------------------------------------------------------------------ */
// Mapping: team name → [background CSS var, text CSS var]
const TEAM_COLOURS = {
  'Adelaide':            ['var(--adelaide-bg)',            'var(--adelaide-text)'],
  'Brisbane':            ['var(--brisbane-bg)',            'var(--brisbane-text)'],
  'Carlton':             ['var(--carlton-bg)',             'var(--carlton-text)'],
  'Collingwood':         ['var(--collingwood-bg)',         'var(--collingwood-text)'],
  'Essendon':            ['var(--essendon-bg)',            'var(--essendon-text)'],
  'Fremantle':           ['var(--fremantle-bg)',           'var(--fremantle-text)'],
  'Geelong':             ['var(--geelong-bg)',             'var(--geelong-text)'],
  'Gold Coast':          ['var(--goldcoast-bg)',           'var(--goldcoast-text)'],
  'Greater Western Sydney': ['var(--gws-bg)',              'var(--gws-text)'],
  'Hawthorn':            ['var(--hawthorn-bg)',            'var(--hawthorn-text)'],
  'Melbourne':           ['var(--melbourne-bg)',           'var(--melbourne-text)'],
  'North Melbourne':     ['var(--northmelbourne-bg)',      'var(--northmelbourne-text)'],
  'Port Adelaide':       ['var(--portadelaide-bg)',        'var(--portadelaide-text)'],
  'Richmond':            ['var(--richmond-bg)',            'var(--richmond-text)'],
  'St Kilda':            ['var(--stkilda-bg)',             'var(--stkilda-text)'],
  'Sydney':              ['var(--sydney-bg)',              'var(--sydney-text)'],
  'West Coast':          ['var(--westcoast-bg)',           'var(--westcoast-text)'],
  'Western Bulldogs':    ['var(--westernbulldogs-bg)',     'var(--westernbulldogs-text)']
};

function teamColours(team) {
  return TEAM_COLOURS[team] || ['var(--neutral-bg)', 'var(--neutral-text)'];
}

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
   Fetch summary + rounds + ladder
------------------------------------------------------------------ */
async function loadSeason(year) {
  currentYear = year;
  seasonTitle.textContent = `Season ${year}`;
  matchesTable.innerHTML =
    '<p class="text-gray-600 py-4">Loading season data…</p>';

  const [summary, rounds, ladder] = await Promise.all([
    getSeasonSummary(year),
    roundsCache[year] ? Promise.resolve(roundsCache[year])
                      : getRoundsForYear(year),
    getSeasonLadder(year)
  ]);

  if (!summary) {
    matchesTable.innerHTML =
      '<p class="text-red-600">Failed to load season summary.</p>';
    return;
  }
  roundsCache[year] = rounds;
  renderSeason(summary, ladder, rounds.map(r => r.round));
}

/* ------------------------------------------------------------------
   Render tiles + ladder + round buttons
------------------------------------------------------------------ */
function renderSeason(summary, ladderRows, rounds) {
  matchesTable.innerHTML = '';

  // ladder table
  matchesTable.appendChild(buildLadderTable(ladderRows));

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
  // 7 tiles on desktop, 2 on mobile
  div.className = 'grid grid-cols-2 md:grid-cols-7 gap-4 mb-6';

  div.innerHTML = `
    ${tile('Matches',           s.total_matches,      'afl-blue')}
    ${tile('Avg Score',         s.avg_game_score,     'green-700',  'green')}
    ${tile('Highest Score',     s.highest_score,      'yellow-700', 'yellow')}
    ${tile('Biggest Margin',    s.biggest_margin,     'purple-700', 'purple')}
    ${tile('Premiers',          s.premiers ?? '—',    'red-700',    'red', s.premiers)}
    ${tile('Top Goals',         s.top_goals_player
                                  ? `${s.top_goals_player}<br><span class="text-sm font-medium">${s.top_goals_total}</span>`
                                  : '—',
                                  'gray-700', 'gray', s.top_goals_team)}
    ${tile('Top Disposals',     s.top_disposals_player
                                  ? `${s.top_disposals_player}<br><span class="text-sm font-medium">${s.top_disposals_total}</span>`
                                  : '—',
                                  'gray-700', 'gray', s.top_disposals_team)}
  `;
  return div;
}

function tile(label, value, defaultTxtColour = 'gray-700', defaultBgShade = 'gray', team = null) {
  // Determine colours – use team palette if supplied, else fallback shades
  let bg, txt;
  if (team) {
    [bg, txt] = teamColours(team);                     // CSS var colours
  } else {
    bg  = `bg-${defaultBgShade}-50`;
    txt = `text-${defaultTxtColour}`;
  }

  return `
    <div class="${bg} p-4 rounded-lg flex flex-col items-center justify-center text-center">
      <p class="font-medium ${txt} mb-1">${label}</p>
      <p class="text-2xl font-bold">${value}</p>
    </div>`;
}

/* ------------------------------------------------------------------
   Ladder table builder
------------------------------------------------------------------ */
function buildLadderTable(rows) {
  const table = document.createElement('table');
  table.className = 'w-auto text-xs mb-4 mx-auto';

  table.innerHTML = `
    <thead>
      <tr class="text-left bg-gray-100">
        <th class="py-1 px-2">#</th>
        <th class="py-1 px-2">Team</th>
        <th class="py-1 px-2 text-right">W</th>
        <th class="py-1 px-2 text-right">L</th>
        <th class="py-1 px-2 text-right">D</th>
        <th class="py-1 px-2 text-right">%</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          r => `<tr class="border-t">
              <td class="py-0.5 px-2">${r.ladder_pos}</td>
              <td class="py-0.5 px-2">${r.team}</td>
              <td class="py-0.5 px-2 text-right">${r.wins}</td>
              <td class="py-0.5 px-2 text-right">${r.losses}</td>
              <td class="py-0.5 px-2 text-right">${r.draws}</td>
              <td class="py-0.5 px-2 text-right">${r.percentage}</td>
            </tr>`
        )
        .join('')}
    </tbody>
  `;
  return table;
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