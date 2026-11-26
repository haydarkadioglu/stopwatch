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

  class BackgroundManager {
    constructor() {
      this.canvasEl = document.getElementById('bg-canvas');
      this.imgEl = document.getElementById('bg-image');
      this.videoEl = document.getElementById('bg-video');
      this.customItems = [];
      this.objectUrls = new Map();
      this.animFrameId = null;
      this.particles = [];
      this.activePreset = null;
    }

    async init() {
      const stored = await global.OdakDB.getAllMediaItems();
      this.customItems = stored.map((item) => {
        const objectUrl = item.blob ? URL.createObjectURL(item.blob) : item.url;
        if (item.blob) this.objectUrls.set(item.id, objectUrl);
        return {
          id: item.id,
          name: item.name,
          kind: item.kind, // 'image' | 'video'
          url: objectUrl,
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
      const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(clean);
      const id = 'url-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const name = clean.split('/').pop().split('?')[0].slice(0, 24) || 'Web Medyası';
      const record = {
        id,
        name,
        kind: isVideo ? 'video' : 'image',
        url: clean,
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

    apply(id) {
      const bg = this.getById(id);
      this.stopCanvas();
      this.canvasEl.classList.add('hidden');
      this.imgEl.classList.add('hidden');
      this.videoEl.classList.add('hidden');
      this.videoEl.pause();

      if (bg.kind === 'canvas') {
        this.canvasEl.classList.remove('hidden');
        this.startCanvas(bg.preset);
      } else if (bg.kind === 'video') {
        this.videoEl.src = bg.url;
        this.videoEl.classList.remove('hidden');
        this.videoEl.play().catch(() => {});
      } else {
        this.imgEl.onerror = () => {
          // Fallback to aurora canvas if offline and external image fails
          this.imgEl.classList.add('hidden');
          this.canvasEl.classList.remove('hidden');
          this.startCanvas('aurora');
        };
        this.imgEl.src = bg.url;
        this.imgEl.classList.remove('hidden');
      }
      return bg;
    }

    stopCanvas() {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }

    startCanvas(preset) {
      this.activePreset = preset;
      const canvas = this.canvasEl;
      const ctx = canvas.getContext('2d');
      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
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
