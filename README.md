# AFL Stats Site

A modern web application for displaying AFL (Australian Football League) statistics with comprehensive player, team, and match data.

## 🏈 Features

- **Years & Matches**: Browse AFL data by year and round
- **Team Statistics**: Comprehensive team analytics including win/loss records, top performers, and historical data
- **Player Database**: Searchable player database with career statistics and game-by-game breakdowns
- **Trophy Room**: Hall of fame showcasing top performers across key statistics
- **Hall of Records**: Comprehensive leaderboards across multiple statistical categories

## 🚀 Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Data**: AFL match and player statistics

## 📁 Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── matches-all.js     # Years, rounds, and match data
│   ├── stats-all.js       # Statistics and analytics
│   ├── players-all.js     # Player data and search
│   ├── teams-all.js       # Team information
│   └── index.js           # Backup Express server
├── public/                # Static frontend files
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript modules
│   ├── index.html        # Homepage
│   ├── teams.html        # Teams page
│   ├── players.html      # Players page
│   ├── trophy-room.html  # Trophy room
│   └── years.html        # Years/matches page
├── db.js                 # Database configuration
├── package.json          # Dependencies and scripts
└── vercel.json          # Vercel deployment config
```

## 🛠 Setup & Development

### Prerequisites
- Node.js (v18+)
- Supabase account and database

### Environment Variables
Create a `.env` file with:
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation
```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Database Setup
The application expects a Supabase table named `afl_data` with AFL match and player statistics.

## 🌐 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
# Build and deploy
npm run build
vercel --prod
```

## 📊 API Endpoints

### Matches & Years
- `GET /api/matches-all?years=true` - Get all available years
- `GET /api/matches-all?year=2023&rounds=true` - Get rounds for a year
- `GET /api/matches-all?year=2023&round=1` - Get matches for specific round

### Teams
- `GET /api/teams-all` - Get all teams
- `GET /api/teams-all?teamName=Richmond` - Get team details

### Players
- `GET /api/players-all?alphabet=true` - Get player alphabet index
- `GET /api/players-all?letter=A` - Get players by letter
- `GET /api/players-all?playerId=123` - Get player details

### Statistics
- `GET /api/stats-all?type=trophy-room` - Get trophy room data
- `GET /api/stats-all?type=hall-of-records` - Get hall of records
- `GET /api/stats-all?type=insights` - Get latest insights

## 🔧 Recent Updates

### Supabase Migration (2025)
- Migrated from Turso to Supabase for improved performance and reliability
- Fixed data aggregation issues that were causing `undefined.undefined` displays
- Restored proper career averages and team statistics
- Improved query efficiency and data deduplication

## 📝 License

This project is for educational and demonstration purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Built with ❤️ for AFL fans everywhere**