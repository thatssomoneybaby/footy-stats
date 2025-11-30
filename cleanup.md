

# Footy Stats – Cleanup Plan

This document tracks the steps to de‑Frankenstein the project and move to a Supabase‑first, Vercel serverless architecture.

---

## 1. Commit to Vercel Serverless Functions (Kill Express)

### 1.1 Remove legacy Express server

- [x] Delete or archive `api/index.js` (renamed to `api/index.express-legacy.js`).
- [x] Remove any Express‑specific middleware or route setup that is no longer used.

**Goal:** There should be no Express server – only Vercel‑style serverless functions in `api/`.

### 1.2 Update dev scripts to use Vercel

- [x] In `package.json`, update scripts so dev uses Vercel (adjust as needed):

  ```jsonc
  {
    "scripts": {
      "dev": "vercel dev",
      "build": "vercel build",
      "start": "vercel start"
    }
  }
  ```

- [x] Stop using any script that spins up the old Express app.

**Goal:** Running `npm run dev` should serve `/api/...` routes from the serverless functions, matching what production uses.

---

## 2. Inventory and Stabilise API Endpoints

### 2.1 List all endpoints used by the frontend

- [x] Search `public/js` for `"/api/"`.
- [x] Add/maintain a list in this file (or `ENDPOINTS.md`) of endpoints actually used by the frontend, e.g.:

  ```md
  ## Used by frontend

  - GET /api/years
  - GET /api/teams-all
  - GET /api/players-all
  - GET /api/stats-all
  - GET /api/matches-all
  - GET /api/team-matches
  - GET /api/team-match-years
  - GET /api/match/[id]
  - GET /api/head-to-head/[home]/[away]
  - GET /api/upcoming-games
  - GET /api/live-stream (currently missing)
  ```

- [x] Treat anything not in this list as a candidate for deprecation/deletion.

### 2.2 Fix the missing `/api/live-stream` route

- [x] Create `api/live-stream.js` with working SSE proxy.

  ```js
  // api/live-stream.js
  export default async function handler(req, res) {
    // TODO: implement real live stream logic
    return res.status(200).json({ ok: true, message: "live stream placeholder" });
  }
  ```

- [x] Remove misplaced `public/js/live-stream.js` serverless handler.

**Goal:** No more guaranteed 404 for `/api/live-stream`.

---

## 3. Standardise Supabase Client Usage

### 3.1 Single Supabase client

- [x] Ensure `db.js` (or similar) exports a single Supabase client, e.g.:

  ```js
  import { createClient } from '@supabase/supabase-js';

  export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  ```

  > Use the anon key for read-only public paths; service role only for server-only operations if needed.

- [x] Use shared client in all API routes

- [x] In each `api/*.js` file:
  - Remove inline `createClient(...)` calls.
  - Import the shared client instead, e.g.:

    ```js
    import { supabase } from '../../db'; // adjust relative path as needed

    export default async function handler(req, res) {
      const { data, error } = await supabase.rpc('get_years');
      // ...
    }
    ```

**Goal:** All serverless endpoints use the same Supabase client; no duplicated client creation logic.

---

## 4. Clean Up Individual API Routes (JS‑side)

### 4.1 `api/years.js` – canonical season endpoint

Intent: Source of truth for seasons, rounds, season ladder and summary.

- [ ] Ensure `api/years.js` only:
  - Calls RPCs like `get_years`, `get_rounds_for_year`, `season_matches`, `season_ladder`, `season_summary`.
  - Returns a clean JSON payload to the frontend.

- [ ] Make RPC parameter names match the SQL exactly, e.g.:

  ```js
  supabase.rpc('get_rounds_for_year', { p_year: Number(year) });
  ```

- [ ] Remove any giant fallbacks such as:

  ```js
  .from('afl_data').select('*').range(0, 200000)
  ```

  and JS‑side aggregation. Fix the SQL/RPC instead of falling back.

**Goal:** `api/years.js` is a thin orchestration layer, with no heavy data crunching.

---

### 4.2 `api/matches-all.js` – resolve or retire

This currently overlaps seasons/rounds/matches logic and does heavy selects.

Choose one:

- [x] **Option A (preferred):** Stop using `/api/matches-all` entirely.
  - Update frontend to use more focused endpoints (e.g. `/api/years` plus dedicated match routes).
  - Once unused, delete `api/matches-all.js`. (Removed)

**OR**

- [ ] **Option B:** Keep `/api/matches-all`, but:
  - Strip out `.range(0, 200000)` queries.
  - Make it call a single RPC like `get_matches_for_season(p_year)` based on a view.
  - Avoid duplicating what `/api/years` already provides.

---

### 4.3 `api/teams-all.js` – teams & team summaries

Intent: Provide team list and per‑team summary.

- [x] Use only Supabase RPCs such as `get_teams()` and `get_team_summary(p_team)`.
- [ ] Remove JS logic that:
  - Scans large portions of `afl_data` with huge `.range(...)`.
  - Re-computes wins/losses/points in Node.

**Goal:** Teams endpoint is just fetching pre‑computed data from Supabase views/functions.

---

### 4.4 `api/players-all.js` – alphabet, player lists & details

Intent: Alphabet navigation and player lists by letter.

- [x] Keep these as primary pathways:
  - `get_player_alphabet()` → existing letters.
  - `get_players_by_letter(p_letter)` → players for that letter.
  - (Optional) `get_player_profile(p_player_id)` → single player detail.

