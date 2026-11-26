# Odak — Study Stopwatch, Timer & World Clock

A distraction-free, customizable online study stopwatch, countdown timer, and world clock with local caching, ambient & YouTube music playback, weather, and custom photo/video backgrounds. Zero build step—ready to deploy directly on Vercel, GitHub Pages, or any static host.

## Features

- **3 Modes — Stopwatch, Countdown & World Clock**: Timestamp-accurate stopwatch with lap tracking, customizable countdown with completion alerts & desktop notifications, and a clean World Clock mode with auto-detected local time, 400+ searchable IANA timezones, optional dual timezone display, and customizable date/24h/seconds formats.
- **Custom Backgrounds & Local Cache**: Built-in animated canvas scenes, curated study photos, YouTube video backgrounds, and support for uploading multiple custom images or MP4/WebM videos stored locally in **IndexedDB**, plus auto/manual quality optimization.
- **Visual Studio & Keep Screen Awake**: Adjustable background blur (`0–30px`), dimming overlay, Digital & Classic Analog clock styles, font styles, clock scale, accent colors, Zen mode, and optional Screen Wake Lock (`Keep Screen Awake`).
- **Offline Web Audio & YouTube Music Player**: Master mute/unmute, countdown alarm chimes, synthesized focus ambience (rain, brown noise, lo-fi drone), plus an independent YouTube/YouTube Music playlist & loop player with hover queue controls.
- **Optional Weather**: Current temperature & conditions via Open-Meteo (city search or geolocation, `°C`/`°F`).
- **14 Languages (Auto-Detected)**: Turkish (`tr`), English (`en`), German (`de`), French (`fr`), Spanish (`es`), Portuguese (`pt`), Italian (`it`), Dutch (`nl`), Russian (`ru`), Arabic (`ar` with RTL), Hindi (`hi`), Japanese (`ja`), Korean (`ko`), and Chinese (`zh`).

## Keyboard Shortcuts

- `Space` — Start / Pause
- `L` — Record Lap
- `R` — Reset
- `F` — Toggle Fullscreen
- `M` — Mute / Unmute Audio
- `B` — Next Background
- `S` — Open Studio & Settings
- `P` / `[` / `]` — Music Play/Pause, Previous, Next

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Keep the framework preset as **Other** (no build command or output directory needed) and click **Deploy**.
