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
      this.apiReady = false;
      this.apiLoading = false;
      this.pendingSource = null;
      this.activeItem = null;
      this.isPlaying = false;
      this.volume = 65;
      this.muted = false;
      this.loop = true;
      this.currentTitle = '';
      this.currentAuthor = '';
      this.currentVideoId = '';
      this.playlistIndex = -1;
      this.playlistLength = 0;
      this.consecutiveErrors = 0;
      this.onStateChange = null;
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

    async load(item, autoPlay = false) {
      if (!item) return;
      this.activeItem = item;
      this.pendingSource = { item, autoPlay };
      this.consecutiveErrors = 0;
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
          origin: window.location.origin,
          loop: this.loop ? 1 : 0,
        };
        if (item.kind === 'playlist') {
          playerVars.listType = 'playlist';
          playerVars.list = item.listId;
          if (item.index > 0) playerVars.index = item.index;
        } else {
          playerVars.playlist = item.videoId;
        }

        // YouTube throttles/blocks 1x1 players; keep a 240x135 visually hidden player
        this.player = new window.YT.Player('yt-music-host', {
          height: '135',
          width: '240',
          videoId: item.videoId || undefined,
          playerVars,
          events: {
            onReady: () => {
              this.applyAudio();
              this.player.setLoop?.(this.loop);
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
            onError: () => {
              // Auto-skip unavailable, private, or embed-blocked videos in playlists
              this.consecutiveErrors += 1;
              if (this.activeItem?.kind === 'playlist' && this.consecutiveErrors <= 10) {
                setTimeout(() => {
                  this.player?.nextVideo?.();
                }, 250);
              }
            },
          },
        });
      } else {
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
        } else {
          if (autoPlay) {
            this.player.loadVideoById(item.videoId);
          } else {
            this.player.cueVideoById(item.videoId);
          }
        }
        this.player.setLoop?.(this.loop);
        this.applyAudio();
        setTimeout(() => this.syncMeta(), 400);
      }
    }

    syncMeta() {
      try {
        const data = this.player?.getVideoData?.();
        if (data) {
          if (data.title) this.currentTitle = data.title;
          if (data.author) this.currentAuthor = data.author;
          if (data.video_id) this.currentVideoId = data.video_id;
        }
        const list = this.player?.getPlaylist?.();
        if (Array.isArray(list)) {
          this.playlistLength = list.length;
          this.playlistIndex = this.player?.getPlaylistIndex?.() ?? -1;
        } else {
          this.playlistLength = 0;
          this.playlistIndex = -1;
        }
        this.onStateChange?.();
      } catch (_) {}
    }

    togglePlay() {
      if (!this.player) return;
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

    configureAudio({ muted, volume }) {
      if (typeof muted === 'boolean') this.muted = muted;
      if (typeof volume === 'number') this.volume = Math.max(0, Math.min(100, volume));
      this.applyAudio();
    }

    applyAudio() {
      if (!this.player) return;
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
