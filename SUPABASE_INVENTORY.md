# Supabase Inventory (Active Site Usage)

This file lists every Supabase RPC/materialized view/table currently used by the live site code, and what each is used for.

## Quick Supabase checks

```sql
-- Functions (RPCs)
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_type = 'FUNCTION'
order by 1;

-- Materialized views
select matviewname
from pg_matviews
where schemaname = 'public'
order by 1;
```

## Route-level mapping

| API route | Frontend caller(s) | RPCs used | MVs/Tables used | Purpose |
|---|---|---|---|---|
| `/api/years` | `public/js/api.js` (`getYears`, `getSeasonSummary`, `getRoundsForYear`, `getSeasonMatches`, `getSeasonLadder`) | `get_years`, `get_rounds_for_year`, `season_ladder`, `season_matches`, `season_summary` | none directly in API route | Seasons, rounds, ladder, season matches, season summary |
| `/api/teams-all` | `public/js/api.js` (`getTeams`, `getTeamSummary`) | `get_teams`, `get_team_summary` | `mv_team_player_careers`, `mv_season_matches` | Team list and team detail payloads (leaders + summary extras) |
| `/api/team-match-years` | `public/js/api.js` (`getTeamMatchYears`) | `get_team_match_years` | none | Distinct years for selected team |
| `/api/team-matches` | `public/js/api.js` (`getTeamMatchesByYear`) | `team_matches` | none | Team matches for a given season |
| `/api/players-all?alphabet=true` | `public/js/api.js` (`getPlayersAlphabet`) | `get_player_alphabet` | fallback: none | Player alphabet index |
| `/api/players-all?letter=...` | `public/js/api.js` (`getPlayers`) | `get_players_by_letter` | none | Players by surname initial |
| `/api/players-all?playerId=...` | `public/js/api.js` (`getPlayerDetails`) | `get_player_profile`, `get_player_seasons`, `get_player_games` | fallback: `mv_player_career_totals`, `mv_player_season_totals`, `mv_match_player_stats` | Player profile, seasons, paged games, debut, team stints |
| `/api/stats-all?type=trophy-room` | `public/js/api.js` (`getTrophyRoom`) | `trophy_room_career_leaders` | none | Career leaders for Trophy Room |
| `/api/stats-all?type=hall-of-records` | `public/js/api.js` (`getHallOfRecords`) | `hall_of_records_season_leaders` | none | Single-season records |
| `/api/stats-all?type=insights` and `type=spotlight` | `public/js/api.js` (`getInsights`) + `public/js/home.js` spotlight fetch | none | `mv_season_matches`, `mv_match_player_stats` | Home page insights and random spotlight cards |
| `/api/match/[id]` | `public/js/api.js` (`getMatchById`) | `get_match_players` | none | Match-level player stat rows |
| `/api/head-to-head/[home]/[away]` | `public/js/api.js` (`getHeadToHead`) | `count_head_to_head`, `head_to_head_summary`, `head_to_head_last_meeting_players` | `mv_season_matches` | H2H summary, history, last-meeting top performers |
| `/api/test` | none (manual diagnostics only) | none | `afl_data` | Environment/database diagnostic endpoint |

## RPC checklist

Use this list when verifying your Supabase project:

- `count_head_to_head(home_team text, away_team text)`
- `get_match_players(p_match_id integer)`
- `get_player_alphabet()`
- `get_player_games(p_player_id integer, p_limit integer, p_offset integer)`
- `get_player_profile(p_player_id integer)`
- `get_player_seasons(p_player_id integer)`
- `get_players_by_letter(p_letter text)`
- `get_rounds_for_year(p_year integer)`
- `get_team_match_years(team_name text)`
- `get_team_summary(p_team text)` (or compatible `team_name` parameter)
- `get_teams()`
- `get_years()`
- `hall_of_records_season_leaders(p_limit integer)`
- `head_to_head_last_meeting_players(p_home text, p_away text)`
- `head_to_head_summary(home_team text, away_team text)`
- `season_ladder(p_year integer)`
- `season_matches(p_year integer, p_round text)`
- `season_summary(p_year integer)`
- `team_matches(p_team text, p_year integer)`
- `trophy_room_career_leaders(p_limit integer)`

## Materialized view/table checklist

- `mv_match_player_stats`
- `mv_player_career_totals`
- `mv_player_season_totals`
- `mv_season_matches`
- `mv_team_player_careers`
- `afl_data` (diagnostics endpoint only)

