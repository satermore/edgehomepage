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

function cleanText(value = '') {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

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
      .map((__, cell) => cleanText($(cell).text()))
      .get()
      .filter(Boolean);

    const dateText = textCells.find((text) => /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/.test(text));
    const date = normalizeDate(dateText);
    if (!date) return;

    const timestamp = new Date(`${date}T00:00:00Z`).getTime();
    if (Number.isNaN(timestamp)) return;

    const detailAnchor = $(row).find('a[href*="id=1"][href*="nr="]').first();
    const nameAnchor = detailAnchor.length ? detailAnchor : $(row).find('a').first();
    const name = cleanText(nameAnchor.text());
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

function extractMetadata($) {
  const metadata = {};
  const titles = $('div.InformationBoxTitle');
  const contents = $('div.InformationBoxContents');

  const total = Math.min(titles.length, contents.length);
  for (let index = 0; index < total; index += 1) {
    const label = cleanText($(titles[index]).text()).replace(/:$/, '');
    const value = cleanText($(contents[index]).text());
    if (label && value) metadata[label] = value;
  }

  return metadata;
}

function extractMatches($) {
  return $('div.Match')
    .map((_, match) => {
      const type = cleanText($(match).find('div.MatchType').first().text()) || 'Match';
      const result = cleanText($(match).find('div.MatchResults').first().text());

      if (!result) return null;

      return {
        type,
        result,
      };
    })
    .get()
    .filter(Boolean);
}

function extractAllWorkers($) {
  const caption = $('div.Caption').filter((_, element) => /all workers/i.test($(element).text())).first();
  if (!caption.length) return '';

  const namesContainer = caption.nextAll('div.Comments').first();
  return cleanText(namesContainer.text());
}

function extractAdditionalSections($) {
  const sections = [];

  $('div.Caption').each((_, element) => {
    const title = cleanText($(element).text());
    if (!title) return;

    const body = cleanText($(element).next('div.Comments').text());
    if (!body) return;

    if (/all workers/i.test(title)) return;

    sections.push({ title, body });
  });

  return sections;
}

async function scrapeEventDetail(url) {
  try {
    const response = await axios.get(url, REQUEST_CONFIG);
    const $ = cheerio.load(response.data);

    const pageTitle = cleanText($('h1').first().text()) || cleanText($('title').first().text());
    const metadata = extractMetadata($);
    const matches = extractMatches($);
    const allWorkers = extractAllWorkers($);
    const additionalSections = extractAdditionalSections($);

    return {
      pageTitle,
      metadata,
      matches,
      allWorkers,
      additionalSections,
    };
  } catch (error) {
    return {
      pageTitle: '',
      metadata: {},
      matches: [],
      allWorkers: '',
      additionalSections: [],
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
