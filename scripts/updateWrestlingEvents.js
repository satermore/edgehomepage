const fs = require('fs/promises');
const path = require('path');
const { scrapePromotionEvents, todayStartTimestamp } = require('../services/cagematchScraper');

const FILE_PATH = path.join(__dirname, '..', 'data', 'wrestlingEvents.json');
const RETENTION_DAYS = 14;

const PROMOTIONS = [
  {
    name: 'WWE',
    url: 'https://www.cagematch.net/en/?id=1&view=cards&year=2026&Day=&Month=&Year=2026&name=&promotion=1&showtype=&location=&arena=&region=',
  },
  {
    name: 'All Elite Wrestling',
    url: 'https://www.cagematch.net/en/?id=1&view=cards&year=2026&Day=&Month=&Year=2026&name=&promotion=2287&showtype=&location=&arena=&region=',
  },
  {
    name: 'Lucha Libre AAA Worldwide',
    url: 'https://www.cagematch.net/en/?id=1&view=cards&year=2026&Day=&Month=&Year=2026&name=&promotion=122&showtype=&location=&arena=&region=',
  },
  {
    name: 'TNA Wrestling',
    url: 'https://www.cagematch.net/en/?id=1&view=cards&year=2026&Day=&Month=&Year=2026&name=&promotion=5&showtype=&location=&arena=&region=',
  },
  {
    name: 'Consejo Mundial de Lucha Libre',
    url: 'https://www.cagematch.net/en/?id=1&view=cards&year=2026&Day=&Month=&Year=2026&name=&promotion=78&showtype=&location=&arena=&region=',
  },
  {
    name: 'New Japan Pro-Wrestling',
    url: 'https://www.cagematch.net/en/?id=1&view=cards&year=2026&Day=&Month=&Year=2026&name=&promotion=7&showtype=&location=&arena=&region=',
  },
];

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.name.toLowerCase()}|${event.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function removeOldEvents(events) {
  const today = todayStartTimestamp();
  const cutoff = today - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return events.filter((event) => event.timestamp >= cutoff);
}

async function loadExistingEvents() {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

async function updateWrestlingEvents() {
  const scraped = await Promise.all(
    PROMOTIONS.map((promotion) => scrapePromotionEvents(promotion.url, promotion.name)),
  );

  const existingEvents = await loadExistingEvents();
  const mergedEvents = dedupeEvents([...existingEvents, ...scraped.flat()]);
  const cleanedEvents = removeOldEvents(mergedEvents).sort((a, b) => a.timestamp - b.timestamp);

  const payload = {
    lastUpdate: new Date().toISOString(),
    events: cleanedEvents,
  };

  await fs.writeFile(FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

if (require.main === module) {
  updateWrestlingEvents()
    .then((payload) => {
      console.log(`Eventos de wrestling actualizados: ${payload.events.length}`);
    })
    .catch((error) => {
      console.error('Error actualizando eventos de wrestling:', error);
      process.exitCode = 1;
    });
}

module.exports = {
  updateWrestlingEvents,
  removeOldEvents,
};
