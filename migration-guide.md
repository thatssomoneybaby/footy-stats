# AFL Stats Migration to Vercel Guide

## Option 1: PostgreSQL Migration (Recommended)

### 1. Prepare Database Schema
```sql
-- Create PostgreSQL-compatible schema
CREATE TABLE afl_data (
    venue_name TEXT,
    match_id INTEGER,
    match_home_team TEXT,
    match_away_team TEXT,
    match_date DATE,
    match_local_time TIME,
    match_attendance INTEGER,
    match_round TEXT,
    match_home_team_goals INTEGER,
    match_home_team_behinds INTEGER,
    match_home_team_score INTEGER,
    match_away_team_goals INTEGER,
    match_away_team_behinds INTEGER,
    match_away_team_score INTEGER,
    match_margin INTEGER,
    match_winner TEXT,
    match_weather_temp_c REAL,
    match_weather_type TEXT,
    player_id INTEGER,
    player_first_name TEXT,
    player_last_name TEXT,
    player_height_cm INTEGER,
    player_weight_kg INTEGER,
    player_is_retired BOOLEAN,
    player_team TEXT,
    guernsey_number INTEGER,
    kicks INTEGER,
    marks INTEGER,
    handballs INTEGER,
    disposals INTEGER,
    effective_disposals INTEGER,
    disposal_efficiency_percentage REAL,
    goals INTEGER,
    behinds INTEGER,
    hitouts INTEGER,
    tackles INTEGER,
    rebounds INTEGER,
    inside_fifties INTEGER,
    clearances INTEGER,
    clangers INTEGER,
    free_kicks_for INTEGER,
    free_kicks_against INTEGER,
    brownlow_votes INTEGER,
    contested_possessions INTEGER,
    uncontested_possessions INTEGER,
    contested_marks INTEGER,
    marks_inside_fifty INTEGER,
    one_percenters INTEGER,
    bounces INTEGER,
    goal_assists INTEGER,
    time_on_ground_percentage REAL,
    afl_fantasy_score INTEGER,
    supercoach_score INTEGER,
    centre_clearances INTEGER,
    stoppage_clearances INTEGER,
    score_involvements INTEGER,
    metres_gained INTEGER,
    turnovers INTEGER,
    intercepts INTEGER,
    tackles_inside_fifty INTEGER,
    contest_def_losses INTEGER,
    contest_def_one_on_ones INTEGER,
    contest_off_one_on_ones INTEGER,
    contest_off_wins INTEGER,
    def_half_pressure_acts INTEGER,
    effective_kicks INTEGER,
    f50_ground_ball_gets INTEGER,
    ground_ball_gets INTEGER,
    hitouts_to_advantage INTEGER,
    hitout_win_percentage REAL,
    intercept_marks INTEGER,
    marks_on_lead INTEGER,
    pressure_acts INTEGER,
    rating_points REAL,
    ruck_contests INTEGER,
    score_launches INTEGER,
    shots_at_goal INTEGER,
    spoils INTEGER,
    subbed BOOLEAN,
    player_position TEXT,
    date DATE
);
```

### 2. Update package.json dependencies
```json
{
  "dependencies": {
    "express": "^5.1.0",
    "cors": "^2.8.5",
    "pg": "^8.11.3"
  }
}
```

### 3. Update API code
```javascript
import express from 'express';
import pg from 'pg';
import cors from 'cors';

const app = express();
app.use(cors());

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

await client.connect();

// Replace db.prepare() with client.query()
app.get('/years', async (req, res) => {
  const result = await client.query(`
    SELECT DISTINCT EXTRACT(YEAR FROM match_date)::text AS year
    FROM afl_data
    WHERE EXTRACT(YEAR FROM match_date) BETWEEN 1900 AND 2100
    ORDER BY year DESC
  `);
  res.json(result.rows.map(row => row.year));
});
```

## Option 2: JSON Export (Simpler)

### 1. Export data to JSON
```bash
# Create data directory
mkdir data

# Export main datasets
sqlite3 afl_data.sqlite "SELECT * FROM AFL_data LIMIT 10000" -json > data/sample_matches.json
sqlite3 afl_data.sqlite "SELECT DISTINCT substr(match_date, 1, 4) AS year FROM AFL_data WHERE year GLOB '[1-2][0-9][0-9][0-9]' ORDER BY year DESC" -json > data/years.json
```

### 2. Create Vercel API routes
```javascript
// api/years.js
import years from '../data/years.json';

export default function handler(req, res) {
  res.json(years.map(y => y.year));
}

// api/matches.js
import matches from '../data/sample_matches.json';

export default function handler(req, res) {
  const { year } = req.query;
  const filtered = matches.filter(m => 
    new Date(m.match_date).getFullYear().toString() === year
  );
  res.json(filtered);
}
```

## Deployment Steps

### 1. Prepare for Vercel
```bash
# Create vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    },
    {
      "src": "afl_site/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/afl_site/$1"
    }
  ]
}
```

### 2. Update API base URL
```javascript
// In js/api.js
const BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-app.vercel.app/api' 
  : 'http://localhost:3000';
```

### 3. Deploy
```bash
npm install -g vercel
vercel
```

## Recommended Approach

For your AFL stats project, I recommend **Option 1 (PostgreSQL)** because:
- Your database is large (675k+ records)
- You need complex queries for statistics
- Better performance for user experience
- Scalable for future features

Would you like me to help you with any specific part of this migration?