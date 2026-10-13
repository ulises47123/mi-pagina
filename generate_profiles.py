import os
import json
import subprocess
import numpy as np

MUSIC_DIR = "music"
PLAYLIST_FILE = os.path.join(MUSIC_DIR, "playlist.json")
PLAYLIST_DATA_JS = os.path.join(MUSIC_DIR, "playlist_data.js")

PALETTES = [
    {
        "name": "Supernova Neon (Alta Energía)",
        "stars": ["#ff007f", "#00f0ff", "#ffe600", "#ffffff"],
        "glow": "rgba(255, 0, 128, 0.7)"
    },
    {
        "name": "Cosmic Cyberpunk (Energía Media-Alta)",
        "stars": ["#a855f7", "#ec4899", "#38bdf8", "#f43f5e"],
        "glow": "rgba(168, 85, 247, 0.6)"
    },
    {
        "name": "Deep Nebula (Medio)",
        "stars": ["#06b6d4", "#3b82f6", "#818cf8", "#c084fc"],
        "glow": "rgba(6, 182, 212, 0.55)"
    },
    {
        "name": "Aurora Borealis (Melódico / Ondulante)",
        "stars": ["#10b981", "#06b6d4", "#a7f3d0", "#6ee7b7"],
        "glow": "rgba(16, 185, 129, 0.5)"
    },
    {
        "name": "Amber Twilight (Cálido / Rítmico)",
        "stars": ["#f59e0b", "#f97316", "#fbbf24", "#f43f5e"],
        "glow": "rgba(245, 158, 11, 0.55)"
    },
    {
        "name": "Ethereal Moonlight (Chill / Suave)",
        "stars": ["#93c5fd", "#e0e7ff", "#c7d2fe", "#ffffff"],
        "glow": "rgba(147, 197, 253, 0.45)"
    },
    {
        "name": "Starlight White (Clásico Cósmico)",
        "stars": ["#ffffff", "#e2e8f0", "#94a3b8", "#f8fafc"],
        "glow": "rgba(255, 255, 255, 0.6)"
    }
]

