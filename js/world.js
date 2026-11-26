(function (global) {
  'use strict';

  const FALLBACK_ZONES = [
    'Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid',
    'Europe/Rome', 'Europe/Amsterdam', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Athens',
    'Europe/Moscow', 'Europe/Warsaw', 'Europe/Stockholm', 'Europe/Bucharest', 'Europe/Kiev',
    'Asia/Baku', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Jerusalem', 'Asia/Tehran',
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore',
    'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Seoul', 'Asia/Tokyo', 'Australia/Sydney',
    'Australia/Melbourne', 'Pacific/Auckland', 'Africa/Cairo', 'Africa/Johannesburg',
    'Africa/Casablanca', 'America/New_York', 'America/Toronto', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles', 'America/Mexico_City', 'America/Sao_Paulo',
    'America/Buenos_Aires', 'UTC',
  ];

  function getOffsetLabel(timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
      }).formatToParts(new Date());
      const tzPart = parts.find((p) => p.type === 'timeZoneName');
      return tzPart ? tzPart.value.replace('GMT', 'UTC') : '';
    } catch (_) {
      return '';
    }
  }

  function buildTimeZones() {
    let rawList = [];
    try {
      if (typeof Intl.supportedValuesOf === 'function') {
        rawList = Intl.supportedValuesOf('timeZone');
      }
    } catch (_) {}
    if (!rawList || rawList.length === 0) {
      rawList = FALLBACK_ZONES;
    }
    const items = rawList.map((id) => {
      const parts = id.split('/');
      const city = parts[parts.length - 1].replace(/_/g, ' ');
      const region = parts.length > 1 ? parts[0] : '';
      const offset = getOffsetLabel(id);
      const label = region
        ? `${city} — ${region} (${offset || id})`
        : `${city} (${offset || id})`;
      return { id, city, region, label };
    });
    items.sort((a, b) => a.city.localeCompare(b.city));
    return [{ id: 'auto', city: 'Auto', region: '', label: 'Auto (Local)' }, ...items];
  }

  const TIMEZONES = buildTimeZones();

  const LOCALE_MAP = {
    tr: 'tr-TR',
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    pt: 'pt-BR',
    it: 'it-IT',
    nl: 'nl-NL',
    ru: 'ru-RU',
    ar: 'ar-SA',
    hi: 'hi-IN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    zh: 'zh-CN',
  };

  function getLocalTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (_) {
      return 'UTC';
    }
  }

  function resolveTimeZone(tzId) {
    if (!tzId || tzId === 'auto') return getLocalTimeZone();
    return tzId;
  }

  function getZoneShortName(tzId, autoLabel) {
    if (!tzId || tzId === 'auto') {
      const local = getLocalTimeZone();
      const city = local.split('/').pop().replace(/_/g, ' ');
      return autoLabel ? `${city}` : city;
    }
    const found = TIMEZONES.find((z) => z.id === tzId);
    if (found && found.city) return found.city;
    return tzId.split('/').pop().replace(/_/g, ' ');
  }

  function getTimePartsForZone(date, tzId, { hour12 = false, showSeconds = true } = {}) {
    const timeZone = resolveTimeZone(tzId);
    let h = 0,
      m = 0,
      s = 0,
      dayPeriod = '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12,
      }).formatToParts(date);
      for (const p of parts) {
        if (p.type === 'hour') h = Number(p.value);
        if (p.type === 'minute') m = Number(p.value);
        if (p.type === 'second') s = Number(p.value);
        if (p.type === 'dayPeriod') dayPeriod = p.value;
      }
    } catch (_) {
      h = date.getHours();
      m = date.getMinutes();
      s = date.getSeconds();
    }

    const pad = (n) => String(n).padStart(2, '0');
    const main = showSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
    const suffix = hour12 && dayPeriod ? ` ${dayPeriod}` : '';

    // 24h numeric values for analog clock hands
    let h24 = h;
    if (hour12) {
      const p24 = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        hour12: false,
      }).format(date);
      h24 = Number(p24) % 24;
    }

    return {
      main,
      suffix,
      hours: h24,
      minutes: m,
      seconds: s,
    };
  }

  function formatDateForZone(date, tzId, lang, formatStyle = 'long') {
    const timeZone = resolveTimeZone(tzId);
    const locale = LOCALE_MAP[lang] || 'en-US';
    let opts;
    if (formatStyle === 'short') {
      opts = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' };
    } else if (formatStyle === 'compact') {
      opts = { timeZone, weekday: 'short', day: 'numeric', month: 'short' };
    } else {
      opts = { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    }
    try {
      return new Intl.DateTimeFormat(locale, opts).format(date);
    } catch (_) {
      return date.toDateString();
    }
  }

  function mapWeatherCode(code) {
    if (code === 0) return { key: 'wClear', icon: 'sun' };
    if (code === 1 || code === 2) return { key: 'wPartlyCloudy', icon: 'partly' };
    if (code === 3) return { key: 'wCloudy', icon: 'cloud' };
    if (code === 45 || code === 48) return { key: 'wFog', icon: 'fog' };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { key: 'wRain', icon: 'rain' };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { key: 'wSnow', icon: 'snow' };
    if (code >= 95) return { key: 'wStorm', icon: 'storm' };
    return { key: 'wCloudy', icon: 'cloud' };
  }

  function getWeatherSvg(icon) {
    const svgs = {
      sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
      partly: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>',
      cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
      fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 17H7M17 21H9"/></svg>',
      rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6M8 14v6M12 16v6"/></svg>',
      snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/></svg>',
      storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>',
    };
    return svgs[icon] || svgs.cloud;
  }

  async function fetchWeatherByCoords(lat, lon, cityLabel) {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
    );
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    const cur = data.current || {};
    const mapped = mapWeatherCode(cur.weather_code);
    return {
      tempC: Math.round(cur.temperature_2m),
      codeKey: mapped.key,
      icon: mapped.icon,
      city: cityLabel || (data.timezone ? data.timezone.split('/').pop().replace(/_/g, ' ') : ''),
      lat,
      lon,
      fetchedAt: Date.now(),
    };
  }

  async function fetchWeatherByCity(cityQuery) {
    const clean = (cityQuery || '').trim();
    if (!clean) {
      // Fallback to local timezone city name if no city specified
      const tzCity = getLocalTimeZone().split('/').pop().replace(/_/g, ' ');
      return fetchWeatherByCity(tzCity || 'Istanbul');
    }
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=1&language=en&format=json`
    );
    if (!geoRes.ok) throw new Error('Geocoding failed');
    const geo = await geoRes.json();
    const hit = geo.results && geo.results[0];
    if (!hit) throw new Error('City not found');
    return fetchWeatherByCoords(hit.latitude, hit.longitude, hit.name);
  }

  global.OdakWorld = {
    TIMEZONES,
    getLocalTimeZone,
    resolveTimeZone,
    getZoneShortName,
    getTimePartsForZone,
    formatDateForZone,
    getWeatherSvg,
    fetchWeatherByCoords,
    fetchWeatherByCity,
  };
})(window);
