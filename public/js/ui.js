const friendlyNames = {
  venue_name: "Venue",
  match_id: "Match ID",
  match_home_team: "Home Team",
  match_away_team: "Away Team",
  match_date: "Date",
  match_local_time: "Time",
  match_attendance: "Attendance",
  match_round: "Round",
  match_home_team_goals: "Goals (Home)",
  match_home_team_behinds: "Behinds (Home)",
  match_home_team_score: "Score (Home)",
  match_away_team_goals: "Goals (Away)",
  match_away_team_behinds: "Behinds (Away)",
  match_away_team_score: "Score (Away)",
  match_margin: "Margin",
  match_winner: "Winner",
  match_weather_temp_c: "Weather Temp (°C)",
  match_weather_type: "Weather Type",
  player_id: "Player ID",
  player_first_name: "First Name",
  player_last_name: "Last Name",
  player_height_cm: "Height (cm)",
  player_weight_kg: "Weight (kg)",
  player_is_retired: "Retired?",
  player_team: "Player Team",
  guernsey_number: "Guernsey #",
  kicks: "Kicks",
  marks: "Marks",
  handballs: "Handballs",
  disposals: "Disposals",
  effective_disposals: "Eff. Disposals",
  disposal_efficiency_percentage: "Disposal Efficiency %",
  goals: "Goals",
  behinds: "Behinds",
  hitouts: "Hitouts",
  tackles: "Tackles",
  rebounds: "Rebounds",
  inside_fifties: "Inside 50s",
  clearances: "Clearances",
  clangers: "Clangers",
  free_kicks_for: "Frees For",
  free_kicks_against: "Frees Against",
  brownlow_votes: "Brownlow Votes",
  contested_possessions: "Contested Possessions",
  uncontested_possessions: "Uncontested Possessions",
  contested_marks: "Contested Marks",
  marks_inside_fifty: "Marks Inside 50",
  one_percenters: "One Percenters",
  bounces: "Bounces",
  goal_assists: "Goal Assists",
  time_on_ground_percentage: "Time on Ground %",
  afl_fantasy_score: "AFL Fantasy",
  supercoach_score: "SuperCoach",
  centre_clearances: "Centre Clearances",
  stoppage_clearances: "Stoppage Clearances",
  score_involvements: "Score Involvements",
  metres_gained: "Metres Gained",
  turnovers: "Turnovers",
  intercepts: "Intercepts",
  tackles_inside_fifty: "Tackles Inside 50",
  contest_def_losses: "Defensive Cont. Losses",
  contest_def_one_on_ones: "Def. 1-on-1s",
  contest_off_one_on_ones: "Off. 1-on-1s",
  contest_off_wins: "Offensive Wins",
  def_half_pressure_acts: "Def Half Pressure Acts",
  effective_kicks: "Effective Kicks",
  f50_ground_ball_gets: "F50 GB Gets",
  ground_ball_gets: "Ground Ball Gets",
  hitouts_to_advantage: "Hitouts to Adv.",
  hitout_win_percentage: "Hitout Win %",
  intercept_marks: "Intercept Marks",
  marks_on_lead: "Marks on Lead",
  pressure_acts: "Pressure Acts",
  rating_points: "Rating Points",
  ruck_contests: "Ruck Contests",
  score_launches: "Score Launches",
  shots_at_goal: "Shots at Goal",
  spoils: "Spoils",
  subbed: "Subbed",
  player_position: "Position",
  date: "Date"
};
import { getYears, getMatches, getRounds, getRoundMatches, getMatchById } from './api.js';

let currentSort = { key: null, direction: 'asc' };

const sidebar = document.getElementById('year-bar');  // container for dynamic year buttons
const table = document.getElementById('matches-table');
const seasonTitle = document.getElementById('season-title');

function createSidebar(years) {
  years.forEach(year => {
    const btn = document.createElement('button');
    btn.innerText = year;
    btn.className = 'px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700';
    btn.onclick = async () => {
      document.querySelectorAll('#year-bar button').forEach(b => {
        b.className = 'px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700';
      });
      btn.className = 'px-4 py-2 bg-afl-blue text-white border border-afl-blue rounded-lg font-medium';

      seasonTitle.textContent = `Season ${year}`;
      const rounds = await getRounds(year);
      renderRounds(year, rounds);
    };
    sidebar.appendChild(btn);
  });
}

