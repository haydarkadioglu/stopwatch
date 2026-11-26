# Odak — Study Stopwatch & Timer

A distraction-free, customizable online study stopwatch and countdown timer with local caching, ambient audio, and custom photo/video backgrounds. Zero build step—ready to deploy directly on Vercel, GitHub Pages, or any static host.

## Features

- **Stopwatch & Countdown**: Centisecond precision, timestamp-accurate persistence across refreshes, lap tracking (fastest/slowest highlights + clipboard copy), and quick study presets (`15m`, `25m`, `45m`, `50m`, `90m`) or custom `HH:MM:SS` input.
- **Custom Backgrounds & Local Cache**: Built-in animated canvas scenes, curated study photos, and support for uploading multiple custom images or MP4/WebM videos stored locally in **IndexedDB**.
- **Slideshow & Visual Studio**: Adjustable background blur (`0–30px`), dimming overlay, multi-background slideshow, font styles, clock scale, accent colors, card styles, and Zen mode.
- **Offline Web Audio**: Master mute/unmute, countdown alarm chimes, tactile click sounds, and real-time synthesized ambient focus sounds (rain, brown noise, lo-fi drone).
- **9 Languages**: Turkish (`tr`), English (`en`), German (`de`), Spanish (`es`), Russian (`ru`), Arabic (`ar` with RTL), Japanese (`ja`), Korean (`ko`), and Chinese (`zh`).

## Keyboard Shortcuts

- `Space` — Start / Pause
- `L` — Record Lap
- `R` — Reset
- `F` — Toggle Fullscreen
- `M` — Mute / Unmute Audio
- `B` — Next Background
- `S` — Open Studio & Settings

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Keep the framework preset as **Other** (no build command or output directory needed) and click **Deploy**.
