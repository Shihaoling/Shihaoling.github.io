const storageKey = 'haoling-theme';

export function initTheme() {
  const root = document.documentElement;
  const toggle = document.querySelector('#theme-toggle');
  const label = toggle.querySelector('.theme-label');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let manualChoice = false;

  try {
    manualChoice = ['light', 'dark'].includes(localStorage.getItem(storageKey));
  } catch { /* The switch still works when storage is unavailable. */ }

  function setTheme(mode, save = false) {
    const dark = mode === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? '切换至日间模式' : '切换至夜间模式');
    label.textContent = dark ? '夜间' : '日间';
    themeColor?.setAttribute('content', dark ? '#142330' : '#e6f0f4');
    if (save) {
      manualChoice = true;
      try { localStorage.setItem(storageKey, root.dataset.theme); } catch { /* Keep the current page theme. */ }
    }
  }

  setTheme(root.dataset.theme || (systemTheme.matches ? 'dark' : 'light'));
  toggle.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
  systemTheme.addEventListener('change', event => {
    if (!manualChoice) setTheme(event.matches ? 'dark' : 'light');
  });
}