function renderRounds(year, rounds) {
  table.innerHTML = '';
  if (rounds.length === 0) {
    table.innerHTML = '<p>No rounds found for this year.</p>';
    return;
  }

  // Create rounds grid
  const roundsContainer = document.createElement('div');
  roundsContainer.className = 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6';
  
  rounds.forEach(round => {
    const roundButton = document.createElement('button');
    roundButton.className = 'px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 cursor-pointer';
    roundButton.innerHTML = `
      <div class="font-semibold">${round.match_round}</div>
      <div class="text-sm text-gray-500">${round.match_count} matches</div>
    `;
    roundButton.onclick = async () => {
      // Update button states
      roundsContainer.querySelectorAll('button').forEach(b => {
        b.className = 'px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700';
      });
      roundButton.className = 'px-4 py-2 bg-afl-blue text-white border border-afl-blue rounded-lg font-medium';
      
      // Load matches for this round
      const matches = await getRoundMatches(year, round.match_round);
      renderMatches(matches);
    };
    
    roundsContainer.appendChild(roundButton);
  });
  
  table.appendChild(roundsContainer);
  
  // Add placeholder for matches
  const matchesContainer = document.createElement('div');
  matchesContainer.id = 'matches-container';
  matchesContainer.innerHTML = '<p class="text-center text-gray-500 py-8">Select a round to view matches</p>';
  table.appendChild(matchesContainer);
}

