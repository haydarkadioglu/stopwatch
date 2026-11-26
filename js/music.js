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
          videoId: videoId || null,
          url: rawUrl.trim(),
        };
      }
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return {
          kind: 'video',
          videoId,
          listId: null,
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
      this.isPlaying = false;
      this.volume = 65;
      this.muted = false;
      this.loop = true;
      this.currentTitle = '';
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
      this.pendingSource = { item, autoPlay };
      await this.ensureApi();

      const container = document.getElementById('yt-music-host');
      if (!container) return;

      if (!this.player) {
        const playerVars = {
          autoplay: autoPlay ? 1 : 0,
          controls: 0,
          rel: 0,
          playsinline: 1,
          loop: this.loop ? 1 : 0,
        };
        if (item.kind === 'playlist') {
          playerVars.listType = 'playlist';
          playerVars.list = item.listId;
        } else {
          playerVars.playlist = item.videoId;
        }

        this.player = new window.YT.Player('yt-music-host', {
          height: '1',
          width: '1',
          videoId: item.kind === 'video' ? item.videoId : undefined,
          playerVars,
          events: {
            onReady: () => {
              this.applyAudio();
              if (this.player.setLoop) this.player.setLoop(this.loop);
              if (this.pendingSource?.autoPlay) {
                this.player.playVideo();
              }
              this.syncTitle();
            },
            onStateChange: (e) => {
              this.isPlaying = e.data === window.YT.PlayerState.PLAYING;
              // If single video ended and loop is on, replay it
              if (e.data === window.YT.PlayerState.ENDED && this.loop) {
                if (item.kind === 'video') {
                  this.player.seekTo(0);
                  this.player.playVideo();
                }
              }
              this.syncTitle();
              this.onStateChange?.();
            },
          },
        });
      } else {
        if (item.kind === 'playlist') {
          if (autoPlay) {
            this.player.loadPlaylist({ list: item.listId, listType: 'playlist' });
          } else {
            this.player.cuePlaylist({ list: item.listId, listType: 'playlist' });
          }
        } else {
          if (autoPlay) {
            this.player.loadVideoById(item.videoId);
          } else {
            this.player.cueVideoById(item.videoId);
          }
        }
        if (this.player.setLoop) this.player.setLoop(this.loop);
        this.applyAudio();
      }
    }

    syncTitle() {
      try {
        const data = this.player?.getVideoData?.();
        if (data?.title) {
          this.currentTitle = data.title;
          this.onStateChange?.();
        }
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
      this.player?.nextVideo?.();
    }

    prev() {
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
