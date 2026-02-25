const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');

const REQUEST_CONFIG = {
  timeout: 15_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
};

function normalizeDate(rawDate) {
  if (!rawDate) return null;
  const cleaned = rawDate.replace(/\s+/g, ' ').trim();
  const candidates = [cleaned, cleaned.replace(/\./g, '-'), cleaned.replace(/\//g, '-')];

  for (const candidate of candidates) {
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = `${d.getMonth() + 1}`.padStart(2, '0');
      const day = `${d.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const match = cleaned.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (match) {
    const [, dd, mm, yy] = match;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  return null;
}

function todayStartTimestamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

async function scrapePromotionEvents(url, promotion) {
  try {
    const response = await axios.get(url, REQUEST_CONFIG);
    const $ = cheerio.load(response.data);
    const events = [];

    $('table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (!cells.length) return;

      const nameAnchor = $(row).find('a').first();
      const rawName = nameAnchor.text().trim() || cells.eq(1).text().trim();
      if (!rawName) return;

      const rawDate = cells
        .map((__, cell) => $(cell).text().trim())
        .get()
        .find((text) => /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(text));

      const isoDate = normalizeDate(rawDate);
      if (!isoDate) return;

      const timestamp = new Date(`${isoDate}T00:00:00Z`).getTime();
      if (Number.isNaN(timestamp) || timestamp < todayStartTimestamp()) return;

      const location =
        cells
          .map((__, cell) => $(cell).text().trim())
          .get()
          .find((text) => /,/.test(text) && text.length > 3) || 'Por confirmar';

      const href = nameAnchor.attr('href');
      const normalizedUrl = href
        ? href.startsWith('http')
          ? href
          : `https://www.cagematch.net${href}`
        : url;

      events.push({
        id: uuidv4(),
        name: rawName,
        promotion,
        date: isoDate,
        location,
        url: normalizedUrl,
        timestamp,
      });
    });

    return events;
  } catch (error) {
    console.error(`[scraper] Error en ${promotion}:`, error.message);
    return [];
  }
}

module.exports = {
  scrapePromotionEvents,
  todayStartTimestamp,
};
