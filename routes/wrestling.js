const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { scrapeEventDetail } = require('../services/cagematchScraper');

const router = express.Router();
const FILE_PATH = path.join(__dirname, '..', 'data', 'wrestlingEventsMonth.json');

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const HISTORY_WINDOW_DAYS = 7;
const FUTURE_WINDOW_DAYS = 14;

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
  return getEtNowParts().isoDate;
}

function getRollingDaysWindow(dayOffset = 0) {
  const startIso = addDaysIso(getLogicalTodayIso(), dayOffset);
  const endIso = addDaysIso(startIso, 6);
  return { startIso, endIso };
}

async function readMonthEvents() {
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.events) ? parsed.events : [];
}

router.get('/week', async (req, res) => {
  try {
    const events = await readMonthEvents();
    const dayOffset = Number.parseInt(req.query.dayOffset || '0', 10) || 0;
    const { startIso, endIso } = getRollingDaysWindow(dayOffset);
    const logicalTodayIso = getLogicalTodayIso();
    const minAllowedIso = addDaysIso(logicalTodayIso, -HISTORY_WINDOW_DAYS);
    const maxAllowedIso = addDaysIso(logicalTodayIso, FUTURE_WINDOW_DAYS);

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

    events.forEach((event) => {
      const calendarDate = event.calendarDate || event.date;
      if (calendarDate < startIso || calendarDate > endIso) return;
      const target = days.find((day) => day.date === calendarDate);
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
    const events = await readMonthEvents();
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
