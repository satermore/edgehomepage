const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { removeOldEvents } = require('../scripts/updateWrestlingEvents');
const { scrapeEventDetail } = require('../services/cagematchScraper');

const router = express.Router();
const FILE_PATH = path.join(__dirname, '..', 'data', 'wrestlingEvents.json');

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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

function getCurrentWeekRange(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
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
  if (!/taping/i.test(event.name || '')) return event.date;

  const details = await scrapeEventDetail(event.url);
  const metadata = details?.metadata || {};
  const broadcastType = Object.entries(metadata).find(([key]) => /broadcast\s*type/i.test(key))?.[1] || '';
  const broadcastDateRaw = Object.entries(metadata).find(([key]) => /broadcast\s*date/i.test(key))?.[1] || '';

  if (!/taped/i.test(String(broadcastType))) return event.date;

  const broadcastDate = parseFlexibleDate(broadcastDateRaw);
  return broadcastDate || event.date;
}

router.get('/week', async (req, res) => {
  try {
    const events = await readAndCleanEvents();
    const weekOffset = Number.parseInt(req.query.offset || '0', 10) || 0;
    const { monday, sunday } = getCurrentWeekRange(weekOffset);

    const weekDays = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const isoDate = date.toISOString().slice(0, 10);
      return {
        date: isoDate,
        dayLabel: DAY_LABELS[date.getDay()],
        isToday: weekOffset === 0 && isoDate === new Date().toISOString().slice(0, 10),
        events: [],
      };
    });

    const candidateStart = new Date(monday);
    candidateStart.setDate(candidateStart.getDate() - 7);
    const candidateEnd = new Date(sunday);
    candidateEnd.setDate(candidateEnd.getDate() + 7);

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
      if (eventDate < monday || eventDate > sunday) return;
      const target = weekDays.find((day) => day.date === event.calendarDate);
      if (!target) return;
      target.events.push({
        id: event.id,
        name: event.name,
        promotion: event.promotion,
        location: event.location,
      });
    });

    res.json({
      weekOffset,
      rangeLabel: `${weekDays[0].date} · ${weekDays[6].date}`,
      days: weekDays,
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
