# Supabase Usage Map

Purpose: single source of truth mapping the frontend UI → API routes → Supabase RPCs/views/tables, plus key fields and behavioral assumptions the UI relies on.

Conventions
- Frontend files: HTML + JS entry points where the feature renders.
- API route: HTTP endpoint and handler file under `api/`.
- Supabase: RPCs first (preferred), then MVs/tables used as fallback.
- Key fields: fields the UI expects in responses (naming must remain stable).
- Behavior: sorting, pagination, limits, opponent derivation, guernsey ordering, etc.

---

## Players

### Players Index (Alphabet)
- Frontend files: `public/players.html`, `public/js/players.js` (loadAlphabet, renderAlphabet)
- API route: `GET /api/players-all?alphabet=true` → handler `api/players-all.js`
- Supabase:
  - RPC: `get_player_alphabet` → returns `{ letter, count }` rows
- Key fields:
  - `letter` (string), `count` (number)
- Behavior:
  - No pagination. UI renders A–Z buttons with counts.

### Players by Letter (Cards Grid)
- Frontend files: `public/players.html`, `public/js/players.js` (loadPlayersForLetter, renderPlayers)
- API route: `GET /api/players-all?letter={A|B|...}` → handler `api/players-all.js`
- Supabase:
  - RPC: `get_players_by_letter`
- Key fields (per player row):
  - Identity: `player_id`, `player_name`, `player_first_name`, `player_last_name`
  - Career span: `first_season`/`last_season` (fallbacks: `first_year`, `last_year`)
  - Totals: `games`/`disposals`/`goals` (fallbacks: `total_games`, `total_disposals`, `total_goals`)
- Behavior:
  - UI computes per-card averages (disposals/goals) from totals ÷ games.
  - Clicking a card opens Player Details modal.

### Player Details Modal
- Frontend files: `public/players.html` (modal), `public/js/players.js` (`showPlayerDetails`, `loadPlayerPage`, `renderPlayerGames`, header + summary)
- API route: `GET /api/players-all?playerId={ID}&page={N}` → handler `api/players-all.js`
- Supabase:
  - RPCs: `get_player_profile`, `get_player_seasons`, `get_player_games` (limit/offset when available)
  - Views (fallbacks):
    - `mv_player_career_totals` (profile)
    - `mv_player_season_totals` (seasons; includes `guernsey_number` per season)
    - `mv_match_player_stats` (games list, and earliest row for `debut`)
- Key fields (API response):
  - `profile`: career totals and metadata
    - `player_id`, `player_name`, `player_first_name`, `player_last_name`
    - `teams` (array), `first_season`, `last_season`, `games`, `goals`, `disposals`, …
    - `guernsey_numbers` (array) — unordered set of jersey numbers (UI orders via seasons)
  - `seasons`: season rows — includes `season`, `team`, `guernsey_number`, season totals
  - `games`: newest → oldest slice (limit=50)
    - Required fields: `match_id`, `match_date`, `match_round`, `venue_name`,
      `match_home_team`, `match_away_team`, `player_team`, derived `opponent`
    - Core stats used in table: `goals`, `behinds`, `disposals`, `kicks`, `handballs`, `marks`, `tackles`, plus modern metrics when present
  - `debut`: earliest match row for the player (independent of pagination)
    - Fields: `match_date`, `match_round`, `venue_name`, `match_home_team`, `match_away_team`, `player_team`
  - `page`, `limit`: pagination state (limit fixed at 50)
- Behavior:
  - Pagination: `limit=50`, `offset=(page-1)*limit`; UI disables Prev when `page===1`, Next when `page*limit >= profile.games`.
  - Range summary: `start=(page-1)*limit+1`, `end=min(page*limit, totalGames)`.
  - Opponent: derived client-side: `player_team === match_home_team ? match_away_team : match_home_team`.
  - Debut: formatted as `DD/MM/YYYY R# vs Opponent @ Venue` from `debut` object.
  - Guernsey ordering: UI sorts `profile.guernsey_numbers` by earliest `season` where each `guernsey_number` appears in `seasons`, then renders `#oldest → #newest`.

---

## Years

