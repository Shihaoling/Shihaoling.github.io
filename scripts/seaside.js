import { createOceanRenderer, sampleWave, getCelestialCycle } from './ocean-renderer.js?v=20261111-reflections';
import { createSkyEvent } from './sky-effects.js?v=20261111-moonlight';
import { spaceBoats } from './boat-spacing.js?v=20261111-moonlight';

// The water, light and boats are painted together in one coordinate system.
export function initSeaside() {
  const root = document.documentElement;
  const hero = document.querySelector('#home');
  const scene = document.querySelector('.seaside');
  const ocean = document.querySelector('.ocean-scene');
  if (!scene || !ocean) return;
  const skyButton = scene.querySelector('.sky-touch');
  const boatButton = scene.querySelector('.launch-boat');
  const motionButton = scene.querySelector('.sea-motion');
  const status = scene.querySelector('#seaside-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const canvas = document.createElement('canvas');
  canvas.className = 'painted-ocean';
  canvas.setAttribute('aria-hidden', 'true');
  let painter;
  try { painter = createOceanRenderer(canvas); } catch { return; }
  if (!painter) return;
  ocean.append(canvas);
  scene.hidden = false;
  hero.classList.add('has-seaside');
  const boats = [{ id: 0, born: 0, resting: true, dx: 0, dy: 0, vx: 0, vy: 0, tilt: 0 }];
  let nextBoat = 1;
  let layout;
  let pointer = null;
  let skyEvent = null;
  let skyClearTimer = 0;
  let skyCooldownUntil = 0;
  const boatLifetime = 30;
  let paused = false;
  let motionSpeed = reduced.matches ? 0 : 1;
  let motionJourney = null;
  let visible = true;
  let focused = true;
  let frame = 0;
  let lastStamp = 0;
  let time = 0;
  let currentTheme = root.dataset.theme;
  let targetNight = currentTheme === 'dark' ? 1 : 0;
  let night = targetNight;
  let themeJourney = null;
  let cooldownUntil = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const canAnimate = () => !reduced.matches && (!paused || motionSpeed > 0 || !!motionJourney);
  const canRun = () => visible && focused && !document.hidden;
  const hasAnimatedSky = () => !!skyEvent && !skyEvent.staticPreview && !reduced.matches;
  const needsFrame = () => canAnimate() || hasAnimatedSky() || night !== targetNight;
  function updateLabels() {
    const isNight = targetNight === 1;
    scene.querySelector('#seaside-time').textContent = isNight ? '入夜' : '白天';
    skyButton.setAttribute('aria-label', isNight ? '点一下月亮，看流星与星光海面' : '点一下太阳，看海鸥掠过与波光');
    motionButton.setAttribute('aria-pressed', String(paused || reduced.matches));
    motionButton.setAttribute('aria-label', reduced.matches ? '已按系统偏好减少动态效果' : paused ? '恢复海面动画' : '暂停海面动画');
    motionButton.setAttribute('aria-disabled', String(reduced.matches));
    motionButton.querySelector('.sea-motion-label').textContent = reduced.matches ? '静态海面' : paused ? (motionJourney ? '缓缓停下' : '恢复动态') : '暂停海面';
    motionButton.firstElementChild.textContent = paused || reduced.matches ? '▷' : 'Ⅱ';
  }
  function measure() {
    root.style.setProperty('--seaside-height', `${hero.offsetTop + hero.offsetHeight}px`);
    const oceanRect = ocean.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const skyRect = skyButton.getBoundingClientRect();
    const dockRect = scene.querySelector('.seaside-dock').getBoundingClientRect();
    const mobile = innerWidth <= 800;
    const horizon = sceneRect.top - oceanRect.top + sceneRect.height * (mobile ? .34 : .41);
    layout = {
      width: oceanRect.width, height: oceanRect.height, horizon,
      left: sceneRect.left - oceanRect.left, widthOfScene: sceneRect.width,
      sceneBounds: { left: sceneRect.left - oceanRect.left, width: sceneRect.width, top: sceneRect.top - oceanRect.top, bottom: dockRect.top - oceanRect.top },
      waterline: horizon + Math.max(38, (dockRect.top - oceanRect.top - horizon) * .54),
      celestial: { x: skyRect.left - oceanRect.left + skyRect.width / 2, y: skyRect.top - oceanRect.top + (mobile ? 28 : 38), radius: mobile ? 20 : 28 },
      scale: clamp(sceneRect.width / 395, .72, 1.08),
    };
    painter.resize(layout.width, layout.height, Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.5 : 2));
    render(0);
    schedule();
  }
  function boatPos(boat) {
    const age = time - boat.born;
    const drift = clamp(age / boatLifetime, 0, 1) * .16;
    const fraction = boat.resting ? .45 + Math.sin(time * .26) * .10 : boat.side === 'left' ? .13 + drift : .87 - drift;
    return { x: layout.left + layout.widthOfScene * fraction, y: layout.waterline + (boat.resting ? 0 : 12 + (boat.id % 2) * 12), age };
  }
  function render(dt) {
    if (!layout) return;
    const animated = canAnimate();
    const drawn = spaceBoats(boats.map(boat => {
      const p = boatPos(boat);
      const wave = sampleWave(p.x, p.y, time, layout.horizon, layout.height);
      let targetX = 0, targetY = 0, targetTilt = 0;
      if (pointer && animated && !paused) {
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        const strength = Math.pow(Math.max(0, 1 - distance / 135), 2);
        targetX = (dx / Math.max(18, distance)) * strength * 22;
        targetY = (dy / Math.max(18, distance)) * strength * 5;
        targetTilt = (dx / Math.max(18, distance)) * strength * .12;
      }
      // A damped spring gives the boat a little inertia, never a cursor lock.
      if (dt > 0 && animated) {
        boat.vx = (boat.vx + (targetX - boat.dx) * 16 * dt) * Math.exp(-6 * dt);
        boat.vy = (boat.vy + (targetY - boat.dy) * 16 * dt) * Math.exp(-6 * dt);
        boat.dx += boat.vx * dt;
        boat.dy += boat.vy * dt;
        boat.tilt += (targetTilt - boat.tilt) * Math.min(1, dt * 3);
      }
      return {
        side: boat.side, x: p.x + boat.dx, y: p.y + wave.lift + boat.dy,
        scale: layout.scale * (boat.resting ? 1 : .83),
        roll: wave.roll + boat.tilt,
        opacity: boat.resting ? 1 : clamp(Math.min(p.age / 1.2, (boatLifetime - p.age) / 3), 0, 1), phase: boat.id * 2,
      };
    }), layout.left, layout.widthOfScene);
    const skyProgress = skyEvent ? clamp(skyEvent.elapsed / skyEvent.duration, 0, 1) : 0;
    painter.render({ time, night, horizon: layout.horizon, celestial: layout.celestial, sceneBounds: layout.sceneBounds, boats: drawn, skyEvent: skyEvent ? { ...skyEvent, progress: skyProgress } : null });
    // DOM-facing state also makes lifecycle and interaction regression checks possible.
    canvas.dataset.boats = String(drawn.length);
    const orderedBoats = [...drawn].sort((a, b) => a.x - b.x);
    canvas.dataset.boatGap = drawn.length > 1 ? Math.min(...orderedBoats.slice(1).map((boat, i) => boat.x - orderedBoats[i].x - 42 * (boat.scale + orderedBoats[i].scale))).toFixed(1) : '';
    canvas.dataset.boatPositions = drawn.map(b => `${b.x.toFixed(1)},${b.y.toFixed(1)}`).join(';');
    const occupied = boats.length >= 3;
    boatButton.setAttribute('aria-disabled', String(occupied));
    const launchLabel = boatButton.querySelector('.launch-boat-label');
    if (launchLabel) launchLabel.textContent = occupied ? '小船漂流中' : boats.length === 2 ? '再放一只纸船' : '放一只纸船';
    canvas.dataset.motion = animated && canRun() ? (paused ? 'slowing' : motionJourney ? 'resuming' : 'running') : 'still';
    canvas.dataset.motionSpeed = motionSpeed.toFixed(4);
    canvas.dataset.reaction = String(drawn.some((_, i) => Math.abs(boats[i].dx) > .2 || Math.abs(boats[i].tilt) > .003));
    canvas.dataset.frame = String(Math.round(time * 30));
    canvas.dataset.sky = skyEvent?.kind || '';
    canvas.dataset.skyVisitors = skyEvent ? String(skyEvent.birds?.length || skyEvent.meteors?.length || 0) : '';
    canvas.dataset.skyPattern = skyEvent?.patternId || '';
    canvas.dataset.constellations = String(skyEvent?.constellations?.length || 0);
    canvas.dataset.skyProgress = skyEvent ? skyProgress.toFixed(3) : '';
    scene.classList.toggle('is-playing', !!skyEvent);
    const cycle = getCelestialCycle(night, layout.horizon, layout.celestial, layout.width);
    canvas.dataset.phase = night.toFixed(4);
    canvas.dataset.sunY = cycle.sun.y.toFixed(1);
    canvas.dataset.moonY = cycle.moon.y.toFixed(1);
    canvas.dataset.stars = cycle.stars.toFixed(3);
    const changing = night !== targetNight;
    scene.classList.toggle('is-changing', changing);
    skyButton.disabled = changing;
    scene.querySelector('#seaside-time').textContent = changing ? (targetNight ? '日落 · 月升' : '月落 · 日出') : (targetNight ? '入夜' : '白天');
    if (drawn[0]) { canvas.dataset.boatX = drawn[0].x.toFixed(1); canvas.dataset.boatY = drawn[0].y.toFixed(1); canvas.dataset.boatRoll = drawn[0].roll.toFixed(3); }
  }
  function tick(stamp) {
    frame = 0;
    if (!canRun()) { lastStamp = 0; return; }
    if (lastStamp && stamp - lastStamp < 32) { schedule(); return; }
    const dt = lastStamp ? Math.min(.05, (stamp - lastStamp) / 1000) : 1 / 30;
    lastStamp = stamp;
    const previousSpeed = motionSpeed;
    if (motionJourney) {
      motionJourney.elapsed += dt;
      const progress = Math.min(1, motionJourney.elapsed / motionJourney.duration);
      const eased = progress * progress * (3 - 2 * progress);
      motionSpeed = motionJourney.from + (motionJourney.to - motionJourney.from) * eased;
      if (progress === 1) {
        motionSpeed = motionJourney.to; motionJourney = null;
        updateLabels(); armStaticSkyExpiry();
      }
    }
    // Waves, wakes and boats share an eased clock. A requested sky animation
    // has its own clock so pausing the sea never strands a flock mid-flight.
    const motionDt = reduced.matches ? 0 : dt * (previousSpeed + motionSpeed) / 2;
    if (motionDt > 0) {
      time += motionDt;
      for (let i = boats.length - 1; i > 0; i--) if (time - boats[i].born >= boatLifetime) boats.splice(i, 1);
    }
    if (hasAnimatedSky()) {
      skyEvent.elapsed += dt;
      if (skyEvent.elapsed >= skyEvent.duration) clearSky();
    }
    if (reduced.matches) { night = targetNight; themeJourney = null; }
    else if (themeJourney) {
      themeJourney.elapsed += dt;
      const progress = Math.min(1, themeJourney.elapsed / themeJourney.duration);
      const eased = progress * progress * (3 - 2 * progress);
      night = themeJourney.from + (targetNight - themeJourney.from) * eased;
      if (progress === 1) { night = targetNight; themeJourney = null; }
    }
    render(motionDt);
    if (needsFrame()) schedule();
    else lastStamp = 0;
  }
  function schedule() {
    if (!frame && canRun() && needsFrame()) frame = requestAnimationFrame(tick);
  }
  function armStaticSkyExpiry() {
    clearTimeout(skyClearTimer); skyClearTimer = 0;
    // Only the reduced-motion preview is static; ordinary sky events always
    // finish on their own animation clock, including when the sea is paused.
    if (skyEvent?.staticPreview && canRun()) skyClearTimer = setTimeout(() => { clearSky(); render(0); }, (skyEvent.duration + .3) * 1000);
  }
  function clearSky() {
    clearTimeout(skyClearTimer); skyClearTimer = 0; skyEvent = null;
  }
  function suspend() {
    cancelAnimationFrame(frame); frame = 0; lastStamp = 0; pointer = null;
    clearTimeout(skyClearTimer); skyClearTimer = 0;
    render(0);
  }
  function resume() {
    focused = true;
    armStaticSkyExpiry(); render(0); schedule();
  }
  function stop() {
    cancelAnimationFrame(frame); frame = 0; lastStamp = 0; pointer = null;
    motionJourney = null; motionSpeed = paused || reduced.matches ? 0 : 1;
    night = targetNight; themeJourney = null;
    clearSky();
    // Retain the resting boat; clear temporary boats when leaving the scene.
    boats.splice(1);
    boats[0].dx = boats[0].dy = boats[0].vx = boats[0].vy = boats[0].tilt = 0;
    updateLabels(); render(0);
  }
  boatButton.addEventListener('click', () => {
    const now = performance.now();
    const inBurst = now < cooldownUntil;
    cooldownUntil = now + 1200;
    if (inBurst || boats.length >= 3) return;
    const main = boatPos(boats[0]);
    const preferred = main.x < layout.left + layout.widthOfScene * .5 ? 'right' : 'left';
    const side = boats.some(boat => boat.side === preferred) ? (preferred === 'right' ? 'left' : 'right') : preferred;
    boats.push({ id: nextBoat++, side, born: time - (canAnimate() ? 0 : 1.2), resting: false, dx: 0, dy: 0, vx: 0, vy: 0, tilt: 0 });
    status.textContent = targetNight ? '又一只纸船，慢慢驶进月光。' : '小船下水了，随波漂一会儿。';
    render(0); schedule();
  });
  skyButton.addEventListener('click', () => {
    // Keep the entire current flock/star sequence instead of resetting it.
    if (skyEvent || night !== targetNight) return;
    if (performance.now() < skyCooldownUntil) return;
    skyCooldownUntil = performance.now() + 700;
    clearSky();
    const event = createSkyEvent(targetNight ? 'meteor' : 'birds');
    const staticPreview = reduced.matches;
    skyEvent = { ...event, elapsed: staticPreview ? event.duration * .42 : 0, staticPreview };
    status.textContent = targetNight ? '流星划过，海面也亮起了星光。' : '海鸥掠过，阳光在波浪间闪动。';
    armStaticSkyExpiry();
    render(0); schedule();
  });
  motionButton.addEventListener('click', () => {
    if (reduced.matches) return;
    paused = !paused;
    pointer = null;
    const to = paused ? 0 : 1;
    motionJourney = { from: motionSpeed, to, elapsed: 0, duration: Math.max(.2, (paused ? 2.4 : .9) * Math.abs(to - motionSpeed)) };
    updateLabels(); render(0); schedule();
  });
  scene.addEventListener('pointermove', event => {
    if (!fine.matches || !canAnimate() || paused || event.target.closest('button')) { pointer = null; return; }
    const rect = ocean.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, { passive: true });
  scene.addEventListener('pointerleave', () => { pointer = null; });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; });
  window.addEventListener('scroll', () => { pointer = null; }, { passive: true });
  window.addEventListener('blur', () => { focused = false; suspend(); });
  window.addEventListener('focus', resume);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', () => { focused = true; measure(); });
  window.addEventListener('hashchange', () => { stop(); schedule(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
  reduced.addEventListener('change', () => { stop(); updateLabels(); render(0); schedule(); });
  fine.addEventListener('change', () => { pointer = null; });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { render(0); schedule(); } else stop();
  }).observe(hero);
  new MutationObserver(() => {
    if (root.dataset.theme === currentTheme) return;
    currentTheme = root.dataset.theme;
    targetNight = currentTheme === 'dark' ? 1 : 0;
    clearSky();
    if (reduced.matches || !canRun()) { night = targetNight; themeJourney = null; }
    else themeJourney = { from: night, elapsed: 0, duration: Math.max(.45, 3.2 * Math.abs(targetNight - night)) };
    updateLabels(); render(0); schedule();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  new ResizeObserver(measure).observe(hero);
  window.addEventListener('resize', measure);
  if (!fine.matches) status.textContent = '试着放一只纸船，或点点天空。';
  updateLabels(); measure();
  ocean.classList.add('is-painted');
}
