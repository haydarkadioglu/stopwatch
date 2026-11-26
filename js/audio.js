(function (global) {
  'use strict';

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.ambientNodes = [];
      this.ambientMode = 'none';
      this.enabled = true;
      this.volume = 0.7;
      this.clicksEnabled = true;
      this.alarmPreset = 'chime';
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.applyMasterGain();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    configure({ enabled, volume, clicksEnabled, alarmPreset, ambientMode }) {
      if (typeof enabled === 'boolean') this.enabled = enabled;
      if (typeof volume === 'number') this.volume = Math.max(0, Math.min(1, volume));
      if (typeof clicksEnabled === 'boolean') this.clicksEnabled = clicksEnabled;
      if (alarmPreset) this.alarmPreset = alarmPreset;
      this.applyMasterGain();

      if (ambientMode !== undefined && ambientMode !== this.ambientMode) {
        this.setAmbient(ambientMode);
      }
    }

    applyMasterGain() {
      if (!this.masterGain || !this.ctx) return;
      const target = this.enabled ? this.volume : 0;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }

    playClick(pitch = 680) {
      if (!this.enabled || !this.clicksEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.55, now + 0.045);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.055);
    }

    playAlarm(presetOverride) {
      if (!this.enabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const preset = presetOverride || this.alarmPreset;
      const now = ctx.currentTime;

      if (preset === 'digital') {
        [0, 0.22, 0.44, 0.72, 0.94].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, now + offset);
          gain.gain.setValueAtTime(0.12, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now + offset);
          osc.stop(now + offset + 0.15);
        });
        return;
      }

      if (preset === 'crystal') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.16;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.24, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + 1.15);
        });
        return;
      }

      // Default: 'chime' (Warm bell)
      const freqs = [440, 554.37, 659.25];
      freqs.forEach((freq, i) => {
        const t = now + i * 0.24;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 1.6);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 1.65);
      });
    }

    stopAmbient() {
      this.ambientNodes.forEach((node) => {
        try {
          if (node.stop) node.stop();
          node.disconnect();
        } catch (_) {}
      });
      this.ambientNodes = [];
    }

    setAmbient(mode) {
      this.ambientMode = mode || 'none';
      this.stopAmbient();
      if (this.ambientMode === 'none') return;

      const ctx = this.ensureContext();
      if (!ctx) return;

      if (this.ambientMode === 'rain' || this.ambientMode === 'brown') {
        const bufferSize = ctx.sampleRate * 3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (this.ambientMode === 'brown') {
            data[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = data[i];
            data[i] *= 3.2;
          } else {
            data[i] = white * 0.45;
          }
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = this.ambientMode === 'rain' ? 'bandpass' : 'lowpass';
        filter.frequency.value = this.ambientMode === 'rain' ? 1100 : 320;
        filter.Q.value = this.ambientMode === 'rain' ? 0.55 : 0.7;

        const gain = ctx.createGain();
        gain.gain.value = this.ambientMode === 'rain' ? 0.22 : 0.32;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();

        this.ambientNodes.push(noise, filter, gain);
      } else if (this.ambientMode === 'drone') {
        const chord = [130.81, 196.0, 293.66]; // C3, G3, D4
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;

        const gain = ctx.createGain();
        gain.gain.value = 0.08;

        filter.connect(gain);
        gain.connect(this.masterGain);
        this.ambientNodes.push(filter, gain);

        chord.forEach((f) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = f;
          osc.connect(filter);
          osc.start();
          this.ambientNodes.push(osc);
        });
      }
    }
  }

  global.OdakAudio = new AudioEngine();
})(window);
