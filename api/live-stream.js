import { Readable } from 'node:stream';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { team, game } = req.query;
    const path = game
      ? `events/${game}`
      : team
      ? `games/${team}`
      : 'games';

    const controller = new AbortController();
    const upstream = await fetch(`https://api.squiggle.com.au/sse/${path}`, {
      // Squiggle asks for an identifying User-Agent
      headers: { 'User-Agent': 'Footy-Stats-Live (contact@example.com)' },
      signal: controller.signal
    });

    if (!upstream.ok || !upstream.body) {
      res.write(`event:error\ndata:Unable to connect\n\n`);
      return res.end();
    }

    // Pipe upstream SSE -> client. Node fetch uses a Web ReadableStream.
    const source = typeof upstream.body.pipe === 'function'
      ? upstream.body
      : Readable.fromWeb(upstream.body);
    source.pipe(res);

    // Cleanup on disconnect
    req.on('close', () => {
      controller.abort();
      try { upstream.body.destroy(); } catch {}
      try { source.destroy(); } catch {}
    });
  } catch (err) {
    console.error('live-stream error:', err);
    res.write(`event:error\ndata:Internal error\n\n`);
    res.end();
  }
}
