const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { removeOldEvents } = require('../scripts/updateWrestlingEvents');
const { scrapeEventDetail } = require('../services/cagematchScraper');

const router = express.Router();
const FILE_PATH = path.join(__dirname, '..', 'data', 'wrestlingEvents.json');

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getEtNowParts() {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((item) => [item.type, item.value]));
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    return {
      isoDate: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour || 0),
      minute: Number(parts.minute || 0),
      weekday: weekdayMap[parts.weekday] ?? new Date().getDay(),
    };
  } catch {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return {
      isoDate: `${year}-${month}-${day}`,
      hour: now.getHours(),
      minute: now.getMinutes(),
      weekday: now.getDay(),
    };
  }
}

function getLogicalTodayIso() {
  const nowEt = getEtNowParts();
  const broadcastHourByDay = {
    0: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 3,
    6: 2,
  };

  const threshold = broadcastHourByDay[nowEt.weekday];
  if (threshold !== undefined && nowEt.hour < threshold) {
    return addDaysIso(nowEt.isoDate, -1);
  }

  return nowEt.isoDate;
}

function getRollingDaysWindow(dayOffset = 0) {
  const startIso = addDaysIso(getLogicalTodayIso(), dayOffset);
  const endIso = addDaysIso(startIso, 6);
  return { startIso, endIso };
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

async function readAndCleanEvents() {
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const events = Array.isArray(parsed.events) ? parsed.events : [];
  const cleaned = removeOldEvents(events);

  if (events.length !== cleaned.length) {
    await fs.writeFile(
      FILE_PATH,
      JSON.stringify({ lastUpdate: parsed.lastUpdate || '', events: cleaned }, null, 2),
      'utf8',
    );
  }

  return cleaned;
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
    const { startIso, endIso } = getRollingDaysWindow(dayOffset);
    const logicalTodayIso = getLogicalTodayIso();

    const days = Array.from({ length: 7 }).map((_, i) => {
      const isoDate = addDaysIso(startIso, i);
      const date = new Date(`${isoDate}T00:00:00Z`);
      return {
        date: isoDate,
        dayLabel: DAY_LABELS[date.getDay()],
        isToday: isoDate === logicalTodayIso,
        events: [],
      };
    });

    const candidateStartIso = addDaysIso(startIso, -10);
    const candidateEndIso = addDaysIso(endIso, 10);

    const candidateEvents = events.filter((event) => event.date >= candidateStartIso && event.date <= candidateEndIso);

    const normalizedEvents = await Promise.all(
      candidateEvents.map(async (event) => ({
        ...event,
        calendarDate: await resolveCalendarDate(event),
      })),
    );

    normalizedEvents.forEach((event) => {
      if (event.calendarDate < startIso || event.calendarDate > endIso) return;
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
      rangeLabel: `${startIso} · ${endIso}`,
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
