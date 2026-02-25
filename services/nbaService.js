const axios = require('axios');

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(days = 7) {
  const dates = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

async function fetchNbaGamesNext7Days() {
  const dateRange = getDateRange(7);
  const requests = dateRange.map((date) =>
    axios.get(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_${date.replace(/-/g, '')}.json`, {
      timeout: 10_000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      validateStatus: (status) => status === 200 || status === 404,
    }),
  );

  const responses = await Promise.allSettled(requests);
  const games = [];

  responses.forEach((res, idx) => {
    if (res.status !== 'fulfilled' || res.value.status === 404) return;

    const payload = res.value.data;
    const dayGames = payload?.scoreboard?.games || [];
    dayGames.forEach((game) => {
      const gameDate = dateRange[idx];
      const gameTime = (game.gameTimeUTC || '').slice(11, 16) || '00:00';
      const timestamp = new Date(game.gameTimeUTC || `${gameDate}T00:00:00Z`).getTime();

      games.push({
        id: game.gameId,
        home: game.homeTeam?.teamName || game.homeTeam?.teamTricode || 'Home',
        away: game.awayTeam?.teamName || game.awayTeam?.teamTricode || 'Away',
        date: gameDate,
        time: gameTime,
        status: game.gameStatusText || 'scheduled',
        timestamp,
      });
    });
  });

  return games;
}

module.exports = {
  fetchNbaGamesNext7Days,
};
