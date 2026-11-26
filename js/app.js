(function () {
  'use strict';

  const QUOTES = [
    '“Küçük adımlar, büyük sonuçların sessiz mimarıdır.”',
    '“Odaklandığın şey büyür; dikkatini koru.”',
    '“Bugün gösterdiğin disiplin, yarının özgürlüğüdür.”',
    '“Mükemmel olmasına gerek yok, başlamış olman yeter.”',
    '“Derin çalışma, gürültülü dünyada bir süper güçtür.”',
  ];

  const DEFAULT_STATE = {
    language: window.OdakI18n.detectDeviceLanguage(),
    timer: {
      mode: 'stopwatch',
      running: false,
      startedAt: null,
      elapsedMs: 0,
      countdownDurationMs: 25 * 60 * 1000,
      remainingMs: 25 * 60 * 1000,
      laps: [],
    },
    studyTask: '',
    quoteIndex: 0,
    background: {
      activeId: 'canvas-aurora',
      selectedIds: ['canvas-aurora', 'canvas-rain', 'photo-library', 'photo-rainy-window'],
      slideshow: false,
      intervalSec: 60,
      blurPx: 4,
      dimPct: 35,
      quality: 'auto',
    },
    design: {
      clockType: 'digital',
      font: 'font-outfit',
      clockScale: 100,
      accent: '#f59e0b',
      cardStyle: 'card-glass',
      showMs: false,
      showTask: true,
      showQuote: true,
      zenMode: false,
      keepAwake: false,
    },
    clock: {
      primaryZone: 'auto',
      dualEnabled: false,
      secondaryZone: 'America/New_York',
      showDate: true,
      dateFormat: 'long',
      hour24: true,
      showSeconds: true,
    },
    weather: {
      enabled: false,
      city: '',
      unit: 'c',
      cached: null,
    },
    audio: {
      enabled: true,
      volume: 70,
      alarmPreset: 'chime',
      clicksEnabled: true,
      ambientMode: 'none',
    },
    bgAudio: {
      enabled: false,
      volume: 35,
    },
    music: {
      showWidget: true,
      shortcutsEnabled: true,
      scale: 100,
      enabled: true,
      volume: 65,
      loop: true,
      activeId: 'music-sample-1',
      items: [
        {
          id: 'music-sample-1',
          title: 'Örnek Çalışma Listesi (YouTube Music)',
          kind: 'playlist',
          listId: 'PLqtMUv_N5txoOTx2_CqYZxwJmo6FWJAYT',
          videoId: 'W2YyDarMiR4',
          index: 1,
          url: 'https://www.youtube.com/watch?v=W2YyDarMiR4&list=PLqtMUv_N5txoOTx2_CqYZxwJmo6FWJAYT&index=2',
        },
      ],
    },
  };

  let state = window.OdakDB.loadState(DEFAULT_STATE);
  let timerEngine = null;
  let slideshowTimer = null;
  let idleTimer = null;
  let toastTimer = null;
  let alarmRepeatTimer = null;
  let clockInterval = null;
  let wakeLockSentinel = null;
  let deferredInstallPrompt = null;
  let expandedMusicId = null;

  // DOM Elements
  const el = {
    body: document.body,
    digitalClockWrap: document.getElementById('digital-clock-wrap'),
    analogClockWrap: document.getElementById('analog-clock-wrap'),
    analogTicks: document.getElementById('analog-ticks'),
    handHour: document.getElementById('hand-hour'),
    handMinute: document.getElementById('hand-minute'),
    handSecond: document.getElementById('hand-second'),
    analogSubreadout: document.getElementById('analog-subreadout'),
    timerDisplay: document.getElementById('timer-display'),
    timerMs: document.getElementById('timer-ms'),
    timerAmpm: document.getElementById('timer-ampm'),
    timerControls: document.getElementById('timer-controls'),
    clockMetaRow: document.getElementById('clock-meta-row'),
    clockDateText: document.getElementById('clock-date-text'),
    clockZoneBadge: document.getElementById('clock-zone-badge'),
    dualClockWrap: document.getElementById('dual-clock-wrap'),
    dualZoneName: document.getElementById('dual-zone-name'),
    dualZoneDate: document.getElementById('dual-zone-date'),
    dualZoneTime: document.getElementById('dual-zone-time'),
    weatherPill: document.getElementById('weather-pill'),
    weatherIcon: document.getElementById('weather-icon'),
    weatherTemp: document.getElementById('weather-temp'),
    weatherDesc: document.getElementById('weather-desc'),
    weatherCity: document.getElementById('weather-city'),
    startPauseBtn: document.getElementById('btn-start-pause'),
    startPauseLabel: document.getElementById('start-pause-label'),
    lapBtn: document.getElementById('btn-lap'),
    addMinBtn: document.getElementById('btn-add-min'),
    resetBtn: document.getElementById('btn-reset'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    countdownSetup: document.getElementById('countdown-setup'),
    countdownProgressWrap: document.getElementById('countdown-progress-wrap'),
    countdownProgressBar: document.getElementById('countdown-progress-bar'),
    chipBtns: document.querySelectorAll('.chip-btn'),
    inputHours: document.getElementById('input-hours'),
    inputMinutes: document.getElementById('input-minutes'),
    inputSeconds: document.getElementById('input-seconds'),
    btnApplyTime: document.getElementById('btn-apply-time'),
    lapsPanel: document.getElementById('laps-panel'),
    lapsList: document.getElementById('laps-list'),
    lapsCount: document.getElementById('laps-count'),
    btnCopyLaps: document.getElementById('btn-copy-laps'),
    btnClearLaps: document.getElementById('btn-clear-laps'),
    studyTaskInput: document.getElementById('study-task-input'),
    taskInputWrap: document.getElementById('task-input-wrap'),
    hudLangSelect: document.getElementById('hud-lang-select'),
    drawerLangSelect: document.getElementById('drawer-lang-select'),
    btnInstall: document.getElementById('btn-install'),
    focusQuote: document.getElementById('focus-quote'),
    btnNextBg: document.getElementById('btn-next-bg'),
    btnMute: document.getElementById('btn-mute'),
    iconSoundOn: document.getElementById('icon-sound-on'),
    iconSoundOff: document.getElementById('icon-sound-off'),
    btnCustomize: document.getElementById('btn-customize'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    iconFsEnter: document.getElementById('icon-fs-enter'),
    iconFsExit: document.getElementById('icon-fs-exit'),
    drawer: document.getElementById('studio-drawer'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    drawerTabs: document.querySelectorAll('.drawer-tab'),
    tabPanes: {
      backgrounds: document.getElementById('tab-pane-backgrounds'),
      design: document.getElementById('tab-pane-design'),
      music: document.getElementById('tab-pane-music'),
      audio: document.getElementById('tab-pane-audio'),
    },
    sliderBlur: document.getElementById('slider-blur'),
    valBlur: document.getElementById('val-blur'),
    sliderDim: document.getElementById('slider-dim'),
    valDim: document.getElementById('val-dim'),
    qualityOptions: document.querySelectorAll('.quality-option'),
    qualityBadge: document.getElementById('quality-badge'),
    toggleSlideshow: document.getElementById('toggle-slideshow'),
    slideshowIntervalWrap: document.getElementById('slideshow-interval-wrap'),
    selectSlideshowInterval: document.getElementById('select-slideshow-interval'),
    slideshowStatus: document.getElementById('slideshow-status'),
    inputUploadMedia: document.getElementById('input-upload-media'),
    inputBgUrl: document.getElementById('input-bg-url'),
    btnAddUrl: document.getElementById('btn-add-url'),
    bgGallery: document.getElementById('bg-gallery'),
    cacheUsageLabel: document.getElementById('cache-usage-label'),
    clockTypeOptions: document.querySelectorAll('.clock-type-option'),
    fontOptions: document.querySelectorAll('.font-option'),
    sliderClockSize: document.getElementById('slider-clock-size'),
    valClockSize: document.getElementById('val-clock-size'),
    swatches: document.querySelectorAll('.swatch'),
    inputAccentColor: document.getElementById('input-accent-color'),
    styleOptions: document.querySelectorAll('.style-option'),
    toggleMs: document.getElementById('toggle-ms'),
    toggleTask: document.getElementById('toggle-task'),
    toggleQuote: document.getElementById('toggle-quote'),
    toggleZen: document.getElementById('toggle-zen'),
    toggleKeepAwake: document.getElementById('toggle-keep-awake'),
    searchPrimaryZone: document.getElementById('search-primary-zone'),
    selectPrimaryZone: document.getElementById('select-primary-zone'),
    toggleDualZone: document.getElementById('toggle-dual-zone'),
    secondaryZoneWrap: document.getElementById('secondary-zone-wrap'),
    searchSecondaryZone: document.getElementById('search-secondary-zone'),
    selectSecondaryZone: document.getElementById('select-secondary-zone'),
    toggleShowDate: document.getElementById('toggle-show-date'),
    dateFormatWrap: document.getElementById('date-format-wrap'),
    selectDateFormat: document.getElementById('select-date-format'),
    toggleHour24: document.getElementById('toggle-hour-24'),
    toggleClockSeconds: document.getElementById('toggle-clock-seconds'),
    toggleWeather: document.getElementById('toggle-weather'),
    weatherSetupWrap: document.getElementById('weather-setup-wrap'),
    inputWeatherCity: document.getElementById('input-weather-city'),
    btnApplyWeather: document.getElementById('btn-apply-weather'),
    btnLocateWeather: document.getElementById('btn-locate-weather'),
    selectWeatherUnit: document.getElementById('select-weather-unit'),
    btnResetDesign: document.getElementById('btn-reset-design'),
    toggleSoundEnabled: document.getElementById('toggle-sound-enabled'),
    sliderVolume: document.getElementById('slider-volume'),
    valVolume: document.getElementById('val-volume'),
    selectAlarm: document.getElementById('select-alarm'),
    btnTestAlarm: document.getElementById('btn-test-alarm'),
    toggleClicks: document.getElementById('toggle-clicks'),
    selectAmbient: document.getElementById('select-ambient'),
    toggleBgAudio: document.getElementById('toggle-bg-audio'),
    sliderBgVolume: document.getElementById('slider-bg-volume'),
    valBgVolume: document.getElementById('val-bg-volume'),
    musicWidget: document.getElementById('music-widget'),
    mwQueuePopover: document.getElementById('mw-queue-popover'),
    mwThumb: document.getElementById('mw-thumb'),
    mwEq: document.getElementById('mw-eq'),
    mwPrev: document.getElementById('mw-prev'),
    mwPlay: document.getElementById('mw-play'),
    mwIconPlay: document.getElementById('mw-icon-play'),
    mwIconPause: document.getElementById('mw-icon-pause'),
    mwNext: document.getElementById('mw-next'),
    mwTitle: document.getElementById('mw-title'),
    mwSub: document.getElementById('mw-sub'),
    mwLoop: document.getElementById('mw-loop'),
    mwMute: document.getElementById('mw-mute'),
    mwIconVol: document.getElementById('mw-icon-vol'),
    mwIconMuted: document.getElementById('mw-icon-muted'),
    mwVolPopover: document.getElementById('mw-vol-popover'),
    mwVolSlider: document.getElementById('mw-vol-slider'),
    mwVolPct: document.getElementById('mw-vol-pct'),
    mwVolToggleMute: document.getElementById('mw-vol-toggle-mute'),
    sliderMusicScale: document.getElementById('slider-music-scale'),
    valMusicScale: document.getElementById('val-music-scale'),
    toggleMusicWidget: document.getElementById('toggle-music-widget'),
    toggleMusicKeys: document.getElementById('toggle-music-keys'),
    drawerMusicQueue: document.getElementById('drawer-music-queue'),
    drawerMusicPrev: document.getElementById('drawer-music-prev'),
    drawerMusicPlay: document.getElementById('drawer-music-play'),
    drawerMusicNext: document.getElementById('drawer-music-next'),
    drawerMusicLoop: document.getElementById('drawer-music-loop'),
    npCover: document.getElementById('np-cover'),
    npCoverPh: document.getElementById('np-cover-ph'),
    npTitle: document.getElementById('np-title'),
    npAuthor: document.getElementById('np-author'),
    npSource: document.getElementById('np-source'),
    npMute: document.getElementById('np-mute'),
    npIconVol: document.getElementById('np-icon-vol'),
    npIconMuted: document.getElementById('np-icon-muted'),
    sliderMusicVolume: document.getElementById('slider-music-volume'),
    valMusicVolume: document.getElementById('val-music-volume'),
    inputMusicUrl: document.getElementById('input-music-url'),
    btnAddMusic: document.getElementById('btn-add-music'),
    musicListCount: document.getElementById('music-list-count'),
    musicList: document.getElementById('music-list'),
    timeupBanner: document.getElementById('timeup-banner'),
    btnDismissTimeup: document.getElementById('btn-dismiss-timeup'),
    btnRestartTimeup: document.getElementById('btn-restart-timeup'),
    toast: document.getElementById('toast'),
  };

  function tr(key, vars) {
    return window.OdakI18n.t(state.language, key, vars);
  }

  function populateLangSelects() {
    [el.hudLangSelect, el.drawerLangSelect].forEach((sel) => {
      if (!sel) return;
      if (sel.options.length === 0) {
        window.OdakI18n.LANGUAGES.forEach((lang) => {
          const opt = document.createElement('option');
          opt.value = lang.code;
          opt.textContent = lang.label;
          sel.appendChild(opt);
        });
      }
      sel.value = state.language;
    });
  }

  function populateTimezoneSelects() {
    if (!window.OdakWorld) return;
    const zones = window.OdakWorld.TIMEZONES;
    const localCity = window.OdakWorld.getZoneShortName('auto');
    const q1 = (el.searchPrimaryZone?.value || '').trim().toLowerCase();
    const q2 = (el.searchSecondaryZone?.value || '').trim().toLowerCase();

    if (el.selectPrimaryZone) {
      const current1 = state.clock.primaryZone || 'auto';
      el.selectPrimaryZone.innerHTML = '';
      zones
        .filter((z) => {
          if (z.id === current1 || z.id === 'auto') return true;
          if (!q1) return true;
          return z.label.toLowerCase().includes(q1) || z.id.toLowerCase().includes(q1);
        })
        .forEach((z) => {
          const opt = document.createElement('option');
          opt.value = z.id;
          opt.textContent = z.id === 'auto' ? `${tr('localZoneAuto')} · ${localCity}` : z.label;
          el.selectPrimaryZone.appendChild(opt);
        });
      el.selectPrimaryZone.value = current1;
    }

    if (el.selectSecondaryZone) {
      const current2 = state.clock.secondaryZone || 'America/New_York';
      el.selectSecondaryZone.innerHTML = '';
      zones
        .filter((z) => {
          if (z.id === 'auto') return false;
          if (z.id === current2) return true;
          if (!q2) return true;
          return z.label.toLowerCase().includes(q2) || z.id.toLowerCase().includes(q2);
        })
        .forEach((z) => {
          const opt = document.createElement('option');
          opt.value = z.id;
          opt.textContent = z.label;
          el.selectSecondaryZone.appendChild(opt);
        });
      el.selectSecondaryZone.value = current2;
    }
  }

  function applyLanguage() {
    const lang = state.language || 'tr';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    populateLangSelects();
    populateTimezoneSelects();

    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = tr(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      node.placeholder = tr(node.dataset.i18nPlaceholder);
    });

    const quotes = window.OdakI18n.getQuotes(lang);
    el.focusQuote.textContent = quotes[state.quoteIndex % quotes.length];
    if (timerEngine) {
      renderTimerUI(timerEngine.getCurrentMs());
    }
    syncSlideshow();
    renderGallery();
    renderMusicList();
    syncMusicUI();
    renderWeatherPill();
    updateCacheUsage();
  }

  function syncQualityUI() {
    const mode = state.background.quality || 'auto';
    el.qualityOptions?.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.quality === mode);
    });
    if (el.qualityBadge) {
      const { tier, reason } = window.OdakBackgrounds.resolveQuality(mode, state.background.blurPx);
      const labelMap = { low: '480p', medium: '720p', high: '1080p' };
      el.qualityBadge.textContent = reason ? `${labelMap[tier]} · ${reason}` : labelMap[tier];
    }
  }

  function applyActiveBackground(id) {
    const bg = window.OdakBackgrounds.apply(id, state.background.quality, state.background.blurPx);
    const bgOn = state.audio.enabled && state.bgAudio.enabled;
    window.OdakBackgrounds.syncAudio(bgOn, state.bgAudio.volume);
    syncQualityUI();
    return bg;
  }

  function persist() {
    window.OdakDB.saveState(state);
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2600);
  }

  function getContrastColor(hex) {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return '#0f172a';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? '#0f172a' : '#f8fafc';
  }

  function applyDesign() {
    const d = state.design;
    const root = document.documentElement;
    root.style.setProperty('--accent', d.accent);
    root.style.setProperty('--accent-contrast', getContrastColor(d.accent));
    root.style.setProperty('--bg-blur', `${state.background.blurPx}px`);
    root.style.setProperty('--bg-dim', (state.background.dimPct / 100).toFixed(2));
    root.style.setProperty('--clock-scale', (d.clockScale / 100).toFixed(2));

    el.body.classList.remove('font-outfit', 'font-mono', 'font-serif', 'font-rounded');
    el.body.classList.add(d.font);

    el.body.classList.remove('card-glass', 'card-minimal', 'card-solid');
    el.body.classList.add(d.cardStyle);

    const isAnalog = d.clockType === 'analog';
    el.digitalClockWrap.classList.toggle('hidden', isAnalog);
    el.analogClockWrap.classList.toggle('hidden', !isAnalog);
    el.clockTypeOptions.forEach((btn) => btn.classList.toggle('active', btn.dataset.clockType === d.clockType));

    el.timerMs.classList.toggle('hidden', !d.showMs);
    el.taskInputWrap.classList.toggle('hidden', !d.showTask);
    el.focusQuote.classList.toggle('hidden', !d.showQuote);
    const quotes = window.OdakI18n.getQuotes(state.language);
    el.focusQuote.textContent = quotes[state.quoteIndex % quotes.length];

    // Sync Drawer UI
    el.sliderBlur.value = state.background.blurPx;
    el.valBlur.textContent = `${state.background.blurPx} px`;
    el.sliderDim.value = state.background.dimPct;
    el.valDim.textContent = `${state.background.dimPct}%`;

    el.sliderClockSize.value = d.clockScale;
    el.valClockSize.textContent = `${d.clockScale}%`;
    el.inputAccentColor.value = d.accent;

    el.fontOptions.forEach((btn) => btn.classList.toggle('active', btn.dataset.font === d.font));
    el.styleOptions.forEach((btn) => btn.classList.toggle('active', btn.dataset.card === d.cardStyle));
    el.swatches.forEach((sw) => sw.classList.toggle('active', sw.dataset.color.toLowerCase() === d.accent.toLowerCase()));

    el.toggleMs.checked = d.showMs;
    el.toggleTask.checked = d.showTask;
    el.toggleQuote.checked = d.showQuote;
    el.toggleZen.checked = d.zenMode;
    if (el.toggleKeepAwake) el.toggleKeepAwake.checked = Boolean(d.keepAwake);

    const c = state.clock;
    if (el.selectPrimaryZone) el.selectPrimaryZone.value = c.primaryZone || 'auto';
    if (el.toggleDualZone) el.toggleDualZone.checked = Boolean(c.dualEnabled);
    if (el.secondaryZoneWrap) el.secondaryZoneWrap.classList.toggle('hidden', !c.dualEnabled);
    if (el.selectSecondaryZone) el.selectSecondaryZone.value = c.secondaryZone || 'America/New_York';
    if (el.toggleShowDate) el.toggleShowDate.checked = Boolean(c.showDate);
    if (el.dateFormatWrap) el.dateFormatWrap.classList.toggle('hidden', !c.showDate);
    if (el.selectDateFormat) el.selectDateFormat.value = c.dateFormat || 'long';
    if (el.toggleHour24) el.toggleHour24.checked = c.hour24 !== false;
    if (el.toggleClockSeconds) el.toggleClockSeconds.checked = c.showSeconds !== false;

    const w = state.weather;
    if (el.toggleWeather) el.toggleWeather.checked = Boolean(w.enabled);
    if (el.weatherSetupWrap) el.weatherSetupWrap.classList.toggle('hidden', !w.enabled);
    if (el.inputWeatherCity && document.activeElement !== el.inputWeatherCity) {
      el.inputWeatherCity.value = w.city || '';
    }
    if (el.selectWeatherUnit) el.selectWeatherUnit.value = w.unit || 'c';

    if (!d.zenMode) {
      el.body.classList.remove('zen-idle');
    }
  }

  function applyAudio() {
    const a = state.audio;
    window.OdakAudio.configure({
      enabled: a.enabled,
      volume: a.volume / 100,
      clicksEnabled: a.clicksEnabled,
      alarmPreset: a.alarmPreset,
      ambientMode: a.enabled ? a.ambientMode : 'none',
    });
    const bgOn = a.enabled && state.bgAudio.enabled;
    window.OdakBackgrounds.syncAudio(bgOn, state.bgAudio.volume);

    const musicOn = a.enabled && state.music.enabled;
    window.OdakMusic.player.configureAudio({
      muted: !musicOn,
      volume: state.music.volume,
    });

    el.btnMute.classList.toggle('muted', !a.enabled);
    el.iconSoundOn.classList.toggle('hidden', !a.enabled);
    el.iconSoundOff.classList.toggle('hidden', a.enabled);

    el.toggleSoundEnabled.checked = a.enabled;
    el.sliderVolume.value = a.volume;
    el.valVolume.textContent = `${a.volume}%`;
    el.selectAlarm.value = a.alarmPreset;
    el.toggleClicks.checked = a.clicksEnabled;
    el.selectAmbient.value = a.ambientMode;

    if (el.toggleBgAudio) el.toggleBgAudio.checked = state.bgAudio.enabled;
    if (el.sliderBgVolume) el.sliderBgVolume.value = state.bgAudio.volume;
    if (el.valBgVolume) el.valBgVolume.textContent = `${state.bgAudio.volume}%`;

    syncMusicUI();
  }

  function syncMusicUI() {
    const m = state.music;
    const p = window.OdakMusic.player;
    const activeItem = m.items.find((x) => x.id === m.activeId) || m.items[0];
    const hasItems = m.items.length > 0;

    if (el.musicWidget) {
      el.musicWidget.classList.toggle('hidden', !m.showWidget || !hasItems);
      el.musicWidget.classList.toggle('playing', p.isPlaying);
    }
    if (el.mwTitle) {
      const displayTitle = activeItem?.id === 'music-sample-1' ? tr('musicSampleTitle') : activeItem?.title;
      el.mwTitle.textContent = p.currentTitle || displayTitle || 'YouTube';
    }
    if (el.mwSub) {
      const subParts = [];
      if (p.currentAuthor) subParts.push(p.currentAuthor);
      if (p.playlistLength > 0 && p.playlistIndex >= 0) {
        subParts.push(`${p.playlistIndex + 1} / ${p.playlistLength}`);
      }
      const subText = subParts.join(' · ');
      el.mwSub.textContent = subText;
      el.mwSub.classList.toggle('hidden', !subText);
    }
    if (el.mwThumb && el.mwEq) {
      const vidId = p.currentVideoId || activeItem?.videoId;
      if (vidId) {
        el.mwThumb.src = `https://img.youtube.com/vi/${vidId}/default.jpg`;
        el.mwThumb.classList.remove('hidden');
        el.mwEq.classList.add('hidden');
      } else {
        el.mwThumb.classList.add('hidden');
        el.mwEq.classList.remove('hidden');
      }
    }
    if (el.mwIconPlay && el.mwIconPause) {
      el.mwIconPlay.classList.toggle('hidden', p.isPlaying);
      el.mwIconPause.classList.toggle('hidden', !p.isPlaying);
    }
    if (el.drawerMusicPlay) {
      el.drawerMusicPlay.textContent = p.isPlaying ? tr('musicPause') : tr('musicPlay');
    }
    if (el.mwLoop) el.mwLoop.classList.toggle('active', m.loop);
    if (el.drawerMusicLoop) el.drawerMusicLoop.classList.toggle('active', m.loop);
    const musicAudible = m.enabled && state.audio.enabled;
    if (el.mwMute) el.mwMute.classList.toggle('active', musicAudible);
    if (el.mwIconVol && el.mwIconMuted) {
      el.mwIconVol.classList.toggle('hidden', !musicAudible);
      el.mwIconMuted.classList.toggle('hidden', musicAudible);
    }
    if (el.npMute) el.npMute.classList.toggle('active', musicAudible);
    if (el.npIconVol && el.npIconMuted) {
      el.npIconVol.classList.toggle('hidden', !musicAudible);
      el.npIconMuted.classList.toggle('hidden', musicAudible);
    }

    // Now Playing Card in Music Tab
    const activeTitle = activeItem?.id === 'music-sample-1' ? tr('musicSampleTitle') : activeItem?.title;
    if (el.npTitle) {
      el.npTitle.textContent = p.currentTitle || activeTitle || tr('nothingPlaying');
    }
    if (el.npAuthor) {
      el.npAuthor.textContent = p.currentAuthor || '';
      el.npAuthor.classList.toggle('hidden', !p.currentAuthor);
    }
    if (el.npSource) {
      const parts = [];
      if (activeTitle) parts.push(activeTitle);
      if (p.playlistLength > 0 && p.playlistIndex >= 0) {
        parts.push(`${p.playlistIndex + 1} / ${p.playlistLength}`);
      }
      el.npSource.textContent = parts.join(' · ');
      el.npSource.classList.toggle('hidden', parts.length === 0);
    }
    if (el.npCover && el.npCoverPh) {
      const vidId = p.currentVideoId || activeItem?.videoId;
      if (vidId) {
        el.npCover.src = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
        el.npCover.classList.remove('hidden');
        el.npCoverPh.classList.add('hidden');
      } else {
        el.npCover.classList.add('hidden');
        el.npCoverPh.classList.remove('hidden');
      }
    }

    if (el.toggleMusicWidget) el.toggleMusicWidget.checked = m.showWidget;
    if (el.toggleMusicKeys) el.toggleMusicKeys.checked = m.shortcutsEnabled !== false;
    if (el.sliderMusicVolume) el.sliderMusicVolume.value = m.volume;
    if (el.valMusicVolume) el.valMusicVolume.textContent = `${m.volume}%`;
    if (el.mwVolSlider) el.mwVolSlider.value = m.volume;
    if (el.mwVolPct) el.mwVolPct.textContent = musicAudible ? `${m.volume}%` : '0%';
    const scale = m.scale || 100;
    document.documentElement.style.setProperty('--music-scale', (scale / 100).toFixed(2));
    if (el.sliderMusicScale) el.sliderMusicScale.value = scale;
    if (el.valMusicScale) el.valMusicScale.textContent = `${scale}%`;

    renderMusicQueue();
    renderMusicList();
  }

  function renderMusicQueue() {
    const { prev, next } = window.OdakMusic.player.getQueuePreview();
    const rows = [
      ...prev.map((item) => ({ ...item, tag: tr('queuePrev') })),
      ...next.map((item) => ({ ...item, tag: tr('queueNext') })),
    ];

    const populate = (container) => {
      if (!container) return;
      container.innerHTML = '';
      if (rows.length === 0) {
        container.classList.add('hidden');
        return;
      }
      container.classList.remove('hidden');
      rows.forEach((r) => {
        const div = document.createElement('div');
        div.className = 'queue-row';
        div.innerHTML = `
          <img class="queue-thumb" src="${r.thumb}" alt="" loading="lazy" />
          <div class="queue-meta">
            <div class="queue-tag">${r.tag}</div>
            <div class="queue-title">${r.title}</div>
          </div>
        `;
        div.addEventListener('click', () => window.OdakMusic.player.playAt(r.index));
        container.appendChild(div);
      });
    };

    populate(el.mwQueuePopover);
    populate(el.drawerMusicQueue);
  }

  function renderMusicList() {
    if (!el.musicList) return;
    if (el.musicListCount) {
      el.musicListCount.textContent = String(state.music.items.length);
    }
    const activeInput = el.musicList.querySelector('.ml-rename:focus');
    if (activeInput) return; // Keep focus intact while user types a new list name

    const prevTracksScroll = el.musicList.querySelector('.ml-tracks')?.scrollTop || 0;
    el.musicList.innerHTML = '';
    const p = window.OdakMusic.player;

    state.music.items.forEach((item) => {
      const isPlayingItem = item.id === state.music.activeId;
      const isExpanded = item.id === expandedMusicId;

      const card = document.createElement('div');
      card.className =
        'ml-item' +
        (isPlayingItem ? ' active' : '') +
        (isExpanded ? ' expanded' : '');

      const typeLabel = item.kind === 'playlist' ? tr('musicTypePlaylist') : tr('musicTypeSingle');
      const itemTitle = item.id === 'music-sample-1' ? tr('musicSampleTitle') : item.title;
      const trackCountText =
        isPlayingItem && item.kind === 'playlist' && p.playlistIds.length > 0
          ? ` · ${tr('mlTrackCount', { n: p.playlistIds.length })}`
          : '';

      const header = document.createElement('div');
      header.className = 'ml-header';
      header.innerHTML = `
        <div class="ml-meta">
          <div class="ml-title-row">
            <span class="ml-title"></span>
            ${isPlayingItem ? `<span class="ml-playing-pill">${tr('mlNowPlayingBadge')}</span>` : ''}
          </div>
          <div class="ml-sub">${typeLabel}${trackCountText}</div>
        </div>
        <svg class="ml-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
      header.querySelector('.ml-title').textContent = itemTitle;
      header.addEventListener('click', () => {
        expandedMusicId = expandedMusicId === item.id ? null : item.id;
        renderMusicList();
      });
      card.appendChild(header);

      if (isExpanded) {
        const details = document.createElement('div');
        details.className = 'ml-details';

        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.className = 'ml-rename';
        renameInput.value = itemTitle;
        renameInput.placeholder = tr('mlRenamePlaceholder');
        renameInput.addEventListener('input', (e) => {
          if (item.id === 'music-sample-1') item.id = 'music-custom-' + Date.now();
          if (state.music.activeId === 'music-sample-1' && isPlayingItem) {
            state.music.activeId = item.id;
            expandedMusicId = item.id;
          }
          item.title = e.target.value;
          header.querySelector('.ml-title').textContent = item.title || tr('mlRenamePlaceholder');
          persist();
        });
        details.appendChild(renameInput);

        const actions = document.createElement('div');
        actions.className = 'ml-actions';

        const playBtn = document.createElement('button');
        playBtn.className = 'small-btn accent-small-btn';
        playBtn.textContent = tr('mlPlay');
        playBtn.addEventListener('click', () => {
          state.music.activeId = item.id;
          window.OdakMusic.player.currentTitle = '';
          window.OdakMusic.player.currentAuthor = '';
          window.OdakMusic.player.load(item, true);
          persist();
          renderMusicList();
          syncMusicUI();
        });

        const ytLink = document.createElement('a');
        ytLink.className = 'small-btn';
        ytLink.href = item.url;
        ytLink.target = '_blank';
        ytLink.rel = 'noopener noreferrer';
        ytLink.textContent = tr('mlOpenYT');

        const delBtn = document.createElement('button');
        delBtn.className = 'small-btn ml-del-btn';
        delBtn.textContent = tr('mlDelete');
        delBtn.addEventListener('click', () => {
          state.music.items = state.music.items.filter((x) => x.id !== item.id);
          if (expandedMusicId === item.id) expandedMusicId = null;
          if (state.music.activeId === item.id) {
            state.music.activeId = state.music.items[0]?.id || null;
            if (state.music.activeId) {
              window.OdakMusic.player.load(state.music.items[0], false);
            }
          }
          persist();
          renderMusicList();
          syncMusicUI();
        });

        actions.appendChild(playBtn);
        actions.appendChild(ytLink);
        actions.appendChild(delBtn);
        details.appendChild(actions);

        if (isPlayingItem && item.kind === 'playlist' && p.playlistIds.length > 0) {
          const tracksEl = document.createElement('div');
          tracksEl.className = 'ml-tracks';
          p.getPlaylistTracks(30).forEach((t) => {
            const trow = document.createElement('div');
            trow.className =
              'ml-track-row' +
              (t.current ? ' current' : '') +
              (t.unavailable ? ' unavailable' : '');
            trow.innerHTML = `
              <span class="ml-track-idx">${t.index + 1}</span>
              <img class="ml-track-thumb" src="${t.thumb}" alt="" loading="lazy" />
              <span class="ml-track-name"></span>
            `;
            trow.querySelector('.ml-track-name').textContent = t.unavailable
              ? `${t.title} — ${tr('trackUnavailable')}`
              : t.title;
            trow.addEventListener('click', () => {
              p.playAt(t.index);
            });
            tracksEl.appendChild(trow);
          });
          details.appendChild(tracksEl);
        } else if (item.kind === 'playlist') {
          const hint = document.createElement('p');
          hint.className = 'helper-text';
          hint.textContent = tr('mlTracksHint');
          details.appendChild(hint);
        }

        card.appendChild(details);
      }

      el.musicList.appendChild(card);
    });
    const newTracksEl = el.musicList.querySelector('.ml-tracks');
    if (newTracksEl && prevTracksScroll > 0) {
      newTracksEl.scrollTop = prevTracksScroll;
    }
  }

  function syncClockLoop() {
    clearInterval(clockInterval);
    if (state.timer.mode === 'clock') {
      clockInterval = setInterval(() => renderTimerUI(0), 250);
    }
  }

  function renderTimerUI(currentMs) {
    const t = state.timer;
    const isClock = t.mode === 'clock';
    const isCountdown = t.mode === 'countdown';
    const isRunning = t.running;

    el.modeBtns.forEach((btn) => {
      const active = btn.dataset.mode === t.mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    el.countdownSetup.classList.toggle('hidden', !isCountdown || isRunning);
    el.countdownProgressWrap.classList.toggle('hidden', !isCountdown);
    if (el.timerControls) el.timerControls.classList.toggle('hidden', isClock);
    el.lapBtn.classList.toggle('hidden', isCountdown || isClock);
    el.addMinBtn.classList.toggle('hidden', !isCountdown);

    if (isClock && window.OdakWorld) {
      const now = new Date();
      const c = state.clock;
      const tp = window.OdakWorld.getTimePartsForZone(now, c.primaryZone, {
        hour12: !c.hour24,
        showSeconds: c.showSeconds !== false,
      });

      el.timerDisplay.textContent = tp.main;
      el.timerMs.classList.add('hidden');
      if (el.timerAmpm) {
        el.timerAmpm.textContent = tp.suffix.trim();
        el.timerAmpm.classList.toggle('hidden', !tp.suffix.trim());
      }
      if (el.analogSubreadout) {
        el.analogSubreadout.textContent = `${tp.main}${tp.suffix}`;
      }
      if (el.handSecond && el.handMinute && el.handHour) {
        el.handSecond.classList.toggle('hidden', c.showSeconds === false);
        const msFrac = now.getMilliseconds() / 1000;
        const secDeg = ((tp.seconds + msFrac) % 60) * 6;
        const minDeg = ((tp.minutes + tp.seconds / 60) % 60) * 6;
        const hourDeg = ((tp.hours % 12) + tp.minutes / 60) * 30;
        el.handSecond.style.transform = `rotate(${secDeg}deg)`;
        el.handMinute.style.transform = `rotate(${minDeg}deg)`;
        el.handHour.style.transform = `rotate(${hourDeg}deg)`;
      }

      if (el.clockMetaRow) {
        const showZoneBadge = (c.primaryZone && c.primaryZone !== 'auto') || c.dualEnabled;
        el.clockMetaRow.classList.toggle('hidden', !c.showDate && !showZoneBadge);
        if (el.clockDateText) {
          el.clockDateText.textContent = c.showDate
            ? window.OdakWorld.formatDateForZone(now, c.primaryZone, state.language, c.dateFormat)
            : '';
          el.clockDateText.classList.toggle('hidden', !c.showDate);
        }
        if (el.clockZoneBadge) {
          el.clockZoneBadge.textContent = window.OdakWorld.getZoneShortName(c.primaryZone);
          el.clockZoneBadge.classList.toggle('hidden', !showZoneBadge);
        }
      }

      if (el.dualClockWrap) {
        el.dualClockWrap.classList.toggle('hidden', !c.dualEnabled);
        if (c.dualEnabled) {
          const secZone = c.secondaryZone || 'America/New_York';
          const sp = window.OdakWorld.getTimePartsForZone(now, secZone, {
            hour12: !c.hour24,
            showSeconds: c.showSeconds !== false,
          });
          if (el.dualZoneName) el.dualZoneName.textContent = window.OdakWorld.getZoneShortName(secZone);
          if (el.dualZoneTime) el.dualZoneTime.textContent = `${sp.main}${sp.suffix}`;
          if (el.dualZoneDate) {
            el.dualZoneDate.textContent = c.showDate
              ? window.OdakWorld.formatDateForZone(now, secZone, state.language, 'compact')
              : '';
          }
        }
      }

      document.title = `${tp.main}${tp.suffix} — ${tr('pageTitleRunning')}`;
      renderLaps();
      return;
    }

    // Stopwatch / Countdown display
    el.timerMs.classList.toggle('hidden', !state.design.showMs);
    if (el.timerAmpm) el.timerAmpm.classList.add('hidden');
    if (el.clockMetaRow) el.clockMetaRow.classList.add('hidden');
    if (el.dualClockWrap) el.dualClockWrap.classList.add('hidden');

    const parts = window.OdakTimer.formatTimeParts(currentMs);
    el.timerDisplay.textContent = parts.main;
    el.timerMs.textContent = parts.ms;
    if (el.analogSubreadout) {
      el.analogSubreadout.textContent = parts.main;
    }
    if (el.handSecond && el.handMinute && el.handHour) {
      el.handSecond.classList.remove('hidden');
      const totalSec = Math.max(0, currentMs) / 1000;
      const secDeg = (totalSec % 60) * 6;
      const minDeg = ((totalSec / 60) % 60) * 6;
      const hourDeg = ((totalSec / 3600) % 12) * 30;
      el.handSecond.style.transform = `rotate(${secDeg}deg)`;
      el.handMinute.style.transform = `rotate(${minDeg}deg)`;
      el.handHour.style.transform = `rotate(${hourDeg}deg)`;
    }

    el.startPauseLabel.textContent = isRunning ? tr('pause') : tr('start');

    if (isCountdown && t.countdownDurationMs > 0) {
      const pct = Math.max(0, Math.min(100, (currentMs / t.countdownDurationMs) * 100));
      el.countdownProgressBar.style.width = `${pct}%`;
    }

    document.title = isRunning ? `${parts.main} — ${tr('pageTitleRunning')}` : tr('pageTitle');
    renderLaps();
  }

  function renderLaps() {
    const t = state.timer;
    const showLaps = t.mode === 'stopwatch' && t.laps.length > 0;
    el.lapsPanel.classList.toggle('hidden', !showLaps);
    if (!showLaps) return;

    el.lapsCount.textContent = t.laps.length;
    let minMs = Infinity;
    let maxMs = -Infinity;
    if (t.laps.length >= 2) {
      t.laps.forEach((l) => {
        if (l.lapMs < minMs) minMs = l.lapMs;
        if (l.lapMs > maxMs) maxMs = l.lapMs;
      });
    }

    el.lapsList.innerHTML = '';
    t.laps.forEach((lap) => {
      const row = document.createElement('div');
      row.className = 'lap-row';
      if (t.laps.length >= 2) {
        if (lap.lapMs === minMs) row.classList.add('fastest');
        else if (lap.lapMs === maxMs) row.classList.add('slowest');
      }

      const split = window.OdakTimer.formatTimeParts(lap.lapMs);
      const total = window.OdakTimer.formatTimeParts(lap.totalMs);

      row.innerHTML = `
        <span class="lap-num">#${lap.id}</span>
        <span class="lap-split">+${split.main}${split.ms}</span>
        <span class="lap-total">${total.main}${total.ms}</span>
      `;
      el.lapsList.appendChild(row);
    });
  }

  async function renderGallery() {
    const allBgs = window.OdakBackgrounds.getAll();
    const selected = new Set(state.background.selectedIds);
    el.bgGallery.innerHTML = '';

    allBgs.forEach((bg) => {
      const tile = document.createElement('div');
      tile.className = 'bg-tile' + (bg.id === state.background.activeId ? ' active' : '');

      if (bg.kind === 'canvas') {
        const div = document.createElement('div');
        div.className = 'bg-thumb-gradient';
        div.style.background = bg.thumbGradient;
        tile.appendChild(div);
      } else if (bg.kind === 'youtube' && bg.youtubeId) {
        const img = document.createElement('img');
        img.src = `https://img.youtube.com/vi/${bg.youtubeId}/hqdefault.jpg`;
        img.alt = bg.name;
        img.loading = 'lazy';
        tile.appendChild(img);
      } else if (bg.kind === 'video') {
        const vid = document.createElement('video');
        vid.src = bg.url;
        vid.muted = true;
        vid.playsInline = true;
        tile.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = bg.url;
        img.alt = bg.name;
        img.loading = 'lazy';
        tile.appendChild(img);
      }

      const checkBtn = document.createElement('button');
      checkBtn.className = 'bg-tile-check' + (selected.has(bg.id) ? ' checked' : '');
      checkBtn.title = 'Slayt gösterisine dahil et';
      checkBtn.textContent = selected.has(bg.id) ? '✓' : '';
      checkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selected.has(bg.id)) {
          if (state.background.selectedIds.length > 1) {
            state.background.selectedIds = state.background.selectedIds.filter((x) => x !== bg.id);
          } else {
            showToast(tr('toastMinOneBg'));
            return;
          }
        } else {
          state.background.selectedIds.push(bg.id);
        }
        persist();
        renderGallery();
      });
      tile.appendChild(checkBtn);

      if (bg.isCustom) {
        const delBtn = document.createElement('button');
        delBtn.className = 'bg-tile-del';
        delBtn.title = 'Önbellekten Sil';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.OdakBackgrounds.removeCustom(bg.id);
          state.background.selectedIds = state.background.selectedIds.filter((x) => x !== bg.id);
          if (state.background.activeId === bg.id) {
            state.background.activeId = 'canvas-aurora';
            window.OdakBackgrounds.apply(state.background.activeId);
          }
          persist();
          renderGallery();
          updateCacheUsage();
          showToast(tr('toastMediaDeleted'));
        });
        tile.appendChild(delBtn);
      } else {
        const badge = document.createElement('span');
        badge.className = 'bg-tile-badge';
        badge.textContent = bg.kind === 'canvas' ? tr('badgeLive') : tr('badgePhoto');
        tile.appendChild(badge);
      }

      const label = document.createElement('div');
      label.className = 'bg-tile-label';
      label.textContent = bg.name;
      tile.appendChild(label);

      tile.addEventListener('click', () => {
        state.background.activeId = bg.id;
        applyActiveBackground(bg.id);
        persist();
        renderGallery();
      });

      el.bgGallery.appendChild(tile);
    });
  }

  async function updateCacheUsage() {
    const bytes = await window.OdakDB.getCacheUsageBytes();
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    el.cacheUsageLabel.textContent = tr('cacheLabel', { mb });
  }

  function nextBackground() {
    const allIds = window.OdakBackgrounds.getAll().map((b) => b.id);
    const pool = state.background.selectedIds.filter((id) => allIds.includes(id));
    const list = pool.length > 0 ? pool : allIds;
    const idx = list.indexOf(state.background.activeId);
    const nextId = list[(idx + 1) % list.length];
    state.background.activeId = nextId;
    const bg = applyActiveBackground(nextId);
    persist();
    renderGallery();
    showToast(tr('toastBgChanged', { name: bg.name }));
  }

  function syncSlideshow() {
    clearInterval(slideshowTimer);
    const bg = state.background;
    el.toggleSlideshow.checked = bg.slideshow;
    el.selectSlideshowInterval.value = String(bg.intervalSec);
    el.slideshowIntervalWrap.classList.toggle('hidden', !bg.slideshow);
    el.slideshowStatus.classList.toggle('hidden', !bg.slideshow);

    if (bg.slideshow) {
      el.slideshowStatus.textContent = tr('slideshowActive', { sec: bg.intervalSec });
      slideshowTimer = setInterval(nextBackground, bg.intervalSec * 1000);
    }
  }

  function openDrawer(tabName) {
    el.drawer.classList.add('open');
    el.drawer.setAttribute('aria-hidden', 'false');
    el.drawerBackdrop.classList.remove('hidden');
    if (tabName) switchDrawerTab(tabName);
  }

  function closeDrawer() {
    el.drawer.classList.remove('open');
    el.drawer.setAttribute('aria-hidden', 'true');
    el.drawerBackdrop.classList.add('hidden');
  }

  function switchDrawerTab(name) {
    el.drawerTabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    Object.entries(el.tabPanes).forEach(([k, pane]) => {
      pane.classList.toggle('hidden', k !== name);
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        showToast(tr('toastFsBlocked'));
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function resetIdleTimer() {
    el.body.classList.remove('zen-idle');
    clearTimeout(idleTimer);
    if (state.design.zenMode) {
      idleTimer = setTimeout(() => {
        if (!el.drawer.classList.contains('open')) {
          el.body.classList.add('zen-idle');
        }
      }, 3500);
    }
  }

  function bindEvents() {
    el.startPauseBtn.addEventListener('click', () => {
      window.OdakAudio.playClick(640);
      if (state.timer.mode === 'countdown' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      timerEngine.toggle();
      renderTimerUI(timerEngine.getCurrentMs());
    });

    el.lapBtn.addEventListener('click', () => {
      const lap = timerEngine.addLap();
      if (lap) {
        window.OdakAudio.playClick(860);
        renderLaps();
      }
    });

    el.addMinBtn.addEventListener('click', () => {
      window.OdakAudio.playClick(760);
      timerEngine.addMinute();
    });

    el.resetBtn.addEventListener('click', () => {
      window.OdakAudio.playClick(460);
      timerEngine.reset();
    });

    el.modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        window.OdakAudio.playClick(700);
        timerEngine.setMode(btn.dataset.mode);
        syncClockLoop();
        renderTimerUI(timerEngine.getCurrentMs());
      });
    });

    el.chipBtns.forEach((chip) => {
      chip.addEventListener('click', () => {
        const mins = Number(chip.dataset.minutes);
        el.chipBtns.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        el.inputHours.value = Math.floor(mins / 60);
        el.inputMinutes.value = mins % 60;
        el.inputSeconds.value = 0;
        timerEngine.setCountdownDuration(mins * 60 * 1000);
        window.OdakAudio.playClick(720);
      });
    });

    el.btnApplyTime.addEventListener('click', () => {
      const h = Math.max(0, Number(el.inputHours.value) || 0);
      const m = Math.max(0, Number(el.inputMinutes.value) || 0);
      const s = Math.max(0, Number(el.inputSeconds.value) || 0);
      const totalMs = (h * 3600 + m * 60 + s) * 1000;
      if (totalMs <= 0) {
        showToast(tr('toastInvalidTime'));
        return;
      }
      timerEngine.setCountdownDuration(totalMs);
      showToast(tr('toastTimeUpdated'));
    });

    el.btnCopyLaps.addEventListener('click', () => {
      const lines = state.timer.laps.map((l) => {
        const sp = window.OdakTimer.formatTimeParts(l.lapMs);
        const tot = window.OdakTimer.formatTimeParts(l.totalMs);
        return `#${l.id} | ${tr('lap')}: ${sp.main}${sp.ms} | ${tot.main}${tot.ms}`;
      });
      navigator.clipboard?.writeText(lines.join('\n')).then(() => {
        showToast(tr('toastLapsCopied'));
      });
    });

    el.btnClearLaps.addEventListener('click', () => {
      timerEngine.clearLaps();
      renderLaps();
    });

    el.studyTaskInput.value = state.studyTask || '';
    el.studyTaskInput.addEventListener('input', (e) => {
      state.studyTask = e.target.value;
      persist();
    });

    el.focusQuote.addEventListener('click', () => {
      const quotes = window.OdakI18n.getQuotes(state.language);
      state.quoteIndex = (state.quoteIndex + 1) % quotes.length;
      persist();
      applyDesign();
    });

    [el.hudLangSelect, el.drawerLangSelect].forEach((sel) => {
      if (!sel) return;
      sel.addEventListener('change', (e) => {
        state.language = e.target.value;
        persist();
        applyLanguage();
      });
    });

    el.btnNextBg.addEventListener('click', () => {
      window.OdakAudio.playClick(740);
      nextBackground();
    });

    el.btnMute.addEventListener('click', () => {
      state.audio.enabled = !state.audio.enabled;
      persist();
      applyAudio();
      showToast(state.audio.enabled ? tr('toastSoundOn') : tr('toastSoundOff'));
    });

    el.btnCustomize.addEventListener('click', () => openDrawer());
    el.btnCloseDrawer.addEventListener('click', closeDrawer);
    el.drawerBackdrop.addEventListener('click', closeDrawer);
    el.drawerTabs.forEach((tab) => {
      tab.addEventListener('click', () => switchDrawerTab(tab.dataset.tab));
    });

    el.btnFullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
      const isFs = Boolean(document.fullscreenElement);
      el.iconFsEnter.classList.toggle('hidden', isFs);
      el.iconFsExit.classList.toggle('hidden', !isFs);
    });

    // Background Tab Controls
    el.sliderBlur.addEventListener('input', (e) => {
      state.background.blurPx = Number(e.target.value);
      applyDesign();
      persist();
    });

    el.sliderDim.addEventListener('input', (e) => {
      state.background.dimPct = Number(e.target.value);
      applyDesign();
      persist();
    });

    el.qualityOptions?.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.background.quality = btn.dataset.quality;
        persist();
        applyActiveBackground(state.background.activeId);
      });
    });

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    conn?.addEventListener?.('change', () => {
      if (state.background.quality === 'auto') {
        applyActiveBackground(state.background.activeId);
      }
    });

    el.toggleSlideshow.addEventListener('change', (e) => {
      state.background.slideshow = e.target.checked;
      persist();
      syncSlideshow();
    });

    el.selectSlideshowInterval.addEventListener('change', (e) => {
      state.background.intervalSec = Number(e.target.value);
      persist();
      syncSlideshow();
    });

    el.inputUploadMedia.addEventListener('change', async (e) => {
      if (!e.target.files?.length) return;
      const added = await window.OdakBackgrounds.addFiles(e.target.files);
      if (added.length > 0) {
        added.forEach((item) => {
          if (!state.background.selectedIds.includes(item.id)) {
            state.background.selectedIds.push(item.id);
          }
        });
        state.background.activeId = added[0].id;
        window.OdakBackgrounds.apply(added[0].id);
        persist();
        renderGallery();
        updateCacheUsage();
        showToast(tr('toastMediaSaved', { n: added.length }));
      }
      e.target.value = '';
    });

    el.btnAddUrl.addEventListener('click', async () => {
      const url = el.inputBgUrl.value.trim();
      if (!url) return;
      const item = await window.OdakBackgrounds.addUrl(url);
      if (item) {
        state.background.selectedIds.push(item.id);
        state.background.activeId = item.id;
        window.OdakBackgrounds.apply(item.id);
        el.inputBgUrl.value = '';
        persist();
        renderGallery();
        showToast(tr('toastUrlAdded'));
      }
    });

    // Design Tab Controls
    el.clockTypeOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.design.clockType = btn.dataset.clockType;
        persist();
        applyDesign();
      });
    });

    el.fontOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.design.font = btn.dataset.font;
        persist();
        applyDesign();
      });
    });

    el.sliderClockSize.addEventListener('input', (e) => {
      state.design.clockScale = Number(e.target.value);
      persist();
      applyDesign();
    });

    el.swatches.forEach((sw) => {
      sw.addEventListener('click', () => {
        state.design.accent = sw.dataset.color;
        persist();
        applyDesign();
      });
    });

    el.inputAccentColor.addEventListener('input', (e) => {
      state.design.accent = e.target.value;
      persist();
      applyDesign();
    });

    el.styleOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.design.cardStyle = btn.dataset.card;
        persist();
        applyDesign();
      });
    });

    el.toggleMs.addEventListener('change', (e) => {
      state.design.showMs = e.target.checked;
      persist();
      applyDesign();
    });
    el.toggleTask.addEventListener('change', (e) => {
      state.design.showTask = e.target.checked;
      persist();
      applyDesign();
    });
    el.toggleQuote.addEventListener('change', (e) => {
      state.design.showQuote = e.target.checked;
      persist();
      applyDesign();
    });
    el.toggleZen.addEventListener('change', (e) => {
      state.design.zenMode = e.target.checked;
      persist();
      applyDesign();
      resetIdleTimer();
    });
    el.toggleKeepAwake?.addEventListener('change', async (e) => {
      state.design.keepAwake = e.target.checked;
      persist();
      const ok = await syncWakeLock(true);
      if (!ok && state.design.keepAwake) {
        state.design.keepAwake = false;
        e.target.checked = false;
        persist();
      }
    });

    // Clock & World Time Controls
    el.searchPrimaryZone?.addEventListener('input', () => populateTimezoneSelects());
    el.searchSecondaryZone?.addEventListener('input', () => populateTimezoneSelects());
    el.selectPrimaryZone?.addEventListener('change', (e) => {
      state.clock.primaryZone = e.target.value;
      persist();
      renderTimerUI(timerEngine.getCurrentMs());
    });
    el.toggleDualZone?.addEventListener('change', (e) => {
      state.clock.dualEnabled = e.target.checked;
      persist();
      applyDesign();
      renderTimerUI(timerEngine.getCurrentMs());
    });
    el.selectSecondaryZone?.addEventListener('change', (e) => {
      state.clock.secondaryZone = e.target.value;
      persist();
      renderTimerUI(timerEngine.getCurrentMs());
    });
    el.toggleShowDate?.addEventListener('change', (e) => {
      state.clock.showDate = e.target.checked;
      persist();
      applyDesign();
      renderTimerUI(timerEngine.getCurrentMs());
    });
    el.selectDateFormat?.addEventListener('change', (e) => {
      state.clock.dateFormat = e.target.value;
      persist();
      renderTimerUI(timerEngine.getCurrentMs());
    });
    el.toggleHour24?.addEventListener('change', (e) => {
      state.clock.hour24 = e.target.checked;
      persist();
      renderTimerUI(timerEngine.getCurrentMs());
    });
    el.toggleClockSeconds?.addEventListener('change', (e) => {
      state.clock.showSeconds = e.target.checked;
      persist();
      renderTimerUI(timerEngine.getCurrentMs());
    });

    // Weather Controls
    el.toggleWeather?.addEventListener('change', (e) => {
      state.weather.enabled = e.target.checked;
      persist();
      applyDesign();
      if (state.weather.enabled) refreshWeather(false);
      else renderWeatherPill();
    });
    el.btnApplyWeather?.addEventListener('click', () => {
      state.weather.city = el.inputWeatherCity.value.trim();
      persist();
      refreshWeather(true);
    });
    el.inputWeatherCity?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.btnApplyWeather?.click();
      }
    });
    el.btnLocateWeather?.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast(tr('weatherError'));
        return;
      }
      if (el.weatherPill && el.weatherDesc) {
        el.weatherPill.classList.remove('hidden');
        el.weatherDesc.textContent = tr('weatherLoading');
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const data = await window.OdakWorld.fetchWeatherByCoords(
              pos.coords.latitude,
              pos.coords.longitude,
              ''
            );
            state.weather.cached = data;
            state.weather.city = data.city || '';
            if (el.inputWeatherCity) el.inputWeatherCity.value = state.weather.city;
            persist();
            renderWeatherPill();
          } catch (_) {
            showToast(tr('weatherError'));
          }
        },
        () => showToast(tr('weatherError'))
      );
    });
    el.selectWeatherUnit?.addEventListener('change', (e) => {
      state.weather.unit = e.target.value;
      persist();
      renderWeatherPill();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.design.keepAwake) {
        syncWakeLock(false);
      }
    });

    el.btnResetDesign.addEventListener('click', () => {
      state.design = structuredClone(DEFAULT_STATE.design);
      state.background.blurPx = DEFAULT_STATE.background.blurPx;
      state.background.dimPct = DEFAULT_STATE.background.dimPct;
      persist();
      applyDesign();
      showToast(tr('toastDesignReset'));
    });

    // Audio Tab Controls
    el.toggleSoundEnabled.addEventListener('change', (e) => {
      state.audio.enabled = e.target.checked;
      persist();
      applyAudio();
    });
    el.sliderVolume.addEventListener('input', (e) => {
      state.audio.volume = Number(e.target.value);
      persist();
      applyAudio();
    });
    el.selectAlarm.addEventListener('change', (e) => {
      state.audio.alarmPreset = e.target.value;
      persist();
      applyAudio();
    });
    el.btnTestAlarm.addEventListener('click', () => {
      window.OdakAudio.playAlarm(state.audio.alarmPreset);
    });
    el.toggleClicks.addEventListener('change', (e) => {
      state.audio.clicksEnabled = e.target.checked;
      persist();
      applyAudio();
    });
    el.selectAmbient.addEventListener('change', (e) => {
      state.audio.ambientMode = e.target.value;
      persist();
      applyAudio();
    });

    // Background Video Audio (Independent)
    el.toggleBgAudio?.addEventListener('change', (e) => {
      state.bgAudio.enabled = e.target.checked;
      persist();
      applyAudio();
    });
    el.sliderBgVolume?.addEventListener('input', (e) => {
      state.bgAudio.volume = Number(e.target.value);
      persist();
      applyAudio();
    });

    // Music Controls (Widget + Drawer)
    const toggleMusicPlay = () => {
      const activeItem = state.music.items.find((x) => x.id === state.music.activeId) || state.music.items[0];
      if (!window.OdakMusic.player.player && activeItem) {
        window.OdakMusic.player.load(activeItem, true);
      } else {
        window.OdakMusic.player.togglePlay();
      }
    };
    const toggleMusicLoop = () => {
      state.music.loop = !state.music.loop;
      window.OdakMusic.player.setLoop(state.music.loop);
      persist();
      syncMusicUI();
    };

    el.mwPlay?.addEventListener('click', toggleMusicPlay);
    el.drawerMusicPlay?.addEventListener('click', toggleMusicPlay);
    el.mwNext?.addEventListener('click', () => window.OdakMusic.player.next());
    el.drawerMusicNext?.addEventListener('click', () => window.OdakMusic.player.next());
    el.mwPrev?.addEventListener('click', () => window.OdakMusic.player.prev());
    el.drawerMusicPrev?.addEventListener('click', () => window.OdakMusic.player.prev());
    el.mwLoop?.addEventListener('click', toggleMusicLoop);
    el.drawerMusicLoop?.addEventListener('click', toggleMusicLoop);
    el.mwMute?.addEventListener('click', (e) => {
      e.stopPropagation();
      el.mwVolPopover?.classList.toggle('hidden');
    });
    el.mwVolPopover?.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => el.mwVolPopover?.classList.add('hidden'));
    el.mwVolSlider?.addEventListener('input', (e) => {
      state.music.volume = Number(e.target.value);
      if (state.music.volume > 0) state.music.enabled = true;
      persist();
      applyAudio();
    });
    el.mwVolToggleMute?.addEventListener('click', () => {
      state.music.enabled = !state.music.enabled;
      persist();
      applyAudio();
    });
    el.sliderMusicScale?.addEventListener('input', (e) => {
      state.music.scale = Number(e.target.value);
      persist();
      syncMusicUI();
    });

    el.toggleMusicWidget?.addEventListener('change', (e) => {
      state.music.showWidget = e.target.checked;
      persist();
      syncMusicUI();
    });
    el.toggleMusicKeys?.addEventListener('change', (e) => {
      state.music.shortcutsEnabled = e.target.checked;
      persist();
    });
    el.npMute?.addEventListener('click', () => {
      state.music.enabled = !state.music.enabled;
      persist();
      applyAudio();
    });
    el.sliderMusicVolume?.addEventListener('input', (e) => {
      state.music.volume = Number(e.target.value);
      persist();
      applyAudio();
    });

    el.btnAddMusic?.addEventListener('click', () => {
      const raw = el.inputMusicUrl.value.trim();
      if (!raw) return;
      const parsed = window.OdakMusic.parseYouTubeMusicUrl(raw);
      if (!parsed) {
        showToast(tr('toastMusicInvalid'));
        return;
      }
      const id = 'music-' + Date.now();
      const title =
        parsed.kind === 'playlist'
          ? `YouTube Playlist (${parsed.listId.slice(0, 8)}...)`
          : `YouTube (${parsed.videoId})`;
      const item = { id, title, ...parsed };
      state.music.items.unshift(item);
      state.music.activeId = id;
      expandedMusicId = id;
      el.inputMusicUrl.value = '';
      window.OdakMusic.player.currentTitle = '';
      window.OdakMusic.player.load(item, true);
      persist();
      renderMusicList();
      syncMusicUI();
      showToast(tr('toastMusicAdded'));
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (e.code === 'Space') {
        if (state.timer.mode !== 'clock') {
          e.preventDefault();
          el.startPauseBtn.click();
        }
      } else if (e.key === 'l' || e.key === 'L') {
        if (state.timer.mode === 'stopwatch') el.lapBtn.click();
      } else if (e.key === 'r' || e.key === 'R') {
        if (state.timer.mode !== 'clock') el.resetBtn.click();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        el.btnMute.click();
      } else if (e.key === 'b' || e.key === 'B') {
        nextBackground();
      } else if (e.key === 's' || e.key === 'S') {
        if (el.drawer.classList.contains('open')) closeDrawer();
        else openDrawer();
      } else if (state.music.shortcutsEnabled !== false && (e.key === 'p' || e.key === 'P')) {
        el.mwPlay?.click();
      } else if (state.music.shortcutsEnabled !== false && e.key === '[') {
        window.OdakMusic.player.prev();
      } else if (state.music.shortcutsEnabled !== false && e.key === ']') {
        window.OdakMusic.player.next();
      } else if (e.key === 'Escape') {
        closeDrawer();
      }
    });

    ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((evt) => {
      document.addEventListener(evt, resetIdleTimer, { passive: true });
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (el.btnInstall) el.btnInstall.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (el.btnInstall) el.btnInstall.classList.add('hidden');
    });

    el.btnDismissTimeup?.addEventListener('click', dismissTimeUp);
    el.btnRestartTimeup?.addEventListener('click', () => {
      dismissTimeUp();
      timerEngine.reset();
      timerEngine.start();
      renderTimerUI(timerEngine.getCurrentMs());
    });

    el.btnInstall?.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      el.btnInstall.classList.add('hidden');
    });
  }

  function initAnalogClockTicks() {
    if (!el.analogTicks || el.analogTicks.children.length > 0) return;
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 60; i++) {
      const isMajor = i % 5 === 0;
      const angle = (i * 6 * Math.PI) / 180;
      const rOuter = 100;
      const rInner = isMajor ? 88 : 94;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', (120 + rInner * Math.sin(angle)).toFixed(2));
      line.setAttribute('y1', (120 - rInner * Math.cos(angle)).toFixed(2));
      line.setAttribute('x2', (120 + rOuter * Math.sin(angle)).toFixed(2));
      line.setAttribute('y2', (120 - rOuter * Math.cos(angle)).toFixed(2));
      line.setAttribute('stroke-width', isMajor ? '2.5' : '1.2');
      line.setAttribute('class', isMajor ? 'analog-tick major' : 'analog-tick');
      el.analogTicks.appendChild(line);
    }
  }

  function dismissTimeUp() {
    clearInterval(alarmRepeatTimer);
    alarmRepeatTimer = null;
    el.timeupBanner?.classList.add('hidden');
    document.title = tr('pageTitle');
  }

  function showTimeUpAlert() {
    window.OdakAudio.playAlarm();
    let repeats = 0;
    clearInterval(alarmRepeatTimer);
    alarmRepeatTimer = setInterval(() => {
      repeats += 1;
      if (repeats >= 3) {
        clearInterval(alarmRepeatTimer);
        return;
      }
      window.OdakAudio.playAlarm();
    }, 3500);

    el.timeupBanner?.classList.remove('hidden');
    document.title = `⏰ ${tr('timeUpTitle')} — ${tr('pageTitleRunning')}`;

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const body = state.studyTask
          ? `${state.studyTask} — ${tr('toastTimeUp')}`
          : tr('toastTimeUp');
        new Notification(tr('timeUpTitle'), {
          body,
          icon: 'assets/icon-192.png',
        });
      } catch (_) {}
    }
  }

  async function syncWakeLock(showFeedback = false) {
    if (!state.design.keepAwake) {
      if (wakeLockSentinel) {
        try {
          await wakeLockSentinel.release();
        } catch (_) {}
        wakeLockSentinel = null;
      }
      if (showFeedback) showToast(tr('toastWakeOff'));
      return true;
    }
    if (!('wakeLock' in navigator)) {
      if (showFeedback) showToast(tr('toastWakeUnsupported'));
      return false;
    }
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      if (showFeedback) showToast(tr('toastWakeOn'));
      return true;
    } catch (_) {
      if (showFeedback) showToast(tr('toastWakeUnsupported'));
      return false;
    }
  }

  function renderWeatherPill() {
    if (!el.weatherPill) return;
    const w = state.weather;
    if (!w.enabled || !window.OdakWorld) {
      el.weatherPill.classList.add('hidden');
      return;
    }
    el.weatherPill.classList.remove('hidden');
    const c = w.cached;
    if (!c) {
      if (el.weatherTemp) el.weatherTemp.textContent = '--°';
      if (el.weatherDesc) el.weatherDesc.textContent = tr('weatherLoading');
      if (el.weatherCity) el.weatherCity.textContent = '';
      if (el.weatherIcon) el.weatherIcon.innerHTML = window.OdakWorld.getWeatherSvg('cloud');
      return;
    }
    const isF = w.unit === 'f';
    const tempVal = isF ? Math.round((c.tempC * 9) / 5 + 32) : c.tempC;
    if (el.weatherTemp) el.weatherTemp.textContent = `${tempVal}°${isF ? 'F' : 'C'}`;
    if (el.weatherDesc) el.weatherDesc.textContent = tr(c.codeKey);
    if (el.weatherCity) el.weatherCity.textContent = c.city ? `· ${c.city}` : '';
    if (el.weatherIcon) el.weatherIcon.innerHTML = window.OdakWorld.getWeatherSvg(c.icon);
  }

  async function refreshWeather(force = false) {
    if (!state.weather.enabled || !window.OdakWorld) return;
    const cached = state.weather.cached;
    const fresh = cached && Date.now() - cached.fetchedAt < 15 * 60 * 1000;
    if (!force && fresh) {
      renderWeatherPill();
      return;
    }
    renderWeatherPill();
    try {
      const data = await window.OdakWorld.fetchWeatherByCity(state.weather.city);
      state.weather.cached = data;
      persist();
      renderWeatherPill();
    } catch (_) {
      if (el.weatherDesc) el.weatherDesc.textContent = tr('weatherError');
    }
  }

  async function init() {
    initAnalogClockTicks();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    await window.OdakBackgrounds.init();
    applyActiveBackground(state.background.activeId);

    timerEngine = new window.OdakTimer.TimerEngine(
      state,
      persist,
      (currentMs) => renderTimerUI(currentMs),
      () => {
        renderTimerUI(0);
        showTimeUpAlert();
      }
    );

    applyDesign();
    applyAudio();
    applyLanguage();
    syncClockLoop();
    if (state.design.keepAwake) syncWakeLock(false);
    if (state.weather.enabled) refreshWeather(false);
    window.OdakMusic.player.onStateChange = syncMusicUI;
    window.OdakMusic.player.setLoop(state.music.loop);
    const activeMusic = state.music.items.find((x) => x.id === state.music.activeId) || state.music.items[0];
    if (activeMusic) {
      window.OdakMusic.player.load(activeMusic, false);
    }
    renderMusicList();
    syncMusicUI();
    bindEvents();
    timerEngine.resumeIfRunning();
    resetIdleTimer();
  }

  init();
})();
