let cache = { ts: 0, data: [] };          // 10-minute in-memory cache

export default async function handler(req, res) {
  //  === 1. Respect GET only  ============================================
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    //  === 2. Serve cache if it's <10 minutes old  =======================
    if (Date.now() - cache.ts < 10 * 60_000) {
      res.setHeader('Cache-Control', 's-maxage=300');
      return res.status(200).json(cache.data);
    }

    //  === 3. Fetch next fixtures from Squiggle  ========================
    const url = `https://api.squiggle.com.au/?q=games;complete=0;format=json`;

    const rsp = await fetch(url, {
      headers: {
        // Squiggle asks for an identifying User-Agent
        'User-Agent': 'Footy-Stats-Site (contact@example.com)',
      },
    });

    if (!rsp.ok) throw new Error(`Squiggle ${rsp.status}`);

    const { games } = await rsp.json();

    const now = Date.now();
    // Only future games
    const futureGames = games.filter(g => Date.parse(g.date) > now);
    // Sort ascending by date
    futureGames.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    // Determine upcoming round
    const nextRound = futureGames.length ? futureGames[0].round : null;
    // Filter games to that round
    const upcoming = nextRound !== null
      ? futureGames.filter(g => g.round === nextRound)
      : [];

    //  === 4. Cache & return  ============================================
    cache = { ts: Date.now(), data: upcoming };
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json(upcoming);
  } catch (err) {
    console.error('Upcoming-games fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch fixture' });
  }
}
