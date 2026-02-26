const carousel = document.getElementById('carousel');
const banners = [...carousel.children];
const leftArrow = document.getElementById('carousel-left');
const rightArrow = document.getElementById('carousel-right');
let current = 0;

const EVENT_BRANDS = {
  raw: { logo: 'logos/WWE_RAW_LOGO.svg', color: '#e10600', label: 'RAW', theme: 'brand-raw' },
  smackdown: { logo: 'logos/WWE_SMACKDOWN_LOGO.svg', color: '#1677ff', label: 'SmackDown', theme: 'brand-smackdown' },
  nxt: { logo: 'logos/WWE_NXT_LOGO.webp', color: '#f0c10a', label: 'NXT', theme: 'brand-nxt' },
  dynamite: { logo: 'logos/AEW_DYNAMITE_LOGO.webp', color: '#2d313a', label: 'Dynamite', theme: 'brand-dynamite' },
  tna: { logo: 'logos/TNA_LOGO.png', color: '#d7121f', label: 'TNA', theme: 'brand-tna' },
  njpw: { logo: 'logos/NJPW_LOGO.png', color: '#d9ab1a', label: 'NJPW', theme: 'brand-njpw' },
  aaa: { logo: 'logos/AAA_LOGO.png', color: '#00a650', label: 'AAA', theme: 'brand-aaa' },
  ppv: { logo: 'logos/WWE_PPV_LOGO.png', color: '#ff8b1f', label: 'PPV / PLE', theme: 'brand-ppv' },
  aewPpv: { logo: 'logos/AEW_PPV_LOGO.png', color: '#ff8b1f', label: 'PPV / PLE', theme: 'brand-ppv' },
  cmll: { logo: 'logos/CMLL_LOGO.png', color: '#bb2035', label: 'CMLL', theme: 'brand-cmll' },
  default: { logo: 'assets/wrestling.png', color: '#e10600', label: 'Wrestling', theme: 'brand-default' },
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getEventBrand(event = {}) {
  const name = `${event.name || ''}`.toLowerCase();
  const promotion = `${event.promotion || ''}`.toLowerCase();

  if (name.includes('raw')) return EVENT_BRANDS.raw;
  if (name.includes('smackdown')) return EVENT_BRANDS.smackdown;
  if (name.includes('nxt')) return EVENT_BRANDS.nxt;
  if (name.includes('dynamite')) return EVENT_BRANDS.dynamite;
  if (name.includes('impact')) return EVENT_BRANDS.tna;
  if (promotion.includes('new japan')) return EVENT_BRANDS.njpw;
  if (promotion.includes('aaa')) return EVENT_BRANDS.aaa;
  if (promotion.includes('consejo mundial')) return EVENT_BRANDS.cmll;

  const tvKeywords = ['#', 'tag', 'live', 'taping', 'collision', 'rampage', 'dark'];
  const looksLikeTV = tvKeywords.some((keyword) => name.includes(keyword));
  if (!looksLikeTV) {
    return promotion.includes('all elite') ? EVENT_BRANDS.aewPpv : EVENT_BRANDS.ppv;
  }

  if (promotion.includes('all elite')) return EVENT_BRANDS.dynamite;
  if (promotion.includes('tna')) return EVENT_BRANDS.tna;
  if (promotion.includes('wwe')) return EVENT_BRANDS.ppv;

  return EVENT_BRANDS.default;
}



const SHOW_SCHEDULE = {
  raw: { hour: 20, minute: 0 },
  nxt: { hour: 20, minute: 0 },
  dynamite: { hour: 20, minute: 0 },
  tna: { hour: 21, minute: 0 },
  smackdown: { hour: 20, minute: 0 },
  collision: { hour: 20, minute: 0 },
};

function getScheduleKey(event = {}) {
  const name = `${event.name || ''}`.toLowerCase();
  if (name.includes('raw')) return 'raw';
  if (name.includes('nxt')) return 'nxt';
  if (name.includes('dynamite')) return 'dynamite';
  if (name.includes('impact')) return 'tna';
  if (name.includes('smackdown')) return 'smackdown';
  if (name.includes('collision')) return 'collision';
  return '';
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
    });

    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((item) => [item.type, item.value]));
    return {
      isoDate: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour || 0),
      minute: Number(parts.minute || 0),
      second: Number(parts.second || 0),
    };
  } catch {
    const now = new Date();
    return {
      isoDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    };
  }
}