def analyze_audio_track(file_path):
    """
    Decodifica el audio mediante ffmpeg y realiza:
    1. Análisis de envelope espectral y cálculo de Beats exactos en segundos.
    2. Tempo (BPM), intensidad RMS, dirección de flujo y paleta.
    """
    cmd = [
        "ffmpeg", "-i", file_path,
        "-f", "f32le", "-ac", "1", "-ar", "22050",
        "-"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    raw, _ = proc.communicate()
    if not raw:
        return None

    samples = np.frombuffer(raw, dtype=np.float32)
    sample_rate = 22050
    duration = len(samples) / sample_rate
    if duration < 5:
        return None

    # RMS
    rms = float(np.sqrt(np.mean(samples ** 2)))
    intensity = float(np.clip(rms * 4.5, 0.4, 2.5))

    # Envelope de energía acústica
    hop = 512
    frames = [
        np.sum(samples[i:i + hop] ** 2)
        for i in range(0, len(samples) - hop, hop)
    ]
    env = np.array(frames)
    novelty = np.diff(env)
    novelty = np.maximum(novelty, 0)
    novelty_sr = sample_rate / hop # ~43.06 Hz

    # Autocorrelación para BPM
    min_lag = int((60.0 / 185.0) * novelty_sr)
    max_lag = int((60.0 / 65.0) * novelty_sr)
    
    center_start = int(len(novelty) * 0.1)
    center_end = int(len(novelty) * 0.9)
    chunk = novelty[center_start:center_end]
    chunk = chunk - np.mean(chunk)
    corr = np.correlate(chunk, chunk, mode='full')
    corr = corr[len(chunk)-1:]

    valid_corr = corr[min_lag:max_lag]
    if len(valid_corr) > 0 and np.max(valid_corr) > 0:
        peak_lag = min_lag + np.argmax(valid_corr)
        bpm = round((60.0 * novelty_sr) / peak_lag)
    else:
        bpm = 115
    bpm = int(np.clip(bpm, 68, 180))

    # ==========================================================
    # DETECCIÓN DE BEATS (TIMESTAMPS EXACTOS)
    # Extraemos los picos de ritmo (kicks/onsets) a lo largo de toda la pista
    # ==========================================================
    beat_timestamps = []
    # Ventana móvil de energía para calcular umbral adaptativo
    win_size = int(novelty_sr * 0.8) # ~0.8s
    half_win = win_size // 2
    min_beat_interval = int(novelty_sr * (60.0 / 200.0)) # Máx 200 BPM (~0.3s entre beats)

    last_beat_idx = -min_beat_interval
    for idx in range(half_win, len(novelty) - half_win):
        local_window = novelty[idx - half_win : idx + half_win]
        local_avg = np.mean(local_window)
        val = novelty[idx]

        # Pico local y supera el promedio en un 40%
        if (val > local_avg * 1.45 and 
            val == np.max(novelty[idx - 2 : idx + 3]) and 
            (idx - last_beat_idx) >= min_beat_interval):
            
            timestamp = round(float(idx / novelty_sr), 3)
            beat_timestamps.append(timestamp)
            last_beat_idx = idx

    # Dirección y estilo
    if bpm > 128:
        direction = "up"
        speed_factor = round(1.2 + (bpm - 128) / 70.0, 2)
    elif bpm < 88:
        direction = "down"
        speed_factor = round(0.55 + (bpm - 65) / 50.0, 2)
    else:
        direction = "both" if (bpm % 2 == 0) else "up"
        speed_factor = round(0.85 + (bpm - 88) / 80.0, 2)

    if bpm >= 135 or intensity > 1.8:
        palette_idx = 0
    elif bpm >= 120:
        palette_idx = 1
    elif bpm >= 105:
        palette_idx = 2
    elif bpm >= 92:
        palette_idx = 3
    elif bpm >= 80:
        palette_idx = 4
    else:
        palette_idx = 5
    palette = PALETTES[palette_idx]

    star_count = int(np.clip(40 + (bpm - 70) * 0.45, 35, 90))
    size_mult = round(float(np.clip(0.85 + intensity * 0.35, 0.9, 2.2)), 2)

    return {
        "bpm": bpm,
        "intensity": round(intensity, 2),
        "direction": direction,
        "speed": speed_factor,
        "starCount": star_count,
        "sizeMultiplier": size_mult,
        "paletteName": palette["name"],
        "colors": palette["stars"],
        "glowColor": palette["glow"],
        "beats": beat_timestamps
    }

def main():
    with open(PLAYLIST_FILE, "r", encoding="utf-8") as f:
        playlist = json.load(f)

    # Filtrar cualquier rastro de la canción "Son las cinco de la mañana"
    filtered = []
    for item in playlist:
        if "cinco de la ma" in item["title"].lower() or "cinco de la ma" in item["file"].lower():
            if os.path.exists(item["file"]):
                try:
                    os.remove(item["file"])
                    print(f"Eliminado archivo: {item['file']}")
                except Exception as e:
                    print(f"Error borrando archivo: {e}")
            continue
        filtered.append(item)

    print(f"Procesando {len(filtered)} canciones...")
    profiles = {}
    for item in filtered:
        fpath = item["file"]
        title = item["title"]
        print(f"Analizando ritmo y beats para: {title}...")
        res = analyze_audio_track(fpath)
        if res:
            item["profile"] = res
            profiles[fpath] = res
            print(f"  -> BPM: {res['bpm']}, Beats detectados: {len(res['beats'])}, Dir: {res['direction']}, Color: {res['paletteName']}")
        else:
            item["profile"] = {
                "bpm": 110, "intensity": 1.0, "direction": "up", "speed": 1.0,
                "starCount": 50, "sizeMultiplier": 1.0,
                "paletteName": PALETTES[6]["name"],
                "colors": PALETTES[6]["stars"],
                "glowColor": PALETTES[6]["glow"],
                "beats": []
            }
            profiles[fpath] = item["profile"]

    # Guardar playlist.json limpio
    with open(PLAYLIST_FILE, "w", encoding="utf-8") as f:
        json.dump([{ "id": x["id"], "title": x["title"], "file": x["file"] } for x in filtered], f, indent=2, ensure_ascii=False)

    # Guardar profiles.json
    with open(os.path.join(MUSIC_DIR, "profiles.json"), "w", encoding="utf-8") as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)

    # Guardar playlist_data.js directamente cargable por index.html
    js_content = "window.playlist = " + json.dumps(filtered, indent=2, ensure_ascii=False) + ";\n"
    with open(PLAYLIST_DATA_JS, "w", encoding="utf-8") as f:
        f.write(js_content)

    print("\n¡Perfiles y Beats generados exitosamente en playlist_data.js!")

if __name__ == "__main__":
    main()
