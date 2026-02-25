const carousel = document.getElementById('carousel');
const banners = [...carousel.children];
let current = 0;

function updateActive() {
    banners.forEach(b => b.classList.remove('active'));
    banners[current].classList.add('active');

    const banner = banners[current];
    const offset = banner.offsetLeft - (carousel.offsetWidth / 2 - banner.offsetWidth / 2);
    carousel.scrollTo({ left: offset, behavior: 'smooth' });
}

updateActive();

document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') {
        if (current < banners.length - 1) current++;
        updateActive();
    }
    if (e.key === 'ArrowLeft') {
        if (current > 0) current--;
        updateActive();
    }
    if (e.key === 'Enter') {
        banners[current].click();
    }
});

function startDateTime({
    clockElementId = 'clock',
    dateElementId = 'date',
    locale = 'es-ES',
    withSeconds = true,
} = {}) {
    const clockElement = document.getElementById(clockElementId);
    const dateElement = document.getElementById(dateElementId);

    if (!clockElement || !dateElement) {
        throw new Error('No se encontraron los elementos de hora/fecha en el DOM.');
    }

    function renderDateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        clockElement.textContent = withSeconds
            ? `${hours}:${minutes}:${seconds}`
            : `${hours}:${minutes}`;

        const day = now.toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

        dateElement.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    }

    renderDateTime();
    const intervalId = setInterval(renderDateTime, 1000);

    return {
        stop: () => clearInterval(intervalId),
        refresh: renderDateTime,
    };
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
    if (!weatherContainer) {
        throw new Error('No se encontró el contenedor del clima en el DOM.');
    }

    if (!apiKey) {
        weatherContainer.innerHTML = '<p>Configura tu API key de OpenWeatherMap para ver el clima.</p>';
        return { refresh: () => null };
    }

    function renderForecast(data) {
        let html = `<h3>Clima actual: ${data.list[0].main.temp.toFixed(1)}°C, ${data.list[0].weather[0].description}</h3>`;
        html += '<div class="daily">';

        const dailyData = data.list.filter(item => item.dt_txt.includes('12:00:00')).slice(0, 5);
        dailyData.forEach(day => {
            const date = new Date(day.dt * 1000);
            const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
            const icon = `https://openweathermap.org/img/wn/${day.weather[0].icon}.png`;
            const desc = day.weather[0].description.charAt(0).toUpperCase() + day.weather[0].description.slice(1);
            const temp = day.main.temp.toFixed(1);

            html += `
                <div class="day">
                    <h4>${dayName}</h4>
                    <img src="${icon}" alt="${desc}" />
                    <p>${desc}</p>
                    <p>Temperatura: ${temp}°C</p>
                </div>
            `;
        });

        html += '</div>';
        weatherContainer.innerHTML = html;
    }

    async function refresh() {
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&lang=${lang}&appid=${apiKey}`,
            );
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data || !data.list) {
                throw new Error('Datos inválidos');
            }

            renderForecast(data);
        } catch (error) {
            console.error('Error al obtener el pronóstico:', error.message);
            weatherContainer.innerHTML = `<p>Error: ${error.message}</p>`;
        }
    }

    refresh();
    return { refresh };
}

startDateTime({
    clockElementId: 'clock',
    dateElementId: 'date',
    locale: 'es-ES',
    withSeconds: true,
});

startWeather({
    apiKey: '',
    lat: 41.5036,
    lon: -5.7461,
    weatherElementId: 'weather',
    units: 'metric',
    lang: 'es',
});
