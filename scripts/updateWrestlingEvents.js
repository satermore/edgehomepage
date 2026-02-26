const fs = require('fs/promises');
const path = require('path');
const { scrapePromotionEvents } = require('../services/cagematchScraper');

const FILE_PATH = path.join(__dirname, '..', 'data', 'wrestlingEvents.json');
const PROMOTIONS = [
  {
    name: 'WWE',
    url: 'https://www.cagematch.net/en/?id=8&nr=1&page=4',
  },
  {
    name: 'All Elite Wrestling',
    url: 'https://www.cagematch.net/en/?id=8&nr=2287&page=4',
  },
  {
    name: 'New Japan Pro-Wrestling',
    url: 'https://www.cagematch.net/en/?id=8&nr=7&page=4',
  },
  {
    name: 'TNA Wrestling',
    url: 'https://www.cagematch.net/en/?id=8&nr=5&page=4',
  },
  {
    name: 'Consejo Mundial de Lucha Libre',
    url: 'https://www.cagematch.net/en/?id=8&nr=78&page=4',
  },
  {
    name: 'Lucha Libre AAA Worldwide',
    url: 'https://www.cagematch.net/en/?id=8&nr=122&page=4',
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
  const cleanedEvents = mergedEvents.sort((a, b) => a.timestamp - b.timestamp);

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
};
