// Small, visitor-triggered moments. No perpetual animation or extra assets.
export function initSeaside() {
  const root = document.documentElement;
  const hero = document.querySelector('#home');
  const scene = document.querySelector('.seaside');
  if (!scene) return;
  const water = scene.querySelector('.seaside-water');
  const lane = scene.querySelector('.boat-lane');
  const sky = scene.querySelector('.seaside-sky');
  const skyButton = scene.querySelector('.sky-touch');
  const boatButton = scene.querySelector('.launch-boat');
  const status = scene.querySelector('#seaside-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const timers = new Set();
  let windFrame = 0;
  let windTimer = 0;
  let wind = 0;
  let boatNumber = 0;
  let skyNumber = 0;

  const later = (fn, delay) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, delay);
    timers.add(id);
    return id;
  };
  const isNight = () => root.dataset.theme === 'dark';
  function updateTheme() {
    scene.querySelector('#seaside-time').textContent = isNight() ? '入夜' : '白天';
    skyButton.setAttribute('aria-label', isNight() ? '点点月亮，看一颗流星' : '点点太阳，看看海鸥');
  }
  function resetWind() {
    clearTimeout(windTimer);
    cancelAnimationFrame(windFrame);
    windFrame = 0;
    water.style.setProperty('--wind', '0px');
    water.classList.remove('is-stirred');
  }
  function clearMoments() {
    timers.forEach(clearTimeout);
    timers.clear();
    lane.replaceChildren();
    sky.replaceChildren();
    skyButton.classList.remove('is-awake');
    boatButton.setAttribute('aria-disabled', 'false');
    resetWind();
  }
  function addMoment(parent, className, markup, duration) {
    const el = document.createElement('span');
    el.className = className;
    el.innerHTML = markup;
    parent.append(el);
    later(() => el.remove(), duration);
    return el;
  }
  const boatArt = '<svg viewBox="0 0 100 64" fill="none"><path d="M8 35 50 4l42 31-20 23H29Z" fill="#f6f3e6" stroke="#5a8292" stroke-width="1.2"/><path d="m8 35 42 13 42-13M50 4v44M30 19h40" stroke="#7e9da9" stroke-width="1.1"/><path d="m29 58 21-10 22 10" fill="#b9d3d6"/><path d="M0 62h30m39 0h30" stroke="#e3f3f4" stroke-width="1.4" stroke-linecap="round"/></svg>';
  boatButton.addEventListener('click', () => {
    if (boatButton.getAttribute('aria-disabled') === 'true') return;
    // A short cooldown and a two-boat cap keep repeated taps inexpensive.
    boatButton.setAttribute('aria-disabled', 'true');
    later(() => boatButton.setAttribute('aria-disabled', 'false'), 800);
    if (lane.children.length >= 2) lane.firstElementChild.remove();
    boatNumber++;
    const boat = addMoment(lane, `paper-boat${reduced.matches ? ' is-still' : ''}`, `<span class="boat-rock">${boatArt}</span><span class="boat-wake"></span>`, reduced.matches ? 5000 : 7400);
    boat.style.setProperty('--boat-offset', boatNumber % 2 ? '0px' : '18px');
    status.textContent = boatNumber % 3 === 0 ? '又一只小船出发了。' : isNight() ? '小船借着月光出发了。' : '小船出发了，顺风。';
  });

  skyButton.addEventListener('click', () => {
    if (sky.children.length) return;
    skyNumber++;
    skyButton.classList.add('is-awake');
    later(() => skyButton.classList.remove('is-awake'), 1800);
    if (isNight()) {
      const stars = reduced.matches
        ? '<svg viewBox="0 0 300 120"><g fill="#f4f5dc"><path d="m145 32 3 11 11 3-11 3-3 11-3-11-11-3 11-3Z"/><circle cx="73" cy="31" r="1.6"/><circle cx="226" cy="68" r="2"/></g></svg>'
        : '<i></i><i></i>';
      addMoment(sky, `meteor-shower${reduced.matches ? ' is-still' : ''}`, stars, 3600);
      status.textContent = skyNumber % 3 === 0 ? '这颗流星，也刚好被你看到了。' : reduced.matches ? '月亮旁边，多了几颗星星。' : '刚好，一颗流星。';
    } else {
      addMoment(sky, `seabirds${reduced.matches ? ' is-still' : ''}`, '<svg viewBox="0 0 180 70" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 28q12-12 24 0 12-12 24 0"/><path d="M81 18q9-9 18 0 9-9 18 0"/><path d="M119 49q10-10 20 0 10-10 20 0"/></svg>', 4200);
      status.textContent = '海鸥路过，打了个招呼。';
    }
  });

  // A hint of breeze in the water, restricted to the scenic area.
  scene.addEventListener('pointermove', event => {
    if (!fine.matches || reduced.matches) return;
    const rect = scene.getBoundingClientRect();
    wind = ((event.clientX - rect.left) / rect.width - .5) * 16;
    if (!windFrame) windFrame = requestAnimationFrame(() => {
      water.style.setProperty('--wind', `${wind.toFixed(1)}px`);
      water.classList.add('is-stirred');
      windFrame = 0;
    });
    clearTimeout(windTimer);
    windTimer = setTimeout(resetWind, 1200);
  }, { passive: true });
  scene.addEventListener('pointerleave', resetWind);
  window.addEventListener('blur', clearMoments);
  window.addEventListener('pagehide', clearMoments);
  window.addEventListener('hashchange', clearMoments);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearMoments(); });
  reduced.addEventListener('change', clearMoments);
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) clearMoments();
  });
  observer.observe(hero);
  let currentTheme = root.dataset.theme;
  new MutationObserver(() => {
    if (root.dataset.theme === currentTheme) return;
    currentTheme = root.dataset.theme;
    clearMoments();
    updateTheme();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  scene.hidden = false;
  hero.classList.add('has-seaside');
  // Let the photograph and its little boats share one scrolling coordinate
  // space, so a boat never drifts above a fixed horizon while reading.
  const fitSea = () => root.style.setProperty('--seaside-height', `${hero.offsetTop + hero.offsetHeight}px`);
  new ResizeObserver(fitSea).observe(hero);
  fitSea();
  updateTheme();
}
