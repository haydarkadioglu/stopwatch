(function (global) {
  'use strict';

  function parseYouTubeMusicUrl(rawUrl) {
    try {
      const u = new URL(rawUrl.trim());
      const host = u.hostname.replace(/^www\./, '');
      const isYT =
        host === 'youtu.be' ||
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com';
      if (!isYT) return null;

      const listId = u.searchParams.get('list');
      const indexParam = Number(u.searchParams.get('index'));
      let videoId = u.searchParams.get('v');
      if (!videoId && host === 'youtu.be') {
        videoId = u.pathname.split('/').filter(Boolean)[0] || null;
      }
      if (!videoId) {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
          videoId = parts[1];
        }
      }

      if (listId) {
        return {
          kind: 'playlist',
          listId,
          videoId: videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null,
          index: Number.isFinite(indexParam) && indexParam > 0 ? indexParam - 1 : 0,
          url: rawUrl.trim(),
        };
      }
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return {
          kind: 'video',
          videoId,
          listId: null,
          index: 0,
          url: rawUrl.trim(),
        };
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  class MusicPlayer {
    constructor() {
      this.player = null;
      this.ready = false;
      this.apiReady = false;
      this.apiLoading = false;
      this.pendingSource = null;
      this.activeItem = null;
      this.isPlaying = false;
      this.volume = 65;
      this.muted = false;
      this.loop = true;
      this.shuffle = false;
      this.currentTitle = '';
      this.currentAuthor = '';
      this.currentVideoId = '';
      this.playlistIds = [];
      this.playlistIndex = -1;
      this.metaCache = new Map();
      this.unavailableIds = new Set();
      this.consecutiveErrors = 0;
      this.onStateChange = null;
      this.onVideoMeta = null;
      this.onPlaybackError = null;
    }

    ensureApi() {
      if (this.apiReady && window.YT && window.YT.Player) return Promise.resolve();
      if (this._apiPromise) return this._apiPromise;

      this._apiPromise = new Promise((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof prev === 'function') prev();
          this.apiReady = true;
          resolve();
        };

        if (!this.apiLoading) {
          this.apiLoading = true;
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          tag.async = true;
          document.head.appendChild(tag);
        }
      });
      return this._apiPromise;
    }

    async fetchVideoMeta(videoId) {
      if (!videoId) return null;
      if (this.metaCache.has(videoId)) return this.metaCache.get(videoId);
      const placeholder = {
        videoId,
        title: `YouTube (${videoId})`,
        author: '',
        thumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
      this.metaCache.set(videoId, placeholder);
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (res.ok) {
          const data = await res.json();
          const meta = {
            videoId,
            title: data.title || placeholder.title,
            author: data.author_name || '',
            thumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          };
          this.metaCache.set(videoId, meta);
          this.onVideoMeta?.(meta);
          return meta;
        }
      } catch (_) {}
      return placeholder;
    }

    async fetchPlaylistMeta(listId) {
      if (!listId) return null;
      const cacheKey = `pl:${listId}`;
      if (this.metaCache.has(cacheKey)) return this.metaCache.get(cacheKey);
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(
            `https://www.youtube.com/playlist?list=${listId}`
          )}&format=json`
        );
        if (res.ok) {
          const data = await res.json();
          const meta = {
            listId,
            title: data.title || '',
            author: data.author_name || '',
            thumb: data.thumbnail_url || '',
          };
          this.metaCache.set(cacheKey, meta);
          return meta;
        }
      } catch (_) {}
      return null;
    }

    async load(item, autoPlay = false) {
      if (!item) return;
      this.activeItem = item;
      this.pendingSource = { item, autoPlay };
      this.consecutiveErrors = 0;
      this.isPlaying = false;
      this.currentTitle = '';
      this.currentAuthor = '';
      this.currentVideoId = '';
      this.playlistIds = [];
      this.playlistIndex = -1;
      const firstVid = item.kind === 'local_playlist' ? item.tracks?.[item.index || 0] : item.videoId;
      if (firstVid) {
        this.currentVideoId = firstVid;
        this.fetchVideoMeta(firstVid);
      }
      this.onStateChange?.();

      await this.ensureApi();
      const container = document.getElementById('yt-music-host');
      if (!container) return;

      if (!this.player) {
        const playerVars = {
          autoplay: autoPlay ? 1 : 0,
          controls: 0,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          loop: this.loop ? 1 : 0,
        };
        if (window.location.protocol.startsWith('http')) {
          playerVars.origin = window.location.origin;
        }
        if (item.kind === 'playlist') {
          playerVars.listType = 'playlist';
          playerVars.list = item.listId;
          if (item.index > 0) playerVars.index = item.index;
        } else if (item.kind === 'local_playlist') {
          const rest = (item.tracks || []).slice(1);
          if (rest.length > 0) playerVars.playlist = rest.join(',');
        } else {
          playerVars.playlist = item.videoId;
        }

        this.player = new window.YT.Player('yt-music-host', {
          height: '180',
          width: '320',
          videoId: firstVid || undefined,
          playerVars,
          events: {
            onReady: () => {
              this.ready = true;
              this.applyAudio();
              this.player.setLoop?.(this.loop);
              this.player.setShuffle?.(this.shuffle);
              const pending = this.pendingSource;
              if (pending && pending.item !== item) {
                this.load(pending.item, pending.autoPlay);
                return;
              }
              if (this.pendingSource?.autoPlay) {
                this.player.playVideo?.();
              }
              this.syncMeta();
            },
            onStateChange: (e) => {
              const YTState = window.YT.PlayerState;
              this.isPlaying = e.data === YTState.PLAYING;
              if (e.data === YTState.PLAYING) {
                this.consecutiveErrors = 0;
              }
              if (e.data === YTState.ENDED && this.loop && this.activeItem?.kind === 'video') {
                this.player.seekTo(0);
                this.player.playVideo();
              }
              this.syncMeta();
              this.onStateChange?.();
            },
            onError: (e) => {
              this.consecutiveErrors += 1;
              if (this.consecutiveErrors === 1) {
                this.onPlaybackError?.(e.data);
              }
              const idx = this.player?.getPlaylistIndex?.();
              const failedId =
                (typeof idx === 'number' && idx >= 0 && this.playlistIds[idx]) ||
                this.currentVideoId;
              if (failedId) this.unavailableIds.add(failedId);
              const isList =
                this.activeItem?.kind === 'playlist' ||
                this.activeItem?.kind === 'local_playlist';
              if (isList && this.consecutiveErrors <= 12) {
                setTimeout(() => {
                  this.player?.nextVideo?.();
                }, 250);
              }
              this.onStateChange?.();
            },
          },
        });
      } else if (this.ready) {
        if (item.kind === 'playlist') {
          const cfg = {
            list: item.listId,
            listType: 'playlist',
            index: item.index || 0,
          };
          if (autoPlay) {
            this.player.loadPlaylist(cfg);
          } else {
            this.player.cuePlaylist(cfg);
          }
        } else if (item.kind === 'local_playlist') {
          const tracks = item.tracks || [];
          if (tracks.length > 0) {
            if (autoPlay) {
              this.player.loadPlaylist(tracks, item.index || 0);
            } else {
              this.player.cuePlaylist(tracks, item.index || 0);
            }
          }
        } else {
          if (autoPlay) {
            this.player.loadVideoById(item.videoId);
          } else {
            this.player.cueVideoById(item.videoId);
          }
        }
        this.player.setLoop?.(this.loop);
        this.player.setShuffle?.(this.shuffle);
        this.applyAudio();
        setTimeout(() => this.syncMeta(), 450);
      }
    }

    syncMeta() {
      try {
        const data = this.player?.getVideoData?.();
        if (data) {
          if (data.video_id) this.currentVideoId = data.video_id;
          if (data.title) this.currentTitle = data.title;
          if (data.author) this.currentAuthor = data.author;
        }
        if (this.currentVideoId) {
          this.fetchVideoMeta(this.currentVideoId);
        }

        const list = this.player?.getPlaylist?.();
        if (Array.isArray(list) && list.length > 0) {
          this.playlistIds = list;
          this.playlistIndex = this.player?.getPlaylistIndex?.() ?? 0;
          // Prefetch neighbors and initial visible tracks for list details
          const toPrefetch = new Set([
            this.playlistIndex - 1,
            this.playlistIndex + 1,
            this.playlistIndex + 2,
            this.playlistIndex + 3,
          ]);
          for (let i = 0; i < Math.min(12, list.length); i++) {
            toPrefetch.add(i);
          }
          toPrefetch.forEach((idx) => {
            if (idx >= 0 && idx < list.length) {
              this.fetchVideoMeta(list[idx]);
            }
          });
        } else {
          this.playlistIds = [];
          this.playlistIndex = -1;
        }
        this.onStateChange?.();
      } catch (_) {}
    }

    getPlaylistTracks(limit = 500) {
      if (!this.playlistIds.length) return [];
      return this.playlistIds.slice(0, limit).map((vid, index) => {
        const cached = this.metaCache.get(vid);
        return {
          index,
          videoId: vid,
          title: cached?.title || `#${index + 1} · ${vid}`,
          thumb: cached?.thumb || `https://img.youtube.com/vi/${vid}/default.jpg`,
          current: index === this.playlistIndex,
          unavailable: this.unavailableIds.has(vid),
          hasMeta: Boolean(cached && cached.title && !cached.title.startsWith('YouTube (')),
        };
      });
    }

    getQueuePreview() {
      if (!this.playlistIds.length || this.playlistIndex < 0) {
        return { prev: [], next: [] };
      }
      const prev = [];
      const next = [];
      if (this.playlistIndex - 1 >= 0) {
        const vid = this.playlistIds[this.playlistIndex - 1];
        prev.push({ index: this.playlistIndex - 1, ...(this.metaCache.get(vid) || { videoId: vid, title: vid, thumb: `https://img.youtube.com/vi/${vid}/default.jpg` }) });
      }
      for (let i = 1; i <= 3; i++) {
        const idx = this.playlistIndex + i;
        if (idx < this.playlistIds.length) {
          const vid = this.playlistIds[idx];
          next.push({ index: idx, ...(this.metaCache.get(vid) || { videoId: vid, title: vid, thumb: `https://img.youtube.com/vi/${vid}/default.jpg` }) });
        }
      }
      return { prev, next };
    }

    playAt(index) {
      if (!this.player || !this.ready) return;
      this.consecutiveErrors = 0;
      this.player.playVideoAt?.(index);
    }

    togglePlay() {
      if (!this.player || !this.ready) {
        if (this.activeItem) this.load(this.activeItem, true);
        return;
      }
      if (this.isPlaying) {
        this.player.pauseVideo?.();
      } else {
        this.player.playVideo?.();
      }
    }

    next() {
      this.consecutiveErrors = 0;
      this.player?.nextVideo?.();
    }

    prev() {
      this.consecutiveErrors = 0;
      this.player?.previousVideo?.();
    }

    setLoop(loop) {
      this.loop = Boolean(loop);
      this.player?.setLoop?.(this.loop);
    }

    setShuffle(shuffle) {
      this.shuffle = Boolean(shuffle);
      if (this.player && this.ready) {
        this.player.setShuffle?.(this.shuffle);
        setTimeout(() => this.syncMeta(), 350);
      }
    }

    configureAudio({ muted, volume }) {
      if (typeof muted === 'boolean') this.muted = muted;
      if (typeof volume === 'number') this.volume = Math.max(0, Math.min(100, volume));
      this.applyAudio();
    }

    applyAudio() {
      if (!this.player || !this.ready) return;
      if (this.muted) {
        this.player.mute?.();
      } else {
        this.player.unMute?.();
        this.player.setVolume?.(this.volume);
      }
    }
  }

  global.OdakMusic = {
    player: new MusicPlayer(),
    parseYouTubeMusicUrl,
  };
})(window);
