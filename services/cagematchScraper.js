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

const DETAIL_LABELS = [
  'Name of the event',
  'Date',
  'Promotion',
  'Type',
  'Location',
  'Arena',
  'Broadcast type',
  'Broadcast date',
  'TV station/network',
];

function normalizeDate(rawDate) {
  if (!rawDate) return null;
  const cleaned = rawDate.replace(/\s+/g, ' ').trim();

  const dmY = cleaned.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (dmY) {
    const [, dd, mm, yy] = dmY;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsed.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

function todayStartTimestamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function normalizeLink(href, fallbackUrl) {
  if (!href) return fallbackUrl;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `https://www.cagematch.net${href}`;
  return `https://www.cagematch.net/${href}`;
}

function extractLocationFromCells(cellsText) {
  return cellsText.find((text) => text.includes(',') && text.length > 3) || 'Por confirmar';
}

function parseTableRows($, sourceUrl, promotion) {
  const events = [];

  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return;

    const textCells = cells
      .map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);

    const dateText = textCells.find((text) => /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/.test(text));
    const date = normalizeDate(dateText);
    if (!date) return;

    const timestamp = new Date(`${date}T00:00:00Z`).getTime();
    if (Number.isNaN(timestamp) || timestamp < todayStartTimestamp()) return;

    const detailAnchor = $(row).find('a[href*="id=1"][href*="nr="]').first();
    const nameAnchor = detailAnchor.length ? detailAnchor : $(row).find('a').first();
    const name = nameAnchor.text().replace(/\s+/g, ' ').trim();
    if (!name) return;

    const url = normalizeLink(nameAnchor.attr('href'), sourceUrl);

    events.push({
      id: uuidv4(),
      name,
      promotion,
      date,
      location: extractLocationFromCells(textCells),
      url,
      timestamp,
    });
  });

  return events;
}

function extractMetadataFromLines(lines) {
  const metadata = {};

  DETAIL_LABELS.forEach((label) => {
    const line = lines.find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
    if (line) {
      metadata[label] = line.slice(line.indexOf(':') + 1).trim();
    }
  });

  return metadata;
}

function extractMatches(lines) {
  const cleaned = lines.filter((line) => line.length > 2 && line.length < 260);
  const matches = [];

  for (let i = 0; i < cleaned.length; i += 1) {
    const line = cleaned[i];
    const next = cleaned[i + 1] || '';

    const isStipulation =
      /match$/i.test(line) ||
      /title match$/i.test(line) ||
      /battle royal/i.test(line) ||
      /tournament/i.test(line);

    const isVersus = /\bvs\.?\b/i.test(line);
    const nextIsVersus = /\bvs\.?\b/i.test(next);

    if (isStipulation && nextIsVersus) {
      matches.push(`${line} — ${next}`);
      i += 1;
      continue;
    }

    if (isVersus) {
      matches.push(line);
    }
  }

  return [...new Set(matches)].slice(0, 40);
}

async function scrapeEventDetail(url) {
  try {
    const response = await axios.get(url, REQUEST_CONFIG);
    const $ = cheerio.load(response.data);

    const content = $('#GSL').length ? $('#GSL') : $('body');
    const pageTitle = $('h1').first().text().replace(/\s+/g, ' ').trim() || $('title').first().text().trim();

    const lines = content
      .text()
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const metadata = extractMetadataFromLines(lines);
    const matches = extractMatches(lines);

    return {
      pageTitle,
      metadata,
      matches,
      rawLines: lines.slice(0, 220),
    };
  } catch (error) {
    return {
      pageTitle: '',
      metadata: {},
      matches: [],
      rawLines: [],
      scrapeError: error.message,
    };
  }
}

async function scrapePromotionEvents(url, promotion) {
  try {
    const response = await axios.get(url, REQUEST_CONFIG);
    const $ = cheerio.load(response.data);

    const parsed = parseTableRows($, url, promotion);
    return parsed;
  } catch (error) {
    console.error(`[scraper] Error en ${promotion}:`, error.message);
    return [];
  }
}

module.exports = {
  scrapePromotionEvents,
  scrapeEventDetail,
  todayStartTimestamp,
};
