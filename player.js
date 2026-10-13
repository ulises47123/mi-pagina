// ==========================================================
// Cosmic Startpage - Visualizador Estelar 3D Ultra Optimizado
// Alto rendimiento (60-144 FPS estables):
// - Batching de dibujo: agrupa trazados en un solo path por color
// - Sin shadowBlur costoso por partícula en cada frame
// - Tipado plano y asignaciones directas sin overhead de garbage collector
// - Limpieza de canvas sin sobrecarga de fillRect persistente
// ==========================================================

let songIndex = 0;
let isAudioPlaying = false;

const audio = document.getElementById('audioElement');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const vinylDisc = document.getElementById('vinylDisc');
const soundEq = document.getElementById('soundEq');
const trackTitle = document.getElementById('trackTitle');
const searchInput = document.getElementById('searchInput');

audio.volume = 1.0;

// Configuración de Canvas y Perspectiva 3D
const canvas = document.getElementById('soundCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
let width = window.innerWidth;
let height = window.innerHeight;
let cx = width * 0.5;
let cy = height * 0.5;

function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    cx = width * 0.5;
    cy = height * 0.5;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ==========================================================
// ARRAYS PLANOS Y RENDIMIENTO OPTIMIZADO
// ==========================================================
const NUM_STARS = 260; // Cantidad óptima para máxima fluidez y densidad visual
const starX = new Float32Array(NUM_STARS);
const starY = new Float32Array(NUM_STARS);
const starZ = new Float32Array(NUM_STARS);
const starPZ = new Float32Array(NUM_STARS);
const starBaseSize = new Float32Array(NUM_STARS);
const starColorIndex = new Uint8Array(NUM_STARS);

let activePalette = ['#ffffff', '#00f0ff', '#a855f7'];
let currentProfile = null;
let currentBeats = [];
let currentBeatIndex = 0;

// Dinámica del Warp Speed
let currentWarpSpeed = 1.8;
let targetWarpSpeed = 1.8;
let flashIntensity = 0.0;

function resetStar(i, initial = false) {
    starX[i] = (Math.random() - 0.5) * width * 2.2;
    starY[i] = (Math.random() - 0.5) * height * 2.2;
    starZ[i] = initial ? (Math.random() * width) : width;
    starPZ[i] = starZ[i];
    starBaseSize[i] = Math.random() * 1.4 + 0.8;
    starColorIndex[i] = Math.floor(Math.random() * activePalette.length);
}

for (let i = 0; i < NUM_STARS; i++) {
    resetStar(i, true);
}

function updateStarProfile(profile) {
    currentProfile = profile || {
        bpm: 110,
        direction: 'up',
        speed: 1.0,
        colors: ['#ffffff', '#00f0ff', '#a855f7'],
        beats: []
    };

    activePalette = currentProfile.colors && currentProfile.colors.length > 0
        ? currentProfile.colors
        : ['#ffffff', '#00f0ff', '#a855f7'];

    currentBeats = currentProfile.beats || [];
    currentBeatIndex = 0;

    for (let i = 0; i < NUM_STARS; i++) {
        starColorIndex[i] = Math.floor(Math.random() * activePalette.length);
    }
}

function loadSong(index) {
    if (!window.playlist || window.playlist.length === 0) return;
    songIndex = index;
    const song = window.playlist[songIndex];
    audio.src = song.file;
    trackTitle.textContent = song.title;
    currentBeatIndex = 0;
    updateStarProfile(song.profile);
}

function togglePlay() {
    if (isAudioPlaying) {
        audio.pause();
    } else {
        audio.volume = 1.0;
        audio.play().catch(e => console.error("Error al reproducir audio:", e));
    }
}

function prevTrack() {
    if (!window.playlist) return;
    songIndex = (songIndex - 1 + window.playlist.length) % window.playlist.length;
    loadSong(songIndex);
    if (isAudioPlaying) audio.play().catch(e => console.error(e));
}

function nextTrack() {
    if (!window.playlist) return;
    songIndex = (songIndex + 1) % window.playlist.length;
    loadSong(songIndex);
    if (isAudioPlaying) audio.play().catch(e => console.error(e));
}

audio.addEventListener('play', () => {
    isAudioPlaying = true;
    vinylDisc.classList.add('playing');
    soundEq.classList.add('active');
    playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
});

audio.addEventListener('pause', () => {
    isAudioPlaying = false;
    vinylDisc.classList.remove('playing');
    soundEq.classList.remove('active');
    playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
});

audio.addEventListener('ended', () => {
    nextTrack();
    audio.play().catch(e => console.error(e));
});

audio.addEventListener('seeked', () => {
    const curTime = audio.currentTime;
    currentBeatIndex = currentBeats.findIndex(t => t >= curTime);
    if (currentBeatIndex === -1) currentBeatIndex = currentBeats.length;
});

playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', prevTrack);
nextBtn.addEventListener('click', nextTrack);

// Atajos de teclado
window.addEventListener('keydown', (e) => {
    if (document.activeElement === searchInput) {
        if (e.key === 'Escape') searchInput.blur();
        return;
    }
    if (e.key === '/') {
        e.preventDefault();
        searchInput.focus();
    } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextTrack();
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevTrack();
    }
});

// ==========================================================
// LOOP DE RENDERIZADO ULTRA EFICIENTE (BATCH RENDERING)
// ==========================================================
const FOV = 320;
let lastFrameTime = performance.now();

function renderStarfield(now) {
    const dt = Math.min((now - lastFrameTime) / 1000.0, 0.1);
    lastFrameTime = now;

    // Limpieza directa y rápida del frame
    ctx.clearRect(0, 0, width, height);

    if (isAudioPlaying && currentBeats.length > 0) {
        const curTime = audio.currentTime;

        let beatHit = false;
        while (currentBeatIndex < currentBeats.length && curTime >= currentBeats[currentBeatIndex]) {
            beatHit = true;
            currentBeatIndex++;
        }

        if (currentBeatIndex > 0 && curTime < currentBeats[currentBeatIndex - 1]) {
            currentBeatIndex = 0;
        }

        if (beatHit) {
            targetWarpSpeed = 22.0 * (currentProfile.speed || 1.0);
            flashIntensity = 1.0;
        } else {
            targetWarpSpeed = 4.2 * (currentProfile.speed || 1.0);
        }

        currentWarpSpeed += (targetWarpSpeed - currentWarpSpeed) * 0.16;
        flashIntensity += (0.0 - flashIntensity) * 0.12;
    } else {
        targetWarpSpeed = 1.2;
        currentWarpSpeed += (targetWarpSpeed - currentWarpSpeed) * 0.08;
        flashIntensity += (0.0 - flashIntensity) * 0.1;
    }

    const direction = currentProfile ? currentProfile.direction : 'up';
    const isDown = (direction === 'down');
    const speed = currentWarpSpeed;
    const invWidth = 1.0 / width;

    // Agrupación de trazados por color (Batching) para reducir drásticamente llamadas GPU/Canvas
    const paletteLen = activePalette.length;
    // Trazado de estelas (líneas) y cabezas (círculos)
    for (let c = 0; c < paletteLen; c++) {
        const color = activePalette[c];

        ctx.strokeStyle = flashIntensity > 0.4 ? '#ffffff' : color;
        ctx.fillStyle = flashIntensity > 0.6 ? '#ffffff' : color;
        ctx.lineWidth = isAudioPlaying ? 2.0 : 1.2;

        let hasLines = false;
        let hasPoints = false;

        // Iniciar path de líneas
        ctx.beginPath();
        for (let i = 0; i < NUM_STARS; i++) {
            if (starColorIndex[i] !== c) continue;

            starPZ[i] = starZ[i];

            if (isDown) {
                starZ[i] += speed;
                if (starZ[i] > width) {
                    resetStar(i);
                    starZ[i] = 18;
                    starPZ[i] = starZ[i];
                }
            } else {
                starZ[i] -= speed;
                if (starZ[i] < 18) {
                    resetStar(i);
                }
            }

            const z = starZ[i];
            if (z <= 1) continue;

            const k = FOV / z;
            const px = starX[i] * k + cx;
            const py = starY[i] * k + cy;

            if (px < -10 || px > width + 10 || py < -10 || py > height + 10) continue;

            const pk = FOV / starPZ[i];
            const prevX = starX[i] * pk + cx;
            const prevY = starY[i] * pk + cy;

            if (isAudioPlaying && (Math.abs(px - prevX) + Math.abs(py - prevY) > 1.5)) {
                ctx.moveTo(prevX, prevY);
                ctx.lineTo(px, py);
                hasLines = true;
            }
        }
        if (hasLines) {
            ctx.stroke();
        }

        // Iniciar path de cabezas de estrellas
        ctx.beginPath();
        for (let i = 0; i < NUM_STARS; i++) {
            if (starColorIndex[i] !== c) continue;
            const z = starZ[i];
            if (z <= 1) continue;

            const k = FOV / z;
            const px = starX[i] * k + cx;
            const py = starY[i] * k + cy;

            if (px < -10 || px > width + 10 || py < -10 || py > height + 10) continue;

            const depthFactor = 1.0 - z * invWidth;
            const rad = Math.max(0.7, starBaseSize[i] * (1.0 + depthFactor * 1.8));

            ctx.moveTo(px + rad, py);
            ctx.arc(px, py, rad, 0, 6.2831853); // Math.PI * 2
            hasPoints = true;
        }
        if (hasPoints) {
            ctx.fill();
        }
    }

    requestAnimationFrame(renderStarfield);
}

// Inicializar
(function init() {
    if (window.playlist && window.playlist.length > 0) {
        loadSong(0);
        requestAnimationFrame(renderStarfield);
    }
})();