function renderMatches(matches) {
  const matchesContainer = document.getElementById('matches-container');
  matchesContainer.innerHTML = '';
  
  if (matches.length === 0) {
    matchesContainer.innerHTML = '<p class="text-center text-gray-500 py-8">No matches found for this round.</p>';
    return;
  }

  matches.forEach(match => {
    const matchCard = document.createElement('div');
    matchCard.className = 'p-4 bg-white border border-gray-200 rounded-lg mb-4 cursor-pointer hover:cursor-pointer';
    matchCard.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="flex-1">
          <div class="font-semibold flex items-center gap-2">
            <span class="text-xl font-bold text-afl-blue">+</span>
            ${match.match_home_team} vs ${match.match_away_team}
          </div>
          <div class="text-sm text-gray-500">${match.match_date} • ${match.venue_name}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">${match.match_home_team_score} - ${match.match_away_team_score}</div>
          <div class="text-sm text-gray-500">Winner: ${match.match_winner}</div>
        </div>
      </div>
    `;
    // Add onclick event for match details popup
    matchCard.onclick = async () => {
      const matchDetails = await getMatchById(match.match_id);
      if (!matchDetails || matchDetails.length === 0) return;

      // Sort players: home team first (by last name), then away team (by last name)
      const homeTeam = match.match_home_team;
      const awayTeam = match.match_away_team;

      matchDetails.sort((a, b) => {
        if (a.player_team === b.player_team) {
          return a.player_last_name.localeCompare(b.player_last_name);
        }
        if (a.player_team === homeTeam) return -1;
        if (b.player_team === homeTeam) return 1;
        return a.player_team.localeCompare(b.player_team);
      });

      // Remove existing detail if already present
      const existingDetail = matchCard.querySelector('.match-detail');
      if (existingDetail) {
        existingDetail.remove();
        return;
      }

      const detailContainer = document.createElement('div');
      detailContainer.className = 'match-detail mt-4 overflow-auto';

      // Head-to-head summary
      if (match.head_to_head_summary) {
        const summary = match.head_to_head_summary;
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded';
        summaryDiv.innerHTML = `
          <div class="font-semibold mb-1">Head-to-head summary</div>
          <div>
            <span class="font-medium">${match.match_home_team}</span> wins: <span class="text-afl-blue">${summary.homeWins ?? 0}</span> &nbsp; | &nbsp;
            <span class="font-medium">${match.match_away_team}</span> wins: <span class="text-afl-red">${summary.awayWins ?? 0}</span> &nbsp; | &nbsp;
            Total meetings: <span class="text-gray-700">${summary.totalMeetings ?? 0}</span>
          </div>
          <div class="mt-1 text-gray-700">
            Last meeting: ${summary.lastMeetingDate ? summary.lastMeetingDate : 'N/A'}
            &mdash; Score: 
            ${typeof summary.lastHomeScore === 'number' && typeof summary.lastAwayScore === 'number'
              ? `${summary.lastHomeScore} - ${summary.lastAwayScore}`
              : 'N/A'}
          </div>
        `;
        detailContainer.appendChild(summaryDiv);
      }

      const keys = Object.keys(matchDetails[0]).filter(key =>
        matchDetails.some(row => row[key] !== null && row[key] !== '')
      );

      const table = document.createElement('table');
      table.className = 'w-full border-collapse text-sm border border-gray-200';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      keys.forEach(k => {
        const th = document.createElement('th');
        th.textContent = friendlyNames[k] || k;
        th.className = 'border border-gray-300 px-2 py-1 bg-gray-100 text-gray-900 text-left font-medium';
        th.style.cursor = 'pointer';
        th.onclick = () => {
          if (currentSort.key === k) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
          } else {
            currentSort.key = k;
            currentSort.direction = 'asc';
          }

          matchDetails.sort((a, b) => {
            const valA = a[currentSort.key];
            const valB = b[currentSort.key];

            if (valA == null) return 1;
            if (valB == null) return -1;

            if (typeof valA === 'number' && typeof valB === 'number') {
              return currentSort.direction === 'asc' ? valA - valB : valB - valA;
            } else {
              return currentSort.direction === 'asc'
                ? String(valA).localeCompare(String(valB))
                : String(valB).localeCompare(String(valA));
            }
          });

          // Re-render table body
          tbody.innerHTML = '';
          matchDetails.forEach(player => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            keys.forEach(k => {
              const td = document.createElement('td');
              td.textContent = player[k] ?? '';
              td.className = 'border border-gray-300 px-2 py-1 text-gray-700';
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
        };
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      matchDetails.forEach(player => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        keys.forEach(k => {
          const td = document.createElement('td');
          td.textContent = player[k] ?? '';
          td.className = 'border border-gray-300 px-2 py-1 text-gray-700';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      detailContainer.appendChild(table);
      matchCard.appendChild(detailContainer);
    };
    matchesContainer.appendChild(matchCard);
  });
}

function renderTable(matches) {
  table.innerHTML = '';
  if (matches.length === 0) {
    table.innerHTML = '<p>No matches found.</p>';
    return;
  }

  const uniqueMatches = {};
  matches.forEach(row => {
    if (!uniqueMatches[row.match_id]) {
      uniqueMatches[row.match_id] = {
        meta: row,
        players: []
      };
    }
    uniqueMatches[row.match_id].players.push(row);
  });

  const roundGroups = {};
  Object.values(uniqueMatches).forEach(({ meta, players }) => {
    if (!roundGroups[meta.match_round]) {
      roundGroups[meta.match_round] = [];
    }
    roundGroups[meta.match_round].push({ meta, players });
  });

  // Clear previous round buttons
  const existingRounds = document.getElementById('round-buttons');
  if (existingRounds) existingRounds.remove();

  const roundButtonsContainer = document.createElement('div');
  roundButtonsContainer.id = 'round-buttons';
  roundButtonsContainer.className = 'flex flex-wrap gap-2 mb-6';

  Object.keys(roundGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(round => {
    const btn = document.createElement('button');
    btn.textContent = `Round ${round}`;
    btn.className = 'px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';
    btn.onclick = () => {
      document.querySelectorAll('#round-buttons button').forEach(b => {
        b.className = 'px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700';
      });
      btn.className = 'px-3 py-1.5 bg-afl-blue text-white border border-afl-blue rounded text-sm font-medium';
      renderRound(roundGroups[round]);
    };
    roundButtonsContainer.appendChild(btn);
  });

  table.parentElement.insertBefore(roundButtonsContainer, table);
}

function renderRound(roundMatches) {
  table.innerHTML = '';
  const tbl = document.createElement('table');
  tbl.className = 'w-full border-collapse mt-4 bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200';

  roundMatches.forEach(({ meta, players }) => {
    const summaryRow = document.createElement('tr');
    summaryRow.className = 'bg-gray-50 hover:bg-gray-100 cursor-pointer border-b border-gray-200';

    const summaryCell = document.createElement('td');
    summaryCell.colSpan = 100;
    summaryCell.className = 'p-4 font-medium text-gray-900';
    const homeScore = `${meta.match_home_team_goals}.${meta.match_home_team_behinds}.${meta.match_home_team_score}`;
    const awayScore = `${meta.match_away_team_goals}.${meta.match_away_team_behinds}.${meta.match_away_team_score}`;
    summaryCell.textContent = `Round ${meta.match_round}: ${meta.match_home_team} ${homeScore} vs ${meta.match_away_team} ${awayScore} (${meta.match_date})`;
    summaryRow.appendChild(summaryCell);

    const detailRow = document.createElement('tr');
    detailRow.classList.add('detail-row');
    const detailCell = document.createElement('td');
    detailCell.colSpan = 100;
    detailCell.style.display = 'none';

    const detailTable = document.createElement('table');
    detailTable.className = 'w-full border-collapse mt-2 text-sm';

    const allKeys = Object.keys(players[0]);
    const nonEmptyKeys = allKeys.filter(key =>
      players.some(row => row[key] !== null && row[key] !== undefined && row[key] !== '')
    );

    const headerRow = document.createElement('tr');
    nonEmptyKeys.forEach(h => {
      const th = document.createElement('th');
      th.textContent = friendlyNames[h] || h;
      th.className = 'border border-gray-300 px-2 py-1 bg-gray-100 text-gray-900 text-left font-medium';
      headerRow.appendChild(th);
    });
    detailTable.appendChild(headerRow);

    players.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50';
      nonEmptyKeys.forEach(h => {
        const td = document.createElement('td');
        td.textContent = row[h];
        td.className = 'border border-gray-300 px-2 py-1 text-gray-700';
        tr.appendChild(td);
      });
      detailTable.appendChild(tr);
    });

    detailCell.appendChild(detailTable);
    detailRow.appendChild(detailCell);
    summaryRow.addEventListener('click', () => {
      detailCell.style.display = detailCell.style.display === 'none' ? 'table-cell' : 'none';
    });

    tbl.appendChild(summaryRow);
    tbl.appendChild(detailRow);
  });

  table.appendChild(tbl);
}

// Load everything on page load
getYears().then(createSidebar);