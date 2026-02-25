const carousel = document.getElementById('carousel');
const banners = [...carousel.children];
const leftArrow = document.getElementById('carousel-left');
const rightArrow = document.getElementById('carousel-right');
let current = 0;

const PROMOTION_LOGOS = {
  WWE: 'logos/WWE_LOGO.png',
  'All Elite Wrestling': 'logos/AEW_LOGO.webp',
  'Lucha Libre AAA Worldwide': 'logos/AAA_LOGO.png',
  'TNA Wrestling': 'logos/TNA_LOGO.png',
  'Consejo Mundial de Lucha Libre': 'logos/CMLL_LOGO.png',
  'New Japan Pro-Wrestling': 'logos/NJPW_LOGO.png',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getPromotionLogo(promotion = '') {
  const matched = Object.keys(PROMOTION_LOGOS).find((key) => promotion.includes(key));
  return matched ? PROMOTION_LOGOS[matched] : 'assets/wrestling.png';
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
  const dateElement = document.getElementById('date');

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
const wrestlingStatus = document.getElementById('wrestling-status');
const nbaWeek = document.getElementById('nba-week');
const nbaStatus = document.getElementById('nba-status');
const eventModal = document.getElementById('event-modal');
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.getElementById('close-modal');

function openModal(content) {
  modalBody.innerHTML = content;
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
  const entries = Object.entries(metadata || {});
  if (!entries.length) return '<p class="modal-empty">No se encontraron metadatos del evento.</p>';

  return `<div class="modal-meta-grid">${entries
    .map(
      ([label, value]) =>
        `<div class="meta-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || ''))}</strong></div>`,
    )
    .join('')}</div>`;
}

function renderMatches(matches) {
  if (!matches?.length) return '<p class="modal-empty">No se pudieron extraer combates automáticamente.</p>';

  return `<ul class="modal-match-list">${matches
    .map((match) => {
      if (typeof match === 'string') {
        return `<li><p>${escapeHtml(match)}</p></li>`;
      }

      return `<li><small>${escapeHtml(match.type || 'Match')}</small><p>${escapeHtml(match.result || '')}</p></li>`;
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
  const promotionLogo = getPromotionLogo(event.promotion || event.details?.metadata?.Promotion || '');
  const metadata = {
    ...(event.details?.metadata || {}),
    ...(event.date && !event.details?.metadata?.Date ? { Date: event.date } : {}),
    ...(event.location && !event.details?.metadata?.Location ? { Location: event.location } : {}),
    ...(event.promotion && !event.details?.metadata?.Promotion ? { Promotion: event.promotion } : {}),
  };

  openModal(`
    <div class="modal-header">
      <img class="promotion-logo" src="${promotionLogo}" alt="Logo de promoción" loading="lazy" />
      <div>
        <h3 id="event-title">${escapeHtml(event.name)}</h3>
        <p class="modal-sub">${escapeHtml(event.promotion || '')}</p>
      </div>
    </div>

    <div class="modal-section">
      <h4>Información del evento</h4>
      ${renderDetailMetadata(metadata)}
    </div>

    <div class="modal-section">
      <h4>Cartelera / combates</h4>
      ${renderMatches(event.details?.matches)}
    </div>

    ${
      event.details?.allWorkers
        ? `<div class="modal-section"><h4>All workers</h4><p>${escapeHtml(event.details.allWorkers)}</p></div>`
        : ''
    }

    ${renderExtraSections(event.details?.additionalSections)}

    <a class="modal-link" href="${eventLink}" target="_blank" rel="noopener noreferrer">Abrir evento completo en Cagematch</a>
  `);
}

async function loadWrestlingWeek() {
  try {
    const response = await fetch('/api/wrestling/week');
    if (!response.ok) throw new Error('No se pudo cargar wrestling');

    const week = await response.json();
    wrestlingWeek.innerHTML = '';

    week.forEach((day) => {
      const dayCard = document.createElement('article');
      dayCard.className = 'day-column';

      const eventsHtml = day.events.length
        ? day.events
            .map(
              (event) =>
                `<button class="event-chip" data-id="${event.id}"><strong>${escapeHtml(event.name)}</strong><span>${escapeHtml(event.promotion)}</span><small>${escapeHtml(event.location)}</small></button>`,
            )
            .join('')
        : '<p class="empty-events">Sin eventos</p>';

      dayCard.innerHTML = `<header><span>${day.dayLabel}</span><h4>${day.date}</h4></header>${eventsHtml}`;
      wrestlingWeek.appendChild(dayCard);
    });

    wrestlingWeek.querySelectorAll('.event-chip').forEach((button) => {
      button.addEventListener('click', () => openEventDetail(button.dataset.id));
    });

    wrestlingStatus.textContent = 'Eventos listos';
  } catch (error) {
    wrestlingStatus.textContent = `Error: ${error.message}`;
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
