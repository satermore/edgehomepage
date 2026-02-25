const express = require('express');
const path = require('path');
const cron = require('node-cron');

const wrestlingRouter = require('./routes/wrestling');
const nbaRouter = require('./routes/nba');
const { updateWrestlingEvents } = require('./scripts/updateWrestlingEvents');
const { updateNbaGames } = require('./scripts/updateNbaGames');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.use('/api/wrestling', wrestlingRouter);
app.use('/api/nba', nbaRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

cron.schedule('0 */6 * * *', async () => {
  try {
    await updateWrestlingEvents();
    await updateNbaGames();
    console.log(`[cron] Datos actualizados ${new Date().toISOString()}`);
  } catch (error) {
    console.error('[cron] Error al actualizar datos', error);
  }
});

(async () => {
  try {
    await updateWrestlingEvents();
    await updateNbaGames();
  } catch (error) {
    console.warn('No se pudo precargar datos al iniciar:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
  });
})();