function getEventSchedule(event = {}) {
  const key = getScheduleKey(event);
  if (!key) return { label: '', live: false };

  const schedule = SHOW_SCHEDULE[key];
  const nowEt = getEtNowParts();
  const startMinutes = schedule.hour * 60 + (schedule.minute || 0);
  const nowMinutes = nowEt.hour * 60 + nowEt.minute;
  const live = nowEt.isoDate === event.date && nowMinutes >= startMinutes && nowMinutes < startMinutes + 240;

  const etTime = new Date(Date.UTC(2000, 0, 1, schedule.hour, schedule.minute || 0, 0)).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    label: `${etTime} ET`,
    live,
  };
}

function updateActive() {
  banners.forEach((b) => b.classList.remove('active'));
  banners[current].classList.add('active');

  const banner = banners[current];
  const offset = banner.offsetLeft - (carousel.offsetWidth / 2 - banner.offsetWidth / 2);
  carousel.scrollTo({ left: offset, behavior: 'smooth' });
}

function moveCarousel(step) {
  current = Math.min(banners.length - 1, Math.max(0, current + step));
  updateActive();
}

leftArrow.addEventListener('click', () => moveCarousel(-1));
rightArrow.addEventListener('click', () => moveCarousel(1));

carousel.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    carousel.scrollBy({ left: event.deltaY + event.deltaX, behavior: 'smooth' });
  },
  { passive: false },
);

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') moveCarousel(1);
  if (event.key === 'ArrowLeft') moveCarousel(-1);
  if (event.key === 'Enter') banners[current].click();
});

updateActive();

function startDateTime({ locale = 'es-ES', withSeconds = true } = {}) {
  const clockElement = document.getElementById('clock');
  const clockEtElement = document.getElementById('clock-et');
  const dateElement = document.getElementById('date');
  if (!clockElement || !dateElement) return;

  function renderDateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    clockElement.textContent = withSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;

    const day = now.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const et = getEtNowParts();
    if (clockEtElement) {
      clockEtElement.textContent = `ET ${String(et.hour).padStart(2, '0')}:${String(et.minute).padStart(2, '0')}:${String(et.second).padStart(2, '0')}`;
    }
    dateElement.textContent = day.charAt(0).toUpperCase() + day.slice(1);
  }

  renderDateTime();
  setInterval(renderDateTime, 1000);
}

function startWeather({ apiKey, lat, lon, units = 'metric', lang = 'es' } = {}) {
  const weatherContainer = document.getElementById('weather');

  async function refresh() {
    if (!apiKey) {
      weatherContainer.innerHTML = '<p>Configura tu API key de OpenWeatherMap para ver el clima.</p>';
      return;
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&lang=${lang}&appid=${apiKey}`,
      );
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

      const data = await response.json();
      let html = `<h3>Clima actual: ${data.list[0].main.temp.toFixed(1)}°C, ${data.list[0].weather[0].description}</h3>`;
      html += '<div class="daily">';

      const dailyData = data.list.filter((item) => item.dt_txt.includes('12:00:00')).slice(0, 5);
      dailyData.forEach((day) => {
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
        const icon = `https://openweathermap.org/img/wn/${day.weather[0].icon}.png`;
        const desc = `${day.weather[0].description.charAt(0).toUpperCase()}${day.weather[0].description.slice(1)}`;
        const temp = day.main.temp.toFixed(1);

        html += `<div class="day"><h4>${dayName}</h4><img src="${icon}" alt="${desc}"><p>${desc}</p><p>${temp}°C</p></div>`;
      });

      html += '</div>';
      weatherContainer.innerHTML = html;
    } catch (error) {
      weatherContainer.innerHTML = `<p>Error clima: ${error.message}</p>`;
    }
  }

  refresh();
}

const wrestlingWeek = document.getElementById('wrestling-week');
const wrestlingTitle = document.getElementById('wrestling-title');
const wrestlingPrevWeekBtn = document.getElementById('wrestling-prev-week');
const wrestlingNextWeekBtn = document.getElementById('wrestling-next-week');
let wrestlingDayOffset = 0;
const nbaWeek = document.getElementById('nba-week');
const nbaStatus = document.getElementById('nba-status');
const eventModal = document.getElementById('event-modal');
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.getElementById('close-modal');
const modalContent = document.getElementById('event-modal-content');

function openModal(content, brandTheme = 'brand-default') {
  modalBody.innerHTML = content;
  modalContent.className = `modal-content ${brandTheme}`;
  eventModal.classList.remove('hidden');
}

function closeModal() {
  eventModal.classList.add('hidden');
}

closeModalBtn.addEventListener('click', closeModal);
eventModal.addEventListener('click', (event) => {
  if (event.target === eventModal) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

function renderDetailMetadata(metadata) {
  const hiddenLabels = [
    /^name of the event$/i,
    /^date$/i,
    /^location$/i,
    /^arena$/i,
    /^attendance$/i,
    /^promotion$/i,
    /^type$/i,
    /tv\s*station\s*\/\s*network/i,
    /broadcast\s*type/i,
    /broadcast\s*date/i,
  ];
  const entries = Object.entries(metadata || {}).filter(([label]) => !hiddenLabels.some((pattern) => pattern.test(label)));
  if (!entries.length) return '';

  return `<div class="modal-meta-grid">${entries
    .map(
      ([label, value]) =>
        `<div class="meta-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || ''))}</strong></div>`,
    )
    .join('')}</div>`;
}



function metadataValue(metadata = {}, keyPattern) {
  return Object.entries(metadata).find(([key]) => keyPattern.test(key))?.[1] || '';
}

function formatDisplayDate(raw = '') {
  if (!raw) return '';
  const [year, month, day] = String(raw).split('-');
  if (year && month && day) return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;

  const date = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  const dd = `${date.getDate()}`.padStart(2, '0');
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

function formatDateLabel(raw = '') {
  return formatDisplayDate(raw);
}

function renderEventInfo(metadata, event) {
  const date = metadataValue(metadata, /^date$/i) || event.date;
  const location = metadataValue(metadata, /^location$/i) || event.location;
  const arena = metadataValue(metadata, /^arena$/i);
  const attendance = metadataValue(metadata, /^attendance$/i);
  const broadcastType = metadataValue(metadata, /broadcast\s*type/i);
  const broadcastDate = metadataValue(metadata, /broadcast\s*date/i);
  const promotion = metadataValue(metadata, /^promotion$/i) || event.promotion;
  const eventType = metadataValue(metadata, /^type$/i);
  const tvNetwork = metadataValue(metadata, /tv\s*station\s*\/\s*network/i);

  const infoItems = [
    { icon: '📅', value: formatDateLabel(date) },
    { icon: '📍', value: location },
    { icon: '🏟️', value: arena },
    { icon: '👥', value: attendance },
    { icon: '🎬', value: broadcastType },
    { icon: '🗓️', value: formatDateLabel(broadcastDate) },
    { icon: '🏢', value: promotion },
    { icon: '📺', value: eventType },
    { icon: '📡', value: tvNetwork },
  ].filter((item) => item.value);

  return `<div class="event-facts">${infoItems
    .map((item) => `<span class="event-fact"><b>${item.icon}</b>${escapeHtml(item.value)}</span>`)
    .join('')}</div>`;
}

function renderMatches(matches) {
  if (!matches?.length) return '<p class="modal-empty">No se pudieron extraer combates automáticamente.</p>';

  return `<ul class="modal-match-list">${matches
    .map((match, index) => {
      if (typeof match === 'string') {
        return `<li><span class="match-index">#${index + 1}</span><p>${escapeHtml(match)}</p></li>`;
      }

      return `<li><span class="match-index">#${index + 1}</span><div><small>${escapeHtml(match.type || 'Match')}</small><p>${escapeHtml(
        match.result || '',
      )}</p></div></li>`;
    })
    .join('')}</ul>`;
}

function renderExtraSections(sections) {
  if (!sections?.length) return '';

  return sections
    .map(
      (section) =>
        `<div class="modal-section"><h4>${escapeHtml(section.title)}</h4><p>${escapeHtml(section.body)}</p></div>`,
    )
    .join('');
}

async function openEventDetail(eventId) {
  const res = await fetch(`/api/wrestling/event/${eventId}`);
  if (!res.ok) return;
  const event = await res.json();

  const eventLink = event.url && event.url.startsWith('http') ? event.url : '#';
  const eventBrand = getEventBrand(event);
  const metadata = {
    ...(event.details?.metadata || {}),
    ...(event.date && !event.details?.metadata?.Date ? { Date: event.date } : {}),
    ...(event.location && !event.details?.metadata?.Location ? { Location: event.location } : {}),
    ...(event.promotion && !event.details?.metadata?.Promotion ? { Promotion: event.promotion } : {}),
  };

  openModal(`
    <div class="modal-header" style="--event-color: ${eventBrand.color}">
      <img class="promotion-logo" src="${eventBrand.logo}" alt="Logo de ${escapeHtml(eventBrand.label)}" loading="lazy" />
      <div>
        <h3 id="event-title">${escapeHtml(event.name)}</h3>
        <p class="modal-sub">${escapeHtml(event.promotion || '')} · <span class="brand-pill">${escapeHtml(eventBrand.label)}</span></p>
      </div>
    </div>

    <div class="modal-section">
      ${renderEventInfo(metadata, event)}
      ${renderDetailMetadata(metadata)}
    </div>

    <div class="modal-section">
      <h4>Cartelera / combates</h4>
      ${renderMatches(event.details?.matches)}
    </div>

    ${renderExtraSections(event.details?.additionalSections)}

    <a class="modal-link" href="${eventLink}" target="_blank" rel="noopener noreferrer">Abrir evento completo en Cagematch</a>
  `, eventBrand.theme);
}

async function loadWrestlingWeek(offset = wrestlingDayOffset) {
  try {
    const response = await fetch(`/api/wrestling/week?dayOffset=${offset}`);
    if (!response.ok) throw new Error('No se pudo cargar wrestling');

    const payload = await response.json();
    const week = payload.days || [];
    wrestlingWeek.innerHTML = '';
    wrestlingDayOffset = payload.dayOffset || 0;
    const [rangeStart, rangeEnd] = String(payload.rangeLabel || '').split(' · ');
    wrestlingTitle.textContent = `Wrestling (${formatDisplayDate(rangeStart)} · ${formatDisplayDate(rangeEnd)})`;

    week.forEach((day) => {
      const dayCard = document.createElement('article');
      dayCard.className = `day-column${day.isToday ? ' is-today' : ''}`;

      const eventsHtml = day.events.length
        ? day.events
            .map(
              (event) => {
                const schedule = getEventSchedule(event);
                const scheduleHtml = schedule.label
                  ? `<small>${escapeHtml(event.location)} · ⏰ ${schedule.label}${schedule.live ? ' · 🔴 Live' : ''}</small>`
                  : `<small>${escapeHtml(event.location)}</small>`;

                return `<button class="event-chip" data-id="${event.id}" style="--event-color: ${getEventBrand(event).color}">
                  <img class="event-logo" src="${getEventBrand(event).logo}" alt="${escapeHtml(getEventBrand(event).label)}" loading="lazy" />
                  <div>
                    <strong>${escapeHtml(event.name)}</strong>
                    <span>${escapeHtml(event.promotion)}</span>
                    ${scheduleHtml}
                  </div>
                </button>`;
              },
            )
            .join('')
        : '<p class="empty-events">Sin eventos</p>';

      dayCard.innerHTML = `<header><span>${day.dayLabel}</span><h4>${formatDisplayDate(day.date)}</h4></header>${eventsHtml}`;
      wrestlingWeek.appendChild(dayCard);
    });

    wrestlingWeek.querySelectorAll('.event-chip').forEach((button) => {
      button.addEventListener('click', () => openEventDetail(button.dataset.id));
    });
  } catch (error) {
    console.error(error);
  }
}

async function loadNbaWeek() {
  try {
    const response = await fetch('/api/nba/week');
    if (!response.ok) throw new Error('No se pudo cargar NBA');

    const data = await response.json();
    const games = data.games || [];
    nbaWeek.innerHTML = '';

    if (!games.length) {
      nbaWeek.innerHTML = '<p class="empty-events">Sin partidos próximos</p>';
    }

    games.forEach((game) => {
      const gameCard = document.createElement('article');
      gameCard.className = 'nba-game';
      gameCard.innerHTML = `
        <div><strong>${escapeHtml(game.away)}</strong> @ <strong>${escapeHtml(game.home)}</strong></div>
        <small>${escapeHtml(game.date)} · ${escapeHtml(game.time)} · ${escapeHtml(game.status)}</small>
      `;
      nbaWeek.appendChild(gameCard);
    });

    nbaStatus.textContent = data.lastUpdate
      ? `Actualizado: ${new Date(data.lastUpdate).toLocaleString('es-ES')}`
      : 'Sin actualizar';
  } catch (error) {
    nbaStatus.textContent = `Error: ${error.message}`;
  }
}

wrestlingWeek.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    wrestlingWeek.scrollBy({ left: event.deltaY + event.deltaX, behavior: 'smooth' });
  },
  { passive: false },
);

wrestlingPrevWeekBtn.addEventListener('click', () => {
  wrestlingDayOffset -= 1;
  loadWrestlingWeek(wrestlingDayOffset);
});

wrestlingNextWeekBtn.addEventListener('click', () => {
  wrestlingDayOffset += 1;
  loadWrestlingWeek(wrestlingDayOffset);
});

startDateTime({ locale: 'es-ES', withSeconds: true });
startWeather({
  apiKey: '0627f20cfd7258e0d3daeae5135c9e1d',
  lat: 41.5036,
  lon: -5.7461,
  units: 'metric',
  lang: 'es',
});
loadWrestlingWeek();
loadNbaWeek();
