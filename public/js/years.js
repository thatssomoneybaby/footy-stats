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
  'Adelaide':              ['--adelaide-dark-blue',  '--adelaide-yellow'],
  'Brisbane':              ['--brisbane-dark-pink', '--brisbane-deep-yellow'],
  'Brisbane Bears':        ['--brisbane-dark-pink', '--brisbane-deep-yellow'],
  'Brisbane Lions':        ['--brisbane-dark-pink', '--brisbane-deep-yellow'],
  'Carlton':               ['--carlton-dark-navy',  '--carlton-white'],
  'Collingwood':           ['--collingwood-black',  '--collingwood-white'],
  'Essendon':              ['--essendon-black',       '--essendon-red'],
  'Fremantle':             ['--fremantle-purple',   '--fremantle-gray'],
  'Geelong':               ['--geelong-dark-blue',  '--geelong-white'],
  'Gold Coast':            ['--goldcoast-red',      '--goldcoast-yellow'],
  'Greater Western Sydney':['--gws-charcoal',         '--gws-orange'],
  'Hawthorn':              ['--hawthorn-brown',     '--hawthorn-yellow'],
  'Melbourne':             ['--melbourne-dark-blue','--melbourne-red'],
  'North Melbourne':       ['--north-blue',         '--north-white'],
  'Port Adelaide':         ['--portadelaide-black', '--portadelaide-blue'],
  'Richmond':              ['--richmond-yellow',    '--richmond-black'],
  'St Kilda':              ['--stkilda-black',        '--stkilda-red'],
  'Sydney':                ['--sydney-red',         '--sydney-white'],
  'West Coast':            ['--westcoast-blue',     '--westcoast-yellow'],
  'Western Bulldogs':      ['--bulldogs-blue',      '--bulldogs-white'],
  'Footscray':             ['--bulldogs-blue',      '--bulldogs-white'],
  'Fitzroy':               ['--fitzroy-blue',        '--fitzroy-yellow'],
  'University':            ['--university-black',    '--university-blue']
};

function teamColours(team) {
  const [bgVar, textVar] = TEAM_COLOURS[team] || ['--neutral-bg', '--neutral-text'];
  return { bgVar, textVar };
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

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col md:flex-row gap-10 mb-6 md:items-start';

  const ladder = buildLadderTable(ladderRows);
  ladder.classList.add('flex-shrink-0');

  const tiles = buildSummaryTiles(summary);

  wrapper.appendChild(ladder);
  wrapper.appendChild(tiles);
  matchesTable.appendChild(wrapper);

  // round buttons
  const roundsDiv = document.createElement('div');
  roundsDiv.className = 'flex flex-wrap gap-2 mb-4 px-4';
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
  div.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4';

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
    ${tile('Top Kicks',
           s.top_kicks_player
             ? `${s.top_kicks_player}<br><span class="text-sm font-medium">${s.top_kicks_total}</span>`
             : '—',
           'gray-700', 'gray', s.top_kicks_team)}
    ${tile('Top Handballs',
           s.top_handballs_player
             ? `${s.top_handballs_player}<br><span class="text-sm font-medium">${s.top_handballs_total}</span>`
             : '—',
           'gray-700', 'gray', s.top_handballs_team)}
    ${tile('Top Marks',
           s.top_marks_player
             ? `${s.top_marks_player}<br><span class="text-sm font-medium">${s.top_marks_total}</span>`
             : '—',
           'gray-700', 'gray', s.top_marks_team)}
    ${tile('Top Tackles',
           s.top_tackles_player
             ? `${s.top_tackles_player}<br><span class="text-sm font-medium">${s.top_tackles_total}</span>`
             : '—',
           'gray-700', 'gray', s.top_tackles_team)}
  `;
  return div;
}

function tile(label, value, defaultTxtColour = 'gray-700', defaultBgShade = 'gray', team = null) {
  let classes = 'p-3 rounded-lg flex flex-col items-center justify-center text-center';
  let style   = '';

  if (team) {
    const { bgVar, textVar } = teamColours(team);
    style = `style="background: var(${bgVar}); color: var(${textVar});"`;
  } else {
    classes += ` bg-${defaultBgShade}-50 text-${defaultTxtColour}`;
  }

  return `
    <div class="${classes}" ${style}>
      <p class="font-medium mb-1">${label}</p>
      <p class="text-2xl font-bold leading-none">${value}</p>
    </div>`;
}

/* ------------------------------------------------------------------
   Ladder table builder
------------------------------------------------------------------ */
function buildLadderTable(rows) {
  const table = document.createElement('table');
  // make the ladder a bit wider and allow it to stretch to the same height as the tile stack
  table.className = 'text-xs mb-4 w-80 md:w-96 bg-white shadow rounded-lg self-stretch';

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