### Years list and Season Summary
- Frontend files: `public/years.html`, `public/js/api.js#getYears`, `getSeasonSummary`, `getRoundsForYear`, `getSeasonMatches`, `getSeasonLadder`
- API route: `GET /api/years` (list), `GET /api/years?year={YYYY}` (summary), `&rounds=true`, `&matches=true`, `&ladder=true`
- Handler: `api/years.js`
- Supabase:
  - RPCs: `get_years`, `season_summary`, `get_rounds_for_year`, `season_ladder`, `season_matches`
- Key fields:
  - Years: `{ match_year }`
  - Summary: season aggregates for the year
  - Rounds: list of round labels
  - Matches: array of match objects per season/round
  - Ladder: `{ team, wins, losses, draws, percentage, ladder_pos }`
- Behavior:
  - Season matches sorted by date; round filter supported.

---

## Teams

### Teams list and Team Summary
- Frontend files: `public/teams.html`, `public/js/api.js#getTeams`, `getTeamSummary`
- API route: `GET /api/teams-all` (list), `GET /api/teams-all?teamName={Name}` (summary)
- Handler: `api/teams-all.js`
- Supabase:
  - RPC: `get_teams`
  - Views: `mv_team_player_careers`, `mv_season_matches` (various selects to build summary, seasons, records)
- Key fields:
  - Team meta, player careers, season match aggregates, finals/premierships (derived)
- Behavior:
  - Derived fields for premiership years based on finals/GF rows.

### Team Matches by Year
- Frontend files: `public/js/api.js#getTeamMatchesByYear`
- API route: `GET /api/team-matches?team={Name}&year={YYYY}`
- Handler: `api/team-matches.js`
- Supabase:
  - RPC: `team_matches`
- Key fields: match schedule rows for that team/year
- Behavior: sorted by date.

### Team Match Years
- Frontend files: `public/js/api.js#getTeamMatchYears`
- API route: `GET /api/team-match-years?team={Name}`
- Handler: `api/team-match-years.js`
- Supabase:
  - RPC: `get_team_match_years`
- Key fields: `{ match_year }[]` – distinct years

---

## Match Details
- Frontend files: `public/js/api.js#getMatchById` (consumed by pages showing match detail)
- API route: `GET /api/match/{id}`
- Handler: `api/match/[id].js`
- Supabase:
  - RPC: `get_match_players` (players + stats for the match)
- Key fields: player rows + match meta fields used by UI tables.

---

## Head-to-Head
- Frontend files: `public/js/api.js#getHeadToHead`
- API route: `GET /api/head-to-head/{home}/{away}`
- Handler: `api/head-to-head/[home]/[away].js`
- Supabase:
  - RPCs: `count_head_to_head`, `head_to_head_summary`, `head_to_head_last_meeting_players`
  - View: `mv_season_matches` (to collect meetings)
- Key fields:
  - Counts, recent meetings, and top player stats from last meeting
- Behavior:
  - Dedupes matches by `{ season, round_label }` for head-to-head list.

---

## Stats: Trophy Room / Hall of Records / Insights
- Frontend files: `public/js/api.js#getTrophyRoom`, `getHallOfRecords`, `getInsights` (rendered in `trophy-room.html` and elsewhere)
- API route: `GET /api/stats-all?type=trophy-room | hall-of-records | insights`
- Handler: `api/stats-all.js`
- Supabase:
  - RPCs: `trophy_room_career_leaders`, `hall_of_records_season_leaders`
  - View: `mv_season_matches` (for additional insights when present)
- Key fields:
  - Leaderboards for career/season categories; stat-specific shapes
- Behavior:
  - Limit parameters (e.g., `p_limit=10`) used to bound leaderboards.

---

## Live/Upcoming
- Frontend files: `public/js/api.js#getUpcomingGames`
- API route: `GET /api/upcoming-games`
- Handler: `api/upcoming-games.js`
- Supabase: (not using Supabase directly; source may be external feed or precomputed table)
- Key fields: upcoming matches (date, teams, venue)

---

## Cross-Cutting Assumptions
- Date/time: API returns ISO dates; UI formats with `toLocaleDateString('en-AU')`.
- Opponent derivation: UI requires `match_home_team`, `match_away_team`, `player_team`.
- Pagination (players’ games): `limit=50`, `offset=(page-1)*limit`. UI disables Prev at page 1; Next when `page*limit >= totalGames`.
- Guernsey numbers: `profile.guernsey_numbers` is treated as an unordered set; UI orders by earliest `season` in `seasons` where the number appears.
- Sorting: Players table headers are clickable; client-side sorting across the currently loaded slice.

