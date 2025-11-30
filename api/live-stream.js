export default async function handler(req, res) {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const { team, game } = req.query;
    const path = game
      ? `events/${game}`
      : team
      ? `games/${team}`
      : 'games';

    const upstream = await fetch(`https://api.squiggle.com.au/sse/${path}`, {
      // Squiggle asks for an identifying User-Agent
      headers: { 'User-Agent': 'Footy-Stats-Live (contact@example.com)' },
    });

    if (!upstream.ok || !upstream.body) {
      res.write(`event:error\ndata:Unable to connect\n\n`);
      return res.end();
    }

    // Pipe upstream SSE → client
    upstream.body.pipe(res);

    // Cleanup on disconnect
    req.on('close', () => {
      try { upstream.body.destroy(); } catch {}
    });
  } catch (err) {
    console.error('live-stream error:', err);
    res.write(`event:error\ndata:Internal error\n\n`);
    res.end();
  }
}