- [x] Remove any fallback code that:
  - Selects massive ranges from `afl_data`.
  - Filters/aggregates players in JS.

**Goal:** Player-related responses come from targeted SQL / RPCs, not in-memory scans. Player profile now uses `get_player_profile`, `get_player_seasons`, and `get_player_games`.

---

### 4.5 `api/stats-all.js` – trophy room / hall-of-records

Intent: Central endpoint for trophy room & record stats.

- [x] Treat `api/stats-all.js` as the canonical trophy room endpoint.
- [ ] Delete trophy room logic from the legacy Express file (`api/index.js`) once removed.
- [x] Replace JS aggregation with RPCs:
  - `trophy_room_career_leaders(p_limit)` for career leaders
  - `hall_of_records_season_leaders(p_limit)` for single-season leaders
  - Removed large range scans; serverless route now groups RPC rows only.

  Note: `team-details` path deprecated; use `/api/teams-all?teamName=...`.

---

### 4.6 `api/match/[id].js` – single match view

Intent: Data for a single match page.

- [ ] Refactor to use a single Supabase call, ideally:

  - An RPC like `get_match_detail(p_match_id)` that:
    - Returns match metadata (date, venue, teams, scores).
    - Returns per‑player stats for that match.
    - Returns team totals, if needed.

- [ ] Remove duplication of ladder/trophy logic here; this route should focus only on match‑level data.

---

### 4.7 `api/head-to-head/[home]/[away].js` – H2H summary

Intent: Provide head‑to‑head stats between two teams.

- [x] Ensure it uses RPCs like:
  - `count_head_to_head(p_home, p_away)`
  - `head_to_head_summary(p_home, p_away)`

- [x] Standardise parameter names (`p_home`, `p_away`, etc.) to match the SQL function definitions.
- [x] Remove any giant `.range(...)` fallbacks or JS‑side aggregation.

---

### 4.8 `api/upcoming-games.js` – Squiggle proxy

Intent: Proxy + cache for Squiggle upcoming games.

- [x] Keep current behaviour (Squiggle fetch + in‑memory 10‑minute cache).
- [ ] (Optional later) Consider moving cache into Vercel KV or Supabase if cross‑instance persistence is needed.

---

## 5. Supabase Cleanup (In Parallel)

These tasks can be done alongside the JS/Vercel cleanup.

### 5.1 Inventory existing Supabase objects

- [ ] In Supabase, list current functions:
  - `get_years`
  - `get_rounds_for_year`
  - `season_ladder`
  - `season_matches`
  - `season_summary`
  - `get_teams`
  - `get_team_summary`
  - `get_player_alphabet`
  - `get_players_by_letter`
  - …and any others.

- [ ] Note for each:
  - Parameter names and types.
  - Return types (tables/views).
  - Any performance issues.

### 5.2 Standardise function parameter naming

- [ ] Pick a consistent parameter naming convention, e.g. `p_year`, `p_team`, `p_player_id`.
- [ ] Update SQL function definitions or JS calls so they match exactly.
  - Example in JS:

    ```js
    supabase.rpc('get_rounds_for_year', { p_year: 2024 });
    ```

- [ ] Eliminate mismatches like `{ yr: ... }` vs `{ p_year: ... }`.

---

### 5.3 Plan core materialized views

Design the main read models that the frontend will use:

- [ ] `mv_season_ladder`
  - One row per `(season, team)`:
    - wins, losses, draws
    - points for/against
    - percentage
    - premiership points

- [ ] `mv_match_player_stats`
  - One row per `(match_id, player_id)` with all in‑match stats.
  - Used for match pages and player game logs.

- [ ] `mv_player_season_totals`
  - One row per `(player_id, season, team)`:
    - games, goals, disposals, etc.
  - Used for player pages and season leaderboards.

- [ ] `mv_trophy_room_records` (later)
  - Pre‑computed highest single‑game/season/career records for trophy room.

**Goal:** Frontend and API routes read mostly from these views, rarely from raw `afl_data`.

---

### 5.4 Wire one feature end‑to‑end (template)

Start with a single feature to establish the pattern (recommended: **season ladder**):

- [ ] Implement `mv_season_ladder` in Supabase.
- [ ] Implement `season_ladder(p_year int)` function returning that view.
- [ ] Update `api/years.js` to call `season_ladder(p_year)` instead of:
  - Large `afl_data` selects.
  - JS aggregation.

Once this is working and fast, reuse the same “MV + RPC + thin API route” pattern for:

- [ ] Player season totals.
- [ ] Match detail.
- [ ] Head‑to‑head stats.
- [ ] Trophy room records.

---

## 6. Final Cleanup & Naming Consistency

After completing the bulk of the refactor:

- [ ] Remove any unused API routes not referenced by `public/js`.
- [ ] Remove the legacy Express file(s) and old comments referring to them.
- [ ] Standardise endpoint naming:
  - e.g. `/api/years`, `/api/teams`, `/api/players`, `/api/stats`, `/api/matches`, etc.
- [ ] Update `public/js/api.js` and comments so they match the real endpoints and parameter shapes.
- [ ] Keep this document updated as tasks are completed (tick checkboxes, adjust as architecture stabilises).

**Overall goal:**  
Thin, boring JS serverless functions on Vercel + Supabase doing all heavy lifting via views/materialized views and small RPCs. This makes the AFL stats site fast, predictable, and easy to extend.
