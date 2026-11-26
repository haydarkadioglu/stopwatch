(function (global) {
  'use strict';

  function formatTimeParts(totalMs) {
    const clamped = Math.max(0, Math.floor(totalMs));
    const cs = Math.floor((clamped % 1000) / 10);
    const totalSeconds = Math.floor(clamped / 1000);
    const secs = totalSeconds % 60;
    const mins = Math.floor(totalSeconds / 60) % 60;
    const hrs = Math.floor(totalSeconds / 3600);

    const pad = (n) => String(n).padStart(2, '0');
    const main = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    const ms = `.${pad(cs)}`;
    return { main, ms };
  }

  class TimerEngine {
    constructor(state, onPersist, onTick, onComplete) {
      this.state = state;
      this.onPersist = onPersist;
      this.onTick = onTick;
      this.onComplete = onComplete;
      this.rafId = null;
    }

    getCurrentMs() {
      const t = this.state.timer;
      if (t.mode === 'stopwatch') {
        if (t.running && t.startedAt) {
          return t.elapsedMs + (Date.now() - t.startedAt);
        }
        return t.elapsedMs;
      } else {
        if (t.running && t.startedAt) {
          const remaining = t.remainingMs - (Date.now() - t.startedAt);
          return Math.max(0, remaining);
        }
        return Math.max(0, t.remainingMs);
      }
    }

    start() {
      const t = this.state.timer;
      if (t.running) return;
      if (t.mode === 'countdown' && t.remainingMs <= 0) {
        t.remainingMs = t.countdownDurationMs;
      }
      t.running = true;
      t.startedAt = Date.now();
      this.onPersist();
      this.loop();
    }

    pause() {
      const t = this.state.timer;
      if (!t.running) return;
      const now = Date.now();
      const delta = t.startedAt ? now - t.startedAt : 0;
      if (t.mode === 'stopwatch') {
        t.elapsedMs += delta;
      } else {
        t.remainingMs = Math.max(0, t.remainingMs - delta);
      }
      t.running = false;
      t.startedAt = null;
      this.stopLoop();
      this.onPersist();
      this.onTick(this.getCurrentMs());
    }

    toggle() {
      if (this.state.timer.running) {
        this.pause();
      } else {
        this.start();
      }
    }

    reset() {
      const t = this.state.timer;
      t.running = false;
      t.startedAt = null;
      if (t.mode === 'stopwatch') {
        t.elapsedMs = 0;
        t.laps = [];
      } else {
        t.remainingMs = t.countdownDurationMs;
      }
      this.stopLoop();
      this.onPersist();
      this.onTick(this.getCurrentMs());
    }

    setMode(mode) {
      if (this.state.timer.mode === mode) return;
      if (this.state.timer.running) {
        this.pause();
      }
      this.state.timer.mode = mode;
      this.onPersist();
      this.onTick(this.getCurrentMs());
    }

    setCountdownDuration(ms) {
      const t = this.state.timer;
      t.running = false;
      t.startedAt = null;
      t.countdownDurationMs = Math.max(1000, ms);
      t.remainingMs = t.countdownDurationMs;
      this.stopLoop();
      this.onPersist();
      this.onTick(this.getCurrentMs());
    }

    addMinute() {
      const t = this.state.timer;
      if (t.mode !== 'countdown') return;
      t.remainingMs += 60000;
      t.countdownDurationMs = Math.max(t.countdownDurationMs, t.remainingMs);
      this.onPersist();
      this.onTick(this.getCurrentMs());
    }

    addLap() {
      const t = this.state.timer;
      if (t.mode !== 'stopwatch') return null;
      const totalMs = this.getCurrentMs();
      if (totalMs <= 0) return null;
      const prevTotal = t.laps.length > 0 ? t.laps[0].totalMs : 0;
      const lapMs = Math.max(0, totalMs - prevTotal);
      const lap = {
        id: t.laps.length + 1,
        lapMs,
        totalMs,
      };
      t.laps.unshift(lap);
      this.onPersist();
      return lap;
    }

    clearLaps() {
      this.state.timer.laps = [];
      this.onPersist();
    }

    resumeIfRunning() {
      if (this.state.timer.running) {
        this.loop();
      } else {
        this.onTick(this.getCurrentMs());
      }
    }

    loop() {
      this.stopLoop();
      const step = () => {
        const current = this.getCurrentMs();
        this.onTick(current);

        if (this.state.timer.mode === 'countdown' && current <= 0 && this.state.timer.running) {
          this.state.timer.running = false;
          this.state.timer.startedAt = null;
          this.state.timer.remainingMs = 0;
          this.onPersist();
          this.onComplete();
          return;
        }

        if (this.state.timer.running) {
          this.rafId = requestAnimationFrame(step);
        }
      };
      this.rafId = requestAnimationFrame(step);
    }

    stopLoop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  }

  global.OdakTimer = {
    TimerEngine,
    formatTimeParts,
  };
})(window);
