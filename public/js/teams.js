import {
  getTeams,
  getTeamSummary,
  getTeamMatchYears,
  getTeamMatchesByYear
} from './api.js';

/* ------------------------------------------------------------------ */
/*  1.  Colour helpers                                                */
/* ------------------------------------------------------------------ */
const defaultColors = { primary: '--afl-blue', secondary: '--afl-blue-dark' };

const teamColorMap = {
  'Adelaide':              { primary: '--adelaide-light-blue', secondary: '--adelaide-red' },
  'Brisbane':              { primary: '--brisbane-dark-pink',  secondary: '--brisbane-deep-yellow' },
  'Brisbane Bears':        { primary: '--brisbane-dark-pink',  secondary: '--brisbane-deep-yellow' },
  'Brisbane Lions':        { primary: '--brisbane-dark-pink',  secondary: '--brisbane-deep-yellow' },
  'Carlton':               { primary: '--carlton-dark-navy',   secondary: '--carlton-white' },
  'Essendon':              { primary: '--essendon-red',        secondary: '--essendon-black' },
  'Fitzroy':               { primary: '--fitzroy-red',         secondary: '--fitzroy-blue' },
  'Fremantle':             { primary: '--fremantle-indigo',    secondary: '--fremantle-gray' },
  'Geelong':               { primary: '--geelong-dark-blue',   secondary: '--geelong-white' },
  'Gold Coast':            { primary: '--goldcoast-red',       secondary: '--goldcoast-yellow' },
  'GWS':                   { primary: '--gws-orange',          secondary: '--gws-white' },
  'Greater Western Sydney':{ primary: '--gws-orange',          secondary: '--gws-white' },
  'Hawthorn':              { primary: '--hawthorn-brown',      secondary: '--hawthorn-yellow' },
  'Melbourne':             { primary: '--melbourne-dark-blue', secondary: '--melbourne-red' },
  'North Melbourne':       { primary: '--north-blue',          secondary: '--north-white' },
  'Port Adelaide':         { primary: '--portadelaide-black',  secondary: '--portadelaide-blue' },
  'Richmond':              { primary: '--richmond-yellow',     secondary: '--richmond-black' },
  'St Kilda':              { primary: '--stkilda-red',         secondary: '--stkilda-white' },
  'Sydney':                { primary: '--sydney-red',          secondary: '--sydney-white' },
  'West Coast':            { primary: '--westcoast-blue',      secondary: '--westcoast-yellow' },
  'Western Bulldogs':      { primary: '--bulldogs-blue',       secondary: '--bulldogs-white' },
  'Footscray':             { primary: '--bulldogs-blue',       secondary: '--bulldogs-white' },
  'University':            { primary: '--university-blue',     secondary: '--university-black' }
};

function getTeamColors(name) {
  return teamColorMap[name] || defaultColors;
}

function getMedal(i) {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
}

/* ------------------------------------------------------------------ */
/*  2.  DOM look‑ups                                                  */
/* ------------------------------------------------------------------ */
const teamsGrid      = document.getElementById('teams-grid');
const teamDetailsBox = document.getElementById('team-details');
const teamNameH2     = document.getElementById('team-name');
const teamSummaryBox = document.getElementById('team-summary');
const topPerfBox     = document.getElementById('top-performers');
const matchesList    = document.getElementById('matches-list');
const backBtn        = document.getElementById('back-to-teams');

/* ------------------------------------------------------------------ */
let currentTeams = [];
const seasonMatches = {};   // { [season]: MatchRow[] }
/* ------------------------------------------------------------------ */
/*  3.  Page init                                                     */
/* ------------------------------------------------------------------ */
loadTeams();

backBtn.addEventListener('click', () => {
  teamDetailsBox.classList.add('hidden');
  document.querySelector('.max-w-7xl').children[0].style.display = 'block';
});

/* ------------------------------------------------------------------ */
/*  4.  Teams list                                                    */
/* ------------------------------------------------------------------ */
async function loadTeams() {
  try {
    currentTeams = await getTeams();       // RPC: get_teams
    renderTeams(currentTeams);
  } catch (err) {
    console.error(err);
    teamsGrid.innerHTML =
      '<p class="text-red-600">Error loading teams. Please try again.</p>';
  }
}

