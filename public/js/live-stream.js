import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Disable Vercel body parsing & set streaming mode
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  // Pass through teamId or gameId if supplied
  const { team, game } = req.query;
  const path = game
    ? `events/${game}`
    : team
    ? `games/${team}`
    : 'games';

  const upstream = await fetch(`https://api.squiggle.com.au/sse/${path}`, {
    headers: { 'User-Agent': 'Footy-Stats-Live (contact@example.com)' },
  });

  if (!upstream.ok) {
    res.write(`event:error\ndata:Unable to connect\n\n`);
    return res.end();
  }

  // Pipe Squiggle stream → browser
  upstream.body.pipe(res);

  // Clean up if client disconnects
  req.on('close', () => upstream.body.destroy());
}