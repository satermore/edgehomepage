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

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

router.get('/week', async (_req, res) => {
  try {
    const events = await readAndCleanEvents();
    const { monday, sunday } = getCurrentWeekRange();

    const weekDays = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const isoDate = date.toISOString().slice(0, 10);
      return {
        date: isoDate,
        dayLabel: DAY_LABELS[date.getDay()],
        events: [],
      };
    });

    events.forEach((event) => {
      const eventDate = new Date(`${event.date}T00:00:00`);
      if (eventDate < monday || eventDate > sunday) return;
      const target = weekDays.find((day) => day.date === event.date);
      if (!target) return;
      target.events.push({
        id: event.id,
        name: event.name,
        promotion: event.promotion,
        location: event.location,
      });
    });

    res.json(weekDays);
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