function renderTeams(teams) {
  teamsGrid.innerHTML = '';

  if (!teams.length) {
    teamsGrid.innerHTML =
      '<p class="text-gray-600 col-span-full text-center">No teams found.</p>';
    return;
  }

  teams.forEach(t => {
    const card   = document.createElement('div');
    const colors = getTeamColors(t.team_name);

    card.style.setProperty('--team-primary',   `var(${colors.primary})`);
    card.style.setProperty('--team-secondary', `var(${colors.secondary})`);

    card.className =
      'p-4 border-2 rounded-lg hover:shadow-lg cursor-pointer ' +
      'transition-all duration-200 transform hover:scale-105';
    card.style.borderColor = `var(${colors.primary})`;
    card.style.background  =
      `linear-gradient(135deg, var(${colors.primary})15, var(${colors.secondary})10)`;

    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-lg" style="color: var(${colors.primary})">
          ${t.team_name}
        </h3>
        <div class="w-4 h-4 rounded-full" style="background: var(${colors.primary})"></div>
      </div>
      <div class="text-sm space-y-2">
        <p class="flex justify-between">
          <span class="font-medium text-gray-700">Years:</span>
          <span class="font-semibold" style="color: var(${colors.primary})">
            ${t.first_season ?? '—'} - ${t.last_season ?? '—'}
          </span>
        </p>
        <p class="flex justify-between">
          <span class="font-medium text-gray-700">Total Matches:</span>
          <span class="font-semibold" style="color: var(${colors.primary})">
            ${t.total_matches}
          </span>
        </p>
      </div>
      <div class="mt-3 pt-3 border-t" style="border-color: var(${colors.primary})30">
        <div class="text-xs text-center font-medium" style="color: var(${colors.primary})">
          Click to view details
        </div>
      </div>
    `;

    card.addEventListener('click', () => loadTeamDetails(t.team_name));
    teamsGrid.appendChild(card);
  });
}

/* ------------------------------------------------------------------ */
/*  5.  Team dashboard                                                */
/* ------------------------------------------------------------------ */
async function loadTeamDetails(team) {
  try {
    const summary = await getTeamSummary(team);   // RPC: team_summary
    if (!summary) {
      console.error('Null summary for', team);
      alert('Sorry — this team summary is unavailable right now.');
      return;
    }
    renderTeamDetails(team, summary);

    // Switch view
    document.querySelector('.max-w-7xl').children[0].style.display = 'none';
    teamDetailsBox.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Error loading team details. Please try again.');
  }
}

function renderTeamDetails(team, d) {
  /* ----- top header ----- */
  teamNameH2.textContent = team;

  /* ----- summary tiles ----- */
  const totalMatches = d.total_matches ?? 0;
  const winPct       = d.win_rate_pct  ?? 0;
  const highScore    = d.highest_score ?? 0;
  const bigWin       = d.biggest_win   ?? 0;
  const premierships = d.grand_finals  ?? 0;

  teamSummaryBox.innerHTML = `
    <div class="bg-blue-50 p-4 rounded-lg">
      <h4 class="font-semibold text-afl-blue mb-1">Total Matches</h4>
      <p class="text-2xl font-bold text-gray-900">${totalMatches}</p>
    </div>
    <div class="bg-green-50 p-4 rounded-lg">
      <h4 class="font-semibold text-green-700 mb-1">Win Rate</h4>
      <p class="text-2xl font-bold text-gray-900">${winPct.toFixed(1)}%</p>
    </div>
    <div class="bg-yellow-50 p-4 rounded-lg">
      <h4 class="font-semibold text-yellow-700 mb-1">Highest Score</h4>
      <p class="text-2xl font-bold text-gray-900">${highScore}</p>
    </div>
    <div class="bg-red-50 p-4 rounded-lg">
      <h4 class="font-semibold text-red-700 mb-1">Biggest Win</h4>
      <p class="text-2xl font-bold text-gray-900">${bigWin} pts</p>
    </div>
    <div class="bg-purple-50 p-4 rounded-lg">
      <h4 class="font-semibold text-purple-700 mb-1">Premierships</h4>
      <p class="text-2xl font-bold text-gray-900">${premierships}</p>
    </div>
  `;

  /* ----- leaderboards ----- */
  topPerfBox.innerHTML =
    makeLeaderboard('🏆 Top 10 Disposal Getters',
                    d.top_disposals || [],
                    'total', 'per_game') +
    makeLeaderboard('⚽ Top 10 Goal Kickers',
                    d.top_goals     || [],
                    'total', 'per_game');

  /* ----- year buttons ----- */
  createTeamYearButtons(team);

  matchesList.innerHTML =
    '<p class="text-gray-600 text-center py-4">Select a year to view matches.</p>';
}

/* helper to render a leaderboard card */
function makeLeaderboard(title, arr, sumKey, avgKey) {
  if (!arr.length) return '';
  return `
    <div class="bg-white border border-gray-200 rounded-lg p-6">
      <h4 class="text-lg font-semibold mb-4">${title}</h4>
      ${arr.map((p, i) => `
        <div class="flex items-center justify-between py-2 ${i < arr.length-1 ? 'border-b border-gray-100' : ''}">
          <div class="flex items-center space-x-3">
            <span class="w-8 text-sm font-medium">${getMedal(i)}</span>
            <div>
              <p class="font-medium">${p.full_name}</p>
              <p class="text-xs text-gray-500">${p.games_played} games</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold">${p[sumKey]}</p>
            <p class="text-xs text-gray-500">${(+p[avgKey]).toFixed(1)}/game</p>
          </div>
        </div>`).join('')}
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  6.  Season/year + round views                                     */
/* ------------------------------------------------------------------ */
async function createTeamYearButtons(team) {
  const teamYearsDiv  = document.getElementById('team-years');
  const teamRoundsDiv = document.getElementById('team-rounds');

  teamYearsDiv.innerHTML  = '';
  teamRoundsDiv.innerHTML = '';
  teamRoundsDiv.classList.add('hidden');

  try {
    const yearRows =
      await getTeamMatchYears(team);   // [{ match_year: 2024 }, …]
    const years =
      yearRows.map(r => r.match_year).sort((a, b) => b - a);

    years.forEach(year => {
      const btn = document.createElement('button');
      btn.textContent =
        year;   // plain year number
      btn.className =
        'px-3 py-1.5 bg-white border border-gray-300 rounded ' +
        'hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';

      btn.onclick = () => {
        document.querySelectorAll('#team-years button').forEach(b =>
          b.className =
            'px-3 py-1.5 bg-white border border-gray-300 rounded ' +
            'hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700'
        );
        btn.className =
          'px-3 py-1.5 bg-afl-blue text-white border border-afl-blue rounded ' +
          'text-sm font-medium';

        showTeamRounds(team, year);
      };

      teamYearsDiv.appendChild(btn);
    });
  } catch (err) {
    console.error('Year list error', err);
    teamYearsDiv.innerHTML =
      '<p class="text-red-600">Failed to load years.</p>';
  }
}

async function showTeamRounds(team, year) {
  const teamRoundsDiv = document.getElementById('team-rounds');
  matchesList.innerHTML =
    '<p class="text-gray-600 text-center py-4">Loading…</p>';

  if (!seasonMatches[year]) {
    try {
      seasonMatches[year] =
        await getTeamMatchesByYear(team, year);  // RPC team_matches
    } catch (err) {
      console.error('Match fetch error', err);
      matchesList.innerHTML =
        '<p class="text-red-600 text-center py-4">Failed to load matches.</p>';
      return;
    }
  }

  const yearGames = seasonMatches[year];
  const rounds = [...new Set(yearGames.map(g => g.round))].sort((a, b) => {
    const aInt = parseInt(a), bInt = parseInt(b);
    if (!isNaN(aInt) && !isNaN(bInt)) return aInt - bInt;
    if (!isNaN(aInt)) return -1;
    if (!isNaN(bInt)) return 1;
    return a.localeCompare(b);
  });

  teamRoundsDiv.innerHTML = '';
  teamRoundsDiv.classList.remove('hidden');

  rounds.forEach(r => {
    const btn = document.createElement('button');
    btn.textContent = `Round ${r}`;
    btn.className =
      'px-3 py-1.5 bg-white border border-gray-300 rounded ' +
      'hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';
    btn.onclick = () => {
      document.querySelectorAll('#team-rounds button').forEach(b =>
        b.className =
          'px-3 py-1.5 bg-white border border-gray-300 rounded ' +
          'hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700'
      );
      btn.className =
        'px-3 py-1.5 bg-afl-blue text-white border border-afl-blue rounded ' +
        'text-sm font-medium';

      showTeamGames(team, year, r);
    };
    teamRoundsDiv.appendChild(btn);
  });

  matchesList.innerHTML =
    '<p class="text-gray-600 text-center py-4">Select a round to view matches.</p>';
}

function showTeamGames(team, year, round) {
  const games = (seasonMatches[year] || []).filter(g => g.round === round);
  matchesList.innerHTML = '';

  if (!games.length) {
    matchesList.innerHTML =
      '<p class="text-gray-600 text-center py-4">No games found for this round.</p>';
    return;
  }

  games.forEach(g => {
    const isHome        = g.match_home_team === team;
    const opponent      = isHome ? g.match_away_team : g.match_home_team;
    const teamScore     = isHome ? g.team_score : g.opp_score;
    const opponentScore = isHome ? g.opp_score : g.team_score;
    const result        = g.result;
    const resultColor   = result === 'W' ? 'text-green-600' : 'text-red-600';
    const homeAway      = isHome ? 'HOME' : 'AWAY';

    const div = document.createElement('div');
    div.className =
      'p-4 border border-gray-200 rounded-lg bg-gray-50';

    div.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="text-center">
            <span class="font-bold ${resultColor} text-2xl">${result}</span>
            <p class="text-xs text-gray-500">${homeAway}</p>
          </div>
          <div>
            <p class="font-medium text-gray-900">vs ${opponent}</p>
            <p class="text-sm text-gray-600">${g.match_date} - Round ${g.round}</p>
            <p class="text-sm text-gray-600">${g.venue ?? ''}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-semibold text-gray-900 text-lg">
            ${teamScore} - ${opponentScore}
          </p>
          <p class="text-sm text-gray-600">
            Margin: ${Math.abs(g.margin || 0)} pts
          </p>
        </div>
      </div>
    `;
    matchesList.appendChild(div);
  });
}