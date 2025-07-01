export function listenLiveGames({ teamId = null, onGame, onRemove }) {
  const url = teamId
    ? `/api/live-stream?team=${teamId}`
    : `/api/live-stream`;

  const es = new EventSource(url);

  es.addEventListener('games', (e) => {
    const games = JSON.parse(e.data);    // first payload on connect
    games.forEach(onGame);
  });

  es.addEventListener('addGame', (e) => onGame(JSON.parse(e.data)));
  es.addEventListener('removeGame', (e) => onRemove(JSON.parse(e.data)));

  es.onerror = () => console.warn('SSE error (will auto-reconnect)');
  return () => es.close();               // call to stop listening
}