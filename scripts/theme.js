const overrideKey = 'haoling-theme-override-v2';

export function automaticThemeAt(now = new Date()) {
  const hour = now.getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

export function nextThemeBoundary(now = new Date()) {
  const next = new Date(now);
  const hour = now.getHours();
  if (hour < 6) next.setHours(6, 0, 0, 0);
  else if (hour < 18) next.setHours(18, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }
  return next;
}

export function initTheme() {
  const root = document.documentElement;
  const toggle = document.querySelector('#theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let timer;
  let memoryOverride = null;

  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || '';

  function readOverride(now) {
    let saved = memoryOverride;
    try {
      const stored = localStorage.getItem(overrideKey);
      if (stored) saved = JSON.parse(stored);
    } catch { /* Keep an in-memory choice. */ }
    if (!saved) return null;
    if ((saved?.mode === 'light' || saved?.mode === 'dark') && saved.until > now.getTime() && saved.zone === timeZone()) return saved.mode;
    memoryOverride = null;
    try { localStorage.removeItem(overrideKey); } catch { /* Storage can be unavailable. */ }
    return null;
  }

  function showTheme(mode) {
    const dark = mode === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    toggle.setAttribute('aria-pressed', String(dark));
    themeColor?.setAttribute('content', dark ? '#142330' : '#e6f0f4');
  }

  function syncTheme() {
    const now = new Date();
    showTheme(readOverride(now) || automaticThemeAt(now));
    clearTimeout(timer);
    timer = setTimeout(syncTheme, Math.max(1000, nextThemeBoundary(now).getTime() - now.getTime() + 100));
  }

  toggle.addEventListener('click', () => {
    const now = new Date();
    const mode = root.dataset.theme === 'dark' ? 'light' : 'dark';
    memoryOverride = { mode, until: nextThemeBoundary(now).getTime(), zone: timeZone() };
    try { localStorage.setItem(overrideKey, JSON.stringify(memoryOverride)); } catch { /* The choice still lasts until the next boundary in this tab. */ }
    showTheme(mode);
    syncTheme();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncTheme(); });
  window.addEventListener('pageshow', syncTheme);
  window.addEventListener('storage', event => { if (event.key === overrideKey) { memoryOverride = null; syncTheme(); } });
  setInterval(syncTheme, 60_000);
  syncTheme();
}
