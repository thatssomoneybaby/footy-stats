# API Endpoints Used by Frontend

These endpoints are invoked by code in `public/js/*`.

- GET `/api/years`
  - No params → seasons (`get_years`)
  - `?year=YYYY&rounds=true` → rounds for season (`get_rounds_for_year`)
  - `?year=YYYY&matches=true` → all matches (`season_matches`)
  - `?year=YYYY&round=RX` → matches for round (`season_matches`)
  - `?year=YYYY&ladder=true` → ladder (`season_ladder`)
  - `?year=YYYY` → season summary (`season_summary`)

- GET `/api/teams-all`
  - No params → teams list (`get_teams`)
  - `?teamName=Team` → team summary (`get_team_summary`)

- GET `/api/team-match-years?team=Team`
- GET `/api/team-matches?team=Team&year=YYYY`

- GET `/api/players-all?alphabet=true` → alphabet index
  - Response:
    - `{ "letters": [{ "letter": "A", "count": 387 }, ...] }`
  - Backed by `get_player_alphabet()` (mv_player_career_totals)

- GET `/api/players-all?letter=A` → players by letter
  - Response:
    - `{ "players": [{
          "player_id": 12790,
          "player_name": "Jake Aarts",
          "player_first_name": "Jake",
          "player_last_name": "Aarts",
          "teams": ["Richmond"],
          "first_season": 2020,
          "last_season": 2022,
          "games": 42,
          "goals": 34,
          "disposals": 407,
          "marks": 91,
          "tackles": 100,
          "afl_fantasy_score": 1804,
          "supercoach_score": 0
        }, ...] }`
  - Backed by `get_players_by_letter(p_letter)` (mv_player_career_totals)

- GET `/api/players-all?playerId=ID` → player details
  - Response:
    - `{ "profile": { /* career row from mv_player_career_totals */ },
         "seasons": [{ /* rows from mv_player_season_totals */ }],
         "games":   [{ /* rows from mv_match_player_stats */ }] }`
  - Notes:
    - Frontend derives `career averages` as totals ÷ games (1 dp) from `profile`.
    - Frontend derives `opponent` per game as:
      - `opponent = player_team === match_home_team ? match_away_team : match_home_team`.
  - Backed by RPCs:
    - `get_player_profile(p_player_id)` → mv_player_career_totals
    - `get_player_seasons(p_player_id)` → mv_player_season_totals
    - `get_player_games(p_player_id, p_limit)` → mv_match_player_stats

- GET `/api/stats-all?type=trophy-room`
- GET `/api/stats-all?type=hall-of-records`
- GET `/api/stats-all?type=insights`

- GET `/api/match/[id]`
- GET `/api/head-to-head/[home]/[away]`

- GET `/api/upcoming-games`
- GET `/api/live-stream` (SSE; new)

Candidates for deprecation (not used by frontend):

- `/api/matches-all` (removed)
- Legacy Express server in `api/index.express-legacy.js`

Deprecated routes and notes

- `/api/stats-all?type=team-details` is deprecated. Teams page flows via `/api/teams-all?teamName=...` for per‑club summaries and leaderboards.
- Intentional raw `afl_data` usage remains only in `api/test.js` (diagnostics) and the archived Express file. All active routes hit materialized views and RPCs.

RPCs used under the hood

- Years
  - `get_years()` → `mv_seasons`
  - `get_rounds_for_year(p_year)` → `mv_season_matches`
  - `season_matches(p_year, p_round)` → `mv_season_matches`
  - `season_ladder(p_year)` → `mv_season_ladders`
  - `season_summary(p_year)` → aggregates from seasonal MVs

- Teams
  - `get_teams()` → `mv_team_history`
  - `get_team_summary(p_team)` → `mv_team_history`

- Players
  - `get_player_alphabet()` → `mv_player_career_totals`
  - `get_players_by_letter(p_letter)` → `mv_player_career_totals`
  - `get_player_profile(p_player_id integer)` → `mv_player_career_totals`
  - `get_player_seasons(p_player_id integer)` → `mv_player_season_totals`
  - `get_player_games(p_player_id integer, p_limit integer)` → `mv_match_player_stats`

Notes

- The legacy `mode=index` path for `/api/players-all` is no longer used by the frontend; alphabet counts now come from `?alphabet=true` via `get_player_alphabet()`.

- Match/H2H
  - `get_match_players(p_match_id)` → `mv_match_player_stats`
  - `count_head_to_head(...)`, `head_to_head_summary(...)`
  - `head_to_head_last_meeting_players(p_home, p_away)` → `mv_match_player_stats`

- Trophy Room / Records
  - `trophy_room_career_leaders(p_limit)` → `mv_player_career_totals`
  - `hall_of_records_season_leaders(p_limit)` → `mv_player_season_totals`
