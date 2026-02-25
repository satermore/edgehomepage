const carousel = document.getElementById('carousel');
const banners = [...carousel.children];
const leftArrow = document.getElementById('carousel-left');
const rightArrow = document.getElementById('carousel-right');
let current = 0;

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

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') moveCarousel(1);
  if (e.key === 'ArrowLeft') moveCarousel(-1);
  if (e.key === 'Enter') banners[current].click();
});

updateActive();

function startDateTime({
  clockElementId = 'clock',
  dateElementId = 'date',
  locale = 'es-ES',
  withSeconds = true,
} = {}) {
  const clockElement = document.getElementById(clockElementId);
  const dateElement = document.getElementById(dateElementId);

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

function startWeather({
  apiKey,
  lat,
  lon,
  weatherElementId = 'weather',
  units = 'metric',
  lang = 'es',
} = {}) {
  const weatherContainer = document.getElementById(weatherElementId);

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

async function openEventDetail(eventId) {
  const res = await fetch(`/api/wrestling/event/${eventId}`);
  if (!res.ok) return;
  const event = await res.json();

  openModal(`
    <h3 id="event-title">${event.name}</h3>
    <p><strong>Empresa:</strong> ${event.promotion}</p>
    <p><strong>Fecha:</strong> ${event.date}</p>
    <p><strong>Lugar:</strong> ${event.location}</p>
    <p><a href="${event.url}" target="_blank" rel="noreferrer">Ver en Cagematch</a></p>
  `);
}

async function loadWrestlingWeek() {
  try {
    const response = await fetch('/api/wrestling/week');
    if (!response.ok) throw new Error('No se pudo cargar');

    const week = await response.json();
    wrestlingWeek.innerHTML = '';

    week.forEach((day) => {
      const dayCard = document.createElement('article');
      dayCard.className = 'day-column';

      const eventsHtml = day.events.length
        ? day.events
            .map(
              (event) =>
                `<button class="event-chip" data-id="${event.id}"><strong>${event.name}</strong><span>${event.promotion}</span><small>${event.location}</small></button>`,
            )
            .join('')
        : '<p class="empty-events">Sin eventos</p>';

      dayCard.innerHTML = `<header><span>${day.dayLabel}</span><h4>${day.date}</h4></header>${eventsHtml}`;
      wrestlingWeek.appendChild(dayCard);
    });

    wrestlingWeek.querySelectorAll('.event-chip').forEach((button) => {
      button.addEventListener('click', () => openEventDetail(button.dataset.id));
    });

    wrestlingStatus.textContent = 'Eventos cargados';
  } catch (error) {
    wrestlingStatus.textContent = `Error: ${error.message}`;
  }
}

startDateTime({ locale: 'es-ES', withSeconds: true });
startWeather({
  apiKey: '0627f20cfd7258e0d3daeae5135c9e1d',
  lat: 41.5036,
  lon: -5.7461,
  weatherElementId: 'weather',
  units: 'metric',
  lang: 'es',
});
loadWrestlingWeek();
