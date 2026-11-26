(function (global) {
  'use strict';

  const BUILTIN_BACKGROUNDS = [
    {
      id: 'canvas-aurora',
      name: 'Kuzey Işıkları',
      kind: 'canvas',
      preset: 'aurora',
      thumbGradient: 'linear-gradient(135deg, #0f172a 0%, #065f46 50%, #312e81 100%)',
    },
    {
      id: 'canvas-rain',
      name: 'Gece Yağmuru',
      kind: 'canvas',
      preset: 'rain',
      thumbGradient: 'linear-gradient(135deg, #090d16 0%, #1e293b 55%, #0f172a 100%)',
    },
    {
      id: 'canvas-cosmos',
      name: 'Derin Uzay',
      kind: 'canvas',
      preset: 'cosmos',
      thumbGradient: 'linear-gradient(135deg, #050510 0%, #1e1b4b 60%, #4c1d95 100%)',
    },
    {
      id: 'photo-library',
      name: 'Sıcak Kütüphane',
      kind: 'image',
      url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1920&q=80',
    },
    {
      id: 'photo-rainy-window',
      name: 'Yağmurlu Pencere',
      kind: 'image',
      url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1920&q=80',
    },
    {
      id: 'photo-desk',
      name: 'Çalışma Masası',
      kind: 'image',
      url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1920&q=80',
    },
    {
      id: 'photo-cabin',
      name: 'Orman Kulübesi',
      kind: 'image',
      url: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1920&q=80',
    },
    {
      id: 'photo-mountain',
      name: 'Sessiz Zirve',
      kind: 'image',
      url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80',
    },
  ];

  function extractYouTubeId(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0];
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        if (u.searchParams.get('v')) {
          const id = u.searchParams.get('v');
          return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
        }
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
          return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
        }
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  class BackgroundManager {
    constructor() {
      this.canvasEl = document.getElementById('bg-canvas');
      this.imgEl = document.getElementById('bg-image');
      this.videoEl = document.getElementById('bg-video');
      this.youtubeEl = document.getElementById('bg-youtube');
      this.customItems = [];
      this.objectUrls = new Map();
      this.animFrameId = null;
      this.particles = [];
      this.activePreset = null;
      this.audioEnabled = false;
      this.audioVolume = 35;
      this.ytSyncTimers = [];
    }

    async init() {
      const stored = await global.OdakDB.getAllMediaItems();
      this.customItems = stored.map((item) => {
        const objectUrl = item.blob ? URL.createObjectURL(item.blob) : item.url;
        if (item.blob) this.objectUrls.set(item.id, objectUrl);
        return {
          id: item.id,
          name: item.name,
          kind: item.kind, // 'image' | 'video' | 'youtube'
          url: objectUrl,
          youtubeId: item.youtubeId || null,
          isCustom: true,
          size: item.size || 0,
        };
      });
    }

    getAll() {
      return [...BUILTIN_BACKGROUNDS, ...this.customItems];
    }

    getById(id) {
      return this.getAll().find((b) => b.id === id) || BUILTIN_BACKGROUNDS[0];
    }

    async addFiles(fileList) {
      const added = [];
      for (const file of fileList) {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        if (!isVideo && !isImage) continue;

        const id = 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const record = {
          id,
          name: file.name.replace(/\.[^/.]+$/, ''),
          kind: isVideo ? 'video' : 'image',
          blob: file,
          size: file.size,
          createdAt: Date.now(),
        };
        await global.OdakDB.saveMediaItem(record);
        const objectUrl = URL.createObjectURL(file);
        this.objectUrls.set(id, objectUrl);
        const item = {
          id,
          name: record.name,
          kind: record.kind,
          url: objectUrl,
          isCustom: true,
          size: record.size,
        };
        this.customItems.push(item);
        added.push(item);
      }
      return added;
    }

    async addUrl(url) {
      const clean = url.trim();
      if (!clean) return null;
      const ytId = extractYouTubeId(clean);
      const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(clean);
      const id = 'url-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const kind = ytId ? 'youtube' : isVideo ? 'video' : 'image';
      const name = ytId
        ? `YouTube · ${ytId}`
        : clean.split('/').pop().split('?')[0].slice(0, 24) || 'Web Medyası';
      const record = {
        id,
        name,
        kind,
        url: clean,
        youtubeId: ytId,
        size: 0,
        createdAt: Date.now(),
      };
      await global.OdakDB.saveMediaItem(record);
      const item = { ...record, isCustom: true };
      this.customItems.push(item);
      return item;
    }

    async removeCustom(id) {
      await global.OdakDB.deleteMediaItem(id);
      if (this.objectUrls.has(id)) {
        URL.revokeObjectURL(this.objectUrls.get(id));
        this.objectUrls.delete(id);
      }
      this.customItems = this.customItems.filter((item) => item.id !== id);
    }

    resolveQuality(mode = 'auto', blurPx = 4) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (mode === 'low' || mode === 'medium' || mode === 'high') {
        return { tier: mode, reason: '' };
      }
      if (conn) {
        const eff = (conn.effectiveType || '').toLowerCase();
        if (conn.saveData || eff === 'slow-2g' || eff === '2g' || eff === '3g' || (typeof conn.downlink === 'number' && conn.downlink < 2.5)) {
          return { tier: 'low', reason: conn.saveData ? 'SaveData' : eff.toUpperCase() || 'Slow' };
        }
        if ((typeof conn.downlink === 'number' && conn.downlink < 8) || blurPx >= 12) {
          return { tier: 'medium', reason: blurPx >= 12 ? 'Blur Opt.' : eff.toUpperCase() || 'Mid' };
        }
        return { tier: 'high', reason: eff ? eff.toUpperCase() : 'HD' };
      }
      if (blurPx >= 10) {
        return { tier: 'medium', reason: 'Blur Opt.' };
      }
      return { tier: 'high', reason: 'HD' };
    }

    optimizeImageUrl(url, tier) {
      if (!url || !url.includes('images.unsplash.com')) return url;
      const wMap = { low: 800, medium: 1280, high: 1920 };
      const qMap = { low: 65, medium: 75, high: 85 };
      try {
        const u = new URL(url);
        u.searchParams.set('w', String(wMap[tier] || 1280));
        u.searchParams.set('q', String(qMap[tier] || 75));
        return u.toString();
      } catch (_) {
        return url;
      }
    }

    apply(id, qualityMode = 'auto', blurPx = 4) {
      const bg = this.getById(id);
      const { tier } = this.resolveQuality(qualityMode, blurPx);
      this.stopCanvas();
      this.canvasEl.classList.add('hidden');
      this.imgEl.classList.add('hidden');
      this.videoEl.classList.add('hidden');
      this.videoEl.pause();
      if (this.youtubeEl) {
        this.youtubeEl.classList.add('hidden');
        this.youtubeEl.src = '';
      }

      if (bg.kind === 'canvas') {
        this.canvasEl.classList.remove('hidden');
        this.startCanvas(bg.preset, tier);
      } else if (bg.kind === 'youtube' && bg.youtubeId && this.youtubeEl) {
        const vqMap = { low: 'medium', medium: 'hd720', high: 'hd1080' };
        const vq = vqMap[tier] || 'hd720';
        const muteParam = this.audioEnabled ? 0 : 1;
        this.youtubeEl.onload = () => {
          this.syncAudio(this.audioEnabled, this.audioVolume);
          this.ytSyncTimers.forEach(clearTimeout);
          this.ytSyncTimers = [
            setTimeout(() => this.syncAudio(this.audioEnabled, this.audioVolume), 500),
            setTimeout(() => this.syncAudio(this.audioEnabled, this.audioVolume), 1400),
          ];
        };
        this.youtubeEl.src = `https://www.youtube.com/embed/${bg.youtubeId}?autoplay=1&mute=${muteParam}&loop=1&playlist=${bg.youtubeId}&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&vq=${vq}`;
        this.youtubeEl.classList.remove('hidden');
      } else if (bg.kind === 'video') {
        this.videoEl.src = bg.url;
        this.videoEl.muted = !this.audioEnabled;
        this.videoEl.volume = Math.max(0, Math.min(1, this.audioVolume / 100));
        this.videoEl.classList.remove('hidden');
        this.videoEl.play().catch(() => {
          // Autoplay with sound may be blocked before first gesture; retry muted and restore on first interaction
          this.videoEl.muted = true;
          this.videoEl.play().catch(() => {});
          if (this.audioEnabled) {
            const restore = () => {
              this.syncAudio(this.audioEnabled, this.audioVolume);
              this.videoEl.play().catch(() => {});
            };
            document.addEventListener('pointerdown', restore, { once: true });
            document.addEventListener('keydown', restore, { once: true });
          }
        });
      } else {
        this.imgEl.onerror = () => {
          // Fallback to aurora canvas if offline and external image fails
          this.imgEl.classList.add('hidden');
          this.canvasEl.classList.remove('hidden');
          this.startCanvas('aurora', tier);
        };
        this.imgEl.src = this.optimizeImageUrl(bg.url, tier);
        this.imgEl.classList.remove('hidden');
      }
      return bg;
    }

    syncAudio(enabled, volumePct) {
      this.audioEnabled = Boolean(enabled);
      this.audioVolume = Math.max(0, Math.min(100, Number(volumePct) || 0));
      const vol = this.audioVolume / 100;
      if (this.videoEl) {
        this.videoEl.muted = !this.audioEnabled;
        this.videoEl.volume = vol;
      }
      if (this.youtubeEl && !this.youtubeEl.classList.contains('hidden') && this.youtubeEl.contentWindow) {
        const post = (func, args = []) => {
          this.youtubeEl.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func, args }),
            '*'
          );
        };
        post(this.audioEnabled ? 'unMute' : 'mute');
        post('setVolume', [Math.round(this.audioVolume)]);
      }
    }

    stopCanvas() {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }

    startCanvas(preset, tier = 'medium') {
      this.activePreset = preset;
      const canvas = this.canvasEl;
      const ctx = canvas.getContext('2d');
      const scaleMap = { low: 0.65, medium: 0.9, high: 1.0 };
      const scale = scaleMap[tier] || 0.9;
      const resize = () => {
        canvas.width = Math.max(320, Math.floor(window.innerWidth * scale));
        canvas.height = Math.max(180, Math.floor(window.innerHeight * scale));
      };
      resize();
      window.onresize = resize;

      this.particles = [];
      if (preset === 'rain') {
        for (let i = 0; i < 130; i++) {
          this.particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            len: 12 + Math.random() * 22,
            speed: 7 + Math.random() * 8,
            alpha: 0.12 + Math.random() * 0.28,
          });
        }
      } else if (preset === 'cosmos') {
        for (let i = 0; i < 160; i++) {
          this.particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: 0.6 + Math.random() * 1.8,
            vx: (Math.random() - 0.5) * 0.18,
            vy: -0.08 - Math.random() * 0.22,
            alpha: 0.25 + Math.random() * 0.75,
          });
        }
      }

      let t = 0;
      const render = () => {
        t += 0.008;
        const w = canvas.width;
        const h = canvas.height;

        if (preset === 'aurora') {
          ctx.fillStyle = '#070b14';
          ctx.fillRect(0, 0, w, h);

          const orbs = [
            { x: w * (0.3 + 0.18 * Math.sin(t * 0.7)), y: h * (0.35 + 0.12 * Math.cos(t * 0.5)), r: w * 0.45, c: 'rgba(16, 185, 129, 0.34)' },
            { x: w * (0.7 + 0.15 * Math.cos(t * 0.6)), y: h * (0.55 + 0.15 * Math.sin(t * 0.8)), r: w * 0.42, c: 'rgba(99, 102, 241, 0.32)' },
            { x: w * (0.5 + 0.2 * Math.sin(t * 0.4)), y: h * (0.7 + 0.1 * Math.cos(t * 0.9)), r: w * 0.38, c: 'rgba(245, 158, 11, 0.18)' },
          ];
          orbs.forEach((o) => {
            const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
            grad.addColorStop(0, o.c);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
          });
        } else if (preset === 'rain') {
          const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
          bgGrad.addColorStop(0, '#090d16');
          bgGrad.addColorStop(1, '#111827');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, w, h);

          // Warm distant bokeh
          const bokeh = ctx.createRadialGradient(w * 0.25, h * 0.35, 10, w * 0.25, h * 0.35, w * 0.35);
          bokeh.addColorStop(0, 'rgba(245, 158, 11, 0.14)');
          bokeh.addColorStop(1, 'transparent');
          ctx.fillStyle = bokeh;
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          this.particles.forEach((p) => {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 2, p.y + p.len);
            p.y += p.speed;
            p.x -= 0.7;
            if (p.y > h) {
              p.y = -p.len;
              p.x = Math.random() * (w + 80);
            }
          });
          ctx.stroke();
        } else if (preset === 'cosmos') {
          const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.5, w * 0.8);
          bgGrad.addColorStop(0, '#1e1b4b');
          bgGrad.addColorStop(0.55, '#090a1a');
          bgGrad.addColorStop(1, '#04050a');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, w, h);

          this.particles.forEach((p) => {
            ctx.fillStyle = `rgba(248, 250, 252, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < -4) p.y = h + 4;
            if (p.x < -4) p.x = w + 4;
            if (p.x > w + 4) p.x = -4;
          });
        }

        this.animFrameId = requestAnimationFrame(render);
      };

      this.animFrameId = requestAnimationFrame(render);
    }
  }

  global.OdakBackgrounds = new BackgroundManager();
})(window);
