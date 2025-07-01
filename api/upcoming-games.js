let cache = { ts: 0, data: [] };          // 10-minute in-memory cache

export default async function handler(req, res) {
  // dynamically use the current year to avoid off-season queries
  const year = new Date().getFullYear();

  //  === 1. Respect GET only  ============================================
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    //  === 2. Serve cache if it's <10 minutes old  =======================
    if (Date.now() - cache.ts < 10 * 60_000) {
      return res.status(200).json(cache.data);
    }

    //  === 3. Fetch next eight fixtures from Squiggle  ===================
    const url = `https://api.squiggle.com.au/?q=games;year=${year};coming=8;format=json`;

    const rsp = await fetch(url, {
      headers: {
        // Squiggle asks for an identifying User-Agent
        'User-Agent': 'Footy-Stats-Site (contact@example.com)',
      },
    });

    if (!rsp.ok) throw new Error(`Squiggle ${rsp.status}`);

    const { games } = await rsp.json();

    //  === 4. Cache & return  ============================================
    cache = { ts: Date.now(), data: games };
    res.status(200).json(games);
  } catch (err) {
    console.error('Upcoming-games fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch fixture' });
  }
}