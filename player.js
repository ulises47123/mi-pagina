// ==========================================================
// Startpage minimalista: reloj, reproductor y lista de canciones
// ==========================================================

const audio = document.getElementById('audioElement');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const trackTitle = document.getElementById('trackTitle');
const trackList = document.getElementById('trackList');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');
const searchInput = document.getElementById('searchInput');

const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';

let playlist = window.playlist || [];
let songIndex = 0;

// ---------- Reloj ----------
const clockTime = document.getElementById('clockTime');
const clockDate = document.getElementById('clockDate');

function updateClock() {
    const now = new Date();
    clockTime.textContent = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    clockDate.textContent = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}
updateClock();
setInterval(updateClock, 1000);

// ---------- Títulos limpios ----------
// Los nombres vienen de YouTube: se quitan "(Letra)", "[Lyrics]", "｜ Sub. Español", emojis, etc.
const JUNK = /\b(sub|subtitulado|lyrics?|letra|español|espanol|amv|cover|official|video)\b/i;

function cleanTitle(raw) {
    const parts = raw
        .split(/\s*(?:[｜|]+|⧸+)\s*/)
        .map(p => p
            .replace(/\(.*?\)|\[.*?\]|（.*?）/g, '')
            .replace(/[＂"]/g, '')
            .replace(/~.*$/, '')
            .replace(/•/g, ' ')
            .replace(/[\p{Extended_Pictographic}️]/gu, '')
            .replace(/\s+/g, ' ')
            .replace(/[\s.•-]+$/, '')
            .trim())
        .filter(Boolean);

    if (parts.length === 0) return raw.trim();
    const [first, ...rest] = parts;
    const extra = rest.filter(p => !JUNK.test(p));
    return [first, ...extra].join(' · ');
}

// ---------- Orden aleatorio ----------
// Cada vez que se abre la página el orden cambia, así no empieza siempre la misma canción.
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

playlist = shuffle(playlist.slice());

// "Mezclar": la canción actual queda primera y el resto se reordena
function reshuffle() {
    const current = playlist[songIndex];
    const rest = shuffle(playlist.filter((_, i) => i !== songIndex));
    playlist = [current, ...rest];
    songIndex = 0;
    renderList();
    markActive();
    trackList.scrollTop = 0;
}

// ---------- Lista ----------
let trackButtons = [];

function renderList() {
    trackList.replaceChildren();
    trackButtons = playlist.map((song, i) => buildTrack(song, i));
}

function buildTrack(song, i) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'track';
    btn.type = 'button';
    btn.title = song.title;

    const num = document.createElement('span');
    num.className = 'track-num';
    num.textContent = String(i + 1).padStart(2, '0');

    const name = document.createElement('span');
    name.className = 'track-name';
    name.textContent = cleanTitle(song.title);

    btn.append(num, name);
    btn.addEventListener('click', () => {
        if (i === songIndex && !audio.paused) {
            audio.pause();
        } else {
            loadSong(i);
            play();
        }
    });

    li.appendChild(btn);
    trackList.appendChild(li);
    return btn;
}

function markActive() {
    trackButtons.forEach((b, i) => {
        const active = i === songIndex;
        b.classList.toggle('active', active);
        if (active) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
    });
}

renderList();
document.getElementById('musicCount').textContent = `Música · ${playlist.length}`;
document.getElementById('shuffleBtn').addEventListener('click', reshuffle);

// ---------- Reproductor ----------
function formatTime(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

function loadSong(index) {
    if (playlist.length === 0) return;
    songIndex = (index + playlist.length) % playlist.length;
    const song = playlist[songIndex];
    audio.src = song.file;
    trackTitle.textContent = cleanTitle(song.title);
    trackTitle.title = song.title;
    progressFill.style.width = '0%';
    curTimeEl.textContent = '0:00';
    durTimeEl.textContent = '0:00';

    markActive();
    const btn = trackButtons[songIndex];
    trackList.scrollTop = Math.max(0, btn.offsetTop - trackList.offsetTop - trackList.clientHeight / 2);
}

function play() {
    audio.play().catch(e => console.error('Error al reproducir audio:', e));
}

function togglePlay() {
    if (audio.paused) play();
    else audio.pause();
}

function changeTrack(step) {
    const wasPlaying = !audio.paused;
    loadSong(songIndex + step);
    if (wasPlaying) play();
}

audio.addEventListener('play', () => {
    playIcon.innerHTML = ICON_PAUSE;
    playBtn.setAttribute('aria-label', 'Pausa');
});

audio.addEventListener('pause', () => {
    playIcon.innerHTML = ICON_PLAY;
    playBtn.setAttribute('aria-label', 'Reproducir');
});

audio.addEventListener('ended', () => {
    loadSong(songIndex + 1);
    play();
});

audio.addEventListener('loadedmetadata', () => {
    durTimeEl.textContent = formatTime(audio.duration);
});

let dragging = false;

function showProgress(time) {
    const pct = audio.duration ? (time / audio.duration) * 100 : 0;
    progressFill.style.width = pct + '%';
    curTimeEl.textContent = formatTime(time);
    progressBar.setAttribute('aria-valuenow', Math.round(pct));
}

audio.addEventListener('timeupdate', () => {
    if (!dragging) showProgress(audio.currentTime);
});

// Barra de tiempo: clic para saltar o arrastrar (el salto se aplica al soltar)
function timeAt(clientX) {
    const rect = progressBar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * audio.duration;
}

progressBar.addEventListener('pointerdown', (e) => {
    if (!audio.duration) return;
    dragging = true;
    progressBar.setPointerCapture(e.pointerId);
    showProgress(timeAt(e.clientX));
});

progressBar.addEventListener('pointermove', (e) => {
    if (dragging) showProgress(timeAt(e.clientX));
});

function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    audio.currentTime = timeAt(e.clientX);
}

progressBar.addEventListener('pointerup', endDrag);
progressBar.addEventListener('pointercancel', () => { dragging = false; });

progressBar.addEventListener('keydown', (e) => {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        audio.currentTime += e.key === 'ArrowRight' ? 5 : -5;
    }
});

playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', () => changeTrack(-1));
nextBtn.addEventListener('click', () => changeTrack(1));

// ---------- Atajos de teclado ----------
window.addEventListener('keydown', (e) => {
    if (document.activeElement === searchInput) {
        if (e.key === 'Escape') searchInput.blur();
        return;
    }
    // No robar Espacio/Enter a botones o links enfocados
    const onControl = e.target.closest && e.target.closest('button, a, [role="slider"]');

    if (e.key === '/') {
        e.preventDefault();
        searchInput.focus();
    } else if (e.code === 'Space' && !onControl) {
        e.preventDefault();
        togglePlay();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        changeTrack(1);
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        changeTrack(-1);
    }
});

// ---------- Inicio ----------
if (playlist.length > 0) loadSong(0);
