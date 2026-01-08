const carousel = document.getElementById('carousel');
const banners = [...carousel.children];
let current = 0; // Netflix activo por defecto

function updateActive() {
    banners.forEach(b => b.classList.remove('active'));
    banners[current].classList.add('active');

    // Snap scroll: centrar el banner activo
    const banner = banners[current];
    const offset = banner.offsetLeft - (carousel.offsetWidth/2 - banner.offsetWidth/2);
    carousel.scrollTo({ left: offset, behavior: 'smooth' });
}

// Inicializamos centrado en Netflix
updateActive();

// Control con flechas
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
