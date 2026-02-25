const fs = require('fs/promises');
const path = require('path');
const { fetchNbaGamesNext7Days } = require('../services/nbaService');

const FILE_PATH = path.join(__dirname, '..', 'data', 'nbaGames.json');

function removeOldGames(games) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return games.filter((game) => game.timestamp >= cutoff);
}

async function loadExistingGames() {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.games) ? parsed.games : [];
  } catch {
    return [];
  }
}

async function updateNbaGames() {
  const freshGames = await fetchNbaGamesNext7Days();
  const existingGames = await loadExistingGames();

  const merged = [...existingGames, ...freshGames];
  const dedupedMap = new Map(merged.map((game) => [game.id, game]));
  const cleanedGames = removeOldGames([...dedupedMap.values()]).sort((a, b) => a.timestamp - b.timestamp);

  const payload = {
    lastUpdate: new Date().toISOString(),
    games: cleanedGames,
  };

  await fs.writeFile(FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

if (require.main === module) {
  updateNbaGames()
    .then((payload) => {
      console.log(`Partidos NBA actualizados: ${payload.games.length}`);
    })
    .catch((error) => {
      console.error('Error actualizando NBA:', error);
      process.exitCode = 1;
    });
}

module.exports = {
  updateNbaGames,
  removeOldGames,
};
