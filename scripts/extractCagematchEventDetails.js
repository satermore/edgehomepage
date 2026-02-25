const fs = require('fs/promises');
const path = require('path');
const { scrapeEventDetail } = require('../services/cagematchScraper');

const EVENTS_FILE = path.join(__dirname, '..', 'data', 'wrestlingEvents.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'wrestlingEventDetails.json');

async function run() {
  const limit = Number(process.argv[2] || 0);
  const payload = JSON.parse(await fs.readFile(EVENTS_FILE, 'utf8'));
  const events = Array.isArray(payload.events) ? payload.events : [];
  const selected = limit > 0 ? events.slice(0, limit) : events;

  const detailedEvents = [];

  for (const [index, event] of selected.entries()) {
    process.stdout.write(`[${index + 1}/${selected.length}] ${event.name}\n`);
    const details = await scrapeEventDetail(event.url);
    detailedEvents.push({
      ...event,
      details,
    });
  }

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: detailedEvents.length,
        events: detailedEvents,
      },
      null,
      2,
    ),
    'utf8',
  );

  process.stdout.write(`Guardado en ${OUTPUT_FILE}\n`);
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Error extrayendo detalles:', error);
    process.exitCode = 1;
  });
}
