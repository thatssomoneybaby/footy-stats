# AFL Stats Site - Deployment Guide

## 🚀 Ready for Vercel Deployment

Your AFL stats site has been converted from SQLite to Turso and is ready for deployment!

## ✅ What's Been Done

1. **API Conversion**: Updated from `better-sqlite3` to `@libsql/client` for Turso compatibility
2. **Async/Await**: All database queries converted to async patterns
3. **Vercel Config**: Created `vercel.json` for serverless deployment
4. **Frontend Updates**: Updated API URLs to work with Vercel routing
5. **File Structure**: Organized for Vercel deployment

## 📁 Project Structure

```
afl_site/
├── api/
│   └── index.js         # Main API server (Turso-compatible)
├── public/              # Static frontend files
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── ...
├── package.json         # Dependencies and scripts
├── vercel.json          # Vercel deployment config
├── .env.example         # Environment variables template
└── test-turso.js        # Connection test script
```

## 🔧 Deployment Steps

### 1. Set Up Environment Variables

First, create a `.env` file with your Turso credentials:

```bash
TURSO_DB_URL=libsql://your-database-name.turso.io
TURSO_DB_AUTH_TOKEN=your-auth-token-here
```

### 2. Test Turso Connection (Optional)

```bash
npm install
node test-turso.js
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### 4. Configure Vercel Environment Variables

In your Vercel dashboard:
- Go to Settings → Environment Variables
- Add `TURSO_DB_URL` and `TURSO_DB_AUTH_TOKEN`
- Redeploy if needed

## 🔍 API Endpoints Available

- `GET /api/years` - Available AFL seasons
- `GET /api/matches?year=YYYY` - Matches for a specific year
- `GET /api/teams` - All teams and their stats
- `GET /api/teams/:teamName` - Detailed team stats
- `GET /api/players/alphabet` - Player alphabet navigation
- `GET /api/players?letter=A` - Players by letter
- `GET /api/players/:playerId` - Individual player stats
- `GET /api/trophy-room` - Top performers

## 🐛 Troubleshooting

1. **Database Connection Issues**:
   - Verify your Turso URL and auth token
   - Check that your database is accessible
   - Run `node test-turso.js` to test connection

2. **API Endpoints Not Working**:
   - Check Vercel function logs
   - Verify environment variables are set in Vercel
   - Ensure all SQL queries are compatible with libSQL

3. **Frontend Issues**:
   - Check browser console for errors
   - Verify API URLs are correct
   - Test with network tab to see failed requests

## 📝 Next Steps

1. **Test Your Deployment**: Visit your Vercel URL and test all functionality
2. **Custom Domain**: Add your custom domain in Vercel settings
3. **Analytics**: Consider adding Vercel Analytics
4. **Error Monitoring**: Set up error tracking (Sentry, etc.)

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Turso Documentation](https://docs.turso.tech/)
- [libSQL Client](https://github.com/libsql/libsql-client-ts)

---

Your AFL stats site is now ready for production! 🏈