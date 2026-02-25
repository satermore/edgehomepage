const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { removeOldGames } = require('../scripts/updateNbaGames');

const router = express.Router();
const FILE_PATH = path.join(__dirname, '..', 'data', 'nbaGames.json');

router.get('/week', async (_req, res) => {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const cleaned = removeOldGames(parsed.games || []);

    if ((parsed.games || []).length !== cleaned.length) {
      await fs.writeFile(
        FILE_PATH,
        JSON.stringify({ lastUpdate: parsed.lastUpdate || '', games: cleaned }, null, 2),
        'utf8',
      );
    }

    res.json({ lastUpdate: parsed.lastUpdate || '', games: cleaned });
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los partidos NBA', detail: error.message });
  }
});

module.exports = router;
