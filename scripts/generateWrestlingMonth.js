const fs = require('fs/promises');
const path = require('path');

const SOURCE_FILE_PATH = path.join(__dirname, '..', 'data', 'wrestlingEvents.json');
const TARGET_FILE_PATH = path.join(__dirname, '..', 'data', 'wrestlingEventsMonth.json');
const HISTORY_WINDOW_DAYS = 7;
const FUTURE_WINDOW_DAYS = 14;

function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getIsoFromDate(value) {
  const parsed = new Date(value || '');
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

function dedupeEvents(events = []) {
  const seen = new Set();

  return events.filter((event) => {
    const key = `${String(event?.name || '').toLowerCase()}|${String(event?.date || '')}|${String(event?.promotion || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function generateWrestlingMonth() {
  const raw = await fs.readFile(SOURCE_FILE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const events = Array.isArray(parsed.events) ? parsed.events : [];

  const baseIsoDate = getIsoFromDate(parsed.lastUpdate);
  const minIso = addDaysIso(baseIsoDate, -HISTORY_WINDOW_DAYS);
  const maxIso = addDaysIso(baseIsoDate, FUTURE_WINDOW_DAYS);

  const scopedEvents = dedupeEvents(
    events.filter((event) => {
      const eventDate = String(event?.date || '');
      return eventDate >= minIso && eventDate <= maxIso;
    }),
  ).sort((a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0));

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceLastUpdate: parsed.lastUpdate || '',
    window: {
      baseDate: baseIsoDate,
      startDate: minIso,
      endDate: maxIso,
    },
    events: scopedEvents,
  };

  await fs.writeFile(TARGET_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

if (require.main === module) {
  generateWrestlingMonth()
    .then((payload) => {
      console.log(
        `wrestlingEventsMonth.json generado con ${payload.events.length} eventos (${payload.window.startDate} -> ${payload.window.endDate})`,
      );
    })
    .catch((error) => {
      console.error('Error generando wrestlingEventsMonth.json:', error);
      process.exitCode = 1;
    });
}

module.exports = {
  generateWrestlingMonth,
};
