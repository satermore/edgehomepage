const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { removeOldEvents } = require('../scripts/updateWrestlingEvents');
const { scrapeEventDetail } = require('../services/cagematchScraper');

const router = express.Router();
const FILE_PATH = path.join(__dirname, '..', 'data', 'wrestlingEvents.json');

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];


function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readAndCleanEvents() {
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const cleaned = removeOldEvents(parsed.events || []);

  if ((parsed.events || []).length !== cleaned.length) {
    await fs.writeFile(
      FILE_PATH,
      JSON.stringify({ lastUpdate: parsed.lastUpdate || '', events: cleaned }, null, 2),
      'utf8',
    );
  }

  return cleaned;
}

function getLogicalToday() {
  const now = new Date();
  const broadcastHourByDay = {
    0: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 3,
    6: 2,
  };

  const threshold = broadcastHourByDay[now.getDay()];
  if (threshold !== undefined && now.getHours() < threshold) {
    now.setDate(now.getDate() - 1);
  }

  now.setHours(0, 0, 0, 0);
  return now;
}

function getRollingDaysWindow(dayOffset = 0) {
  const startDate = getLogicalToday();
  startDate.setDate(startDate.getDate() + dayOffset);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

function parseFlexibleDate(value = '') {
  const raw = String(value || '').trim();
  const match = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (match) {
    const [, dd, mm, yy] = match;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsed.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
}

async function resolveCalendarDate(event) {
  const details = await scrapeEventDetail(event.url);
  const metadata = details?.metadata || {};
  const entries = Object.entries(metadata);

  const broadcastType = entries.find(([key]) => /broadcast\s*type/i.test(key))?.[1] || '';
  const broadcastDateRaw = entries.find(([key]) => /broadcast\s*date|air\s*date|tv\s*date/i.test(key))?.[1] || '';
  const looksTaped = /taped/i.test(String(broadcastType)) || /\btaped\b/i.test(Object.values(metadata).join(' '));

  if (!looksTaped) return event.date;

  const broadcastDate = parseFlexibleDate(broadcastDateRaw);
  return broadcastDate || event.date;
}

router.get('/week', async (req, res) => {
  try {
    const events = await readAndCleanEvents();
    const dayOffset = Number.parseInt(req.query.dayOffset || '0', 10) || 0;
    const { startDate, endDate } = getRollingDaysWindow(dayOffset);
    const logicalTodayIso = toLocalIsoDate(getLogicalToday());

    const days = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const isoDate = toLocalIsoDate(date);
      return {
        date: isoDate,
        dayLabel: DAY_LABELS[date.getDay()],
        isToday: isoDate === logicalTodayIso,
        events: [],
      };
    });

    const candidateStart = new Date(startDate);
    candidateStart.setDate(candidateStart.getDate() - 10);
    const candidateEnd = new Date(endDate);
    candidateEnd.setDate(candidateEnd.getDate() + 10);

    const candidateEvents = events.filter((event) => {
      const eventDate = new Date(`${event.date}T00:00:00`);
      return eventDate >= candidateStart && eventDate <= candidateEnd;
    });

    const normalizedEvents = await Promise.all(
      candidateEvents.map(async (event) => ({
        ...event,
        calendarDate: await resolveCalendarDate(event),
      })),
    );

    normalizedEvents.forEach((event) => {
      const eventDate = new Date(`${event.calendarDate}T00:00:00`);
      if (eventDate < startDate || eventDate > endDate) return;
      const target = days.find((day) => day.date === event.calendarDate);
      if (!target) return;
      target.events.push({
        id: event.id,
        name: event.name,
        promotion: event.promotion,
        location: event.location,
      });
    });

    res.json({
      dayOffset,
      rangeLabel: `${days[0].date} · ${days[6].date}`,
      days,
    });
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los eventos semanales', detail: error.message });
  }
});

router.get('/event/:id', async (req, res) => {
  try {
    const events = await readAndCleanEvents();
    const event = events.find((item) => item.id === req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const details = await scrapeEventDetail(event.url);

    return res.json({
      ...event,
      details,
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo cargar el evento', detail: error.message });
  }
});

module.exports = router;
