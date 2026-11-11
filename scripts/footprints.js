// Offline map geometry and source attribution: see docs/MAP_SOURCE.md.
import { createFlightRoute, sampleFlightRoute } from './flight-route.js?v=20261111-flight-replay';
import { countryPaths } from '../assets/world-countries.js';
import { chinaCountryPath, chinaBoundaryPath } from '../assets/china-boundary.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WORLD = { width: 1000, height: 450, north: 85, south: -60 };
const EUROPE_CODES = new Set(['GBR', 'FRA', 'ITA', 'AUT', 'SWE', 'NOR']);
const codeByName = { '中国大陆': 'CHN', '香港': 'HKG', '澳门': 'MAC', '新加坡': 'SGP', '澳大利亚': 'AUS', '日本': 'JPN', '越南': 'VNM', '美国': 'USA', '英国': 'GBR', '法国': 'FRA', '意大利': 'ITA', '奥地利': 'AUT', '新西兰': 'NZL', '瑞典': 'SWE', '挪威': 'NOR' };
const project = ({ lon, lat }) => [(Number(lon) + 180) / 360 * 1000, (85 - Number(lat)) / 145 * 450];
const landURL = new URL('../assets/world-land.svg', import.meta.url).href;
const views = { world: { k: 1, tx: 0, ty: 0 }, europe: { k: 3.3, tx: -1275, ty: -98 } };
const worldLabels = {
  CHN: [-112, -24, 98], HKG: [40, -10, 63], MAC: [40, 26, 63], SGP: [-47, 29, 78],
  VNM: [-89, 2, 63], JPN: [23, -20, 63], USA: [20, -16, 63], AUS: [-30, 25, 94], NZL: [-100, 6, 78],
};
const europeLabels = {
  GBR: [-96, -20, 72], FRA: [-100, 7, 72], ITA: [30, 21, 84], AUT: [50, -28, 84],
  SWE: [26, -50, 72], NOR: [-104, -43, 72],
};

function svgElement(tag, attributes = {}, text = '') {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
}
function element(tag, className, text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * travel.base: {name,date,lon,lat,countryCode}
 * travel.visits: [{id,name,date,lon,lat,countryCode}]
 * travel.wishlist: [{id,name,lon,lat,countryCode}]
 * Mounts #travel-map, #travel-detail and #travel-list. No runtime network dependency.
 */
export function initFootprints(travel) {
  const host = document.getElementById('travel-map');
  const detail = document.getElementById('travel-detail');
  const list = document.getElementById('travel-list');
  const status = document.getElementById('travel-status');
  if (!host || !detail || !list || !travel?.base || !Array.isArray(travel.visits)) return;

  const normalize = (entry, status, index) => ({ ...entry, status, id: status === 'base' ? 'base' : entry.id || `${status}-${index}`, countryCode: entry.countryCode || codeByName[entry.name], date: status === 'wishlist' ? '想去' : status === 'base' ? entry.date || '常驻' : entry.date });
  const records = [normalize(travel.base, 'base', 0), ...travel.visits.map((entry, index) => normalize(entry, 'visited', index)), ...(travel.wishlist || []).map((entry, index) => normalize(entry, 'wishlist', index))]
    .filter(entry => Number.isFinite(Number(entry.lon)) && Number.isFinite(Number(entry.lat)));
  const markers = new Map();
  const countryNodes = new Map();
  const buttons = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Dates remain display data; sort by the first year and month, preserving ties.
  const visitOrder = records.filter(entry => entry.status === 'visited').sort((a, b) => {
    const value = entry => { const parts = String(entry.date).match(/\d+/g) || []; return Number(parts[0] || 0) * 12 + Number(parts[1] || 0); };
    return value(a) - value(b);
  });
  let currentView = 'world';
  let selected = records[0];
  let replayIndex = -1;
  let legIndex = 0;
  let replayFrame = 0;
  let replayLastTime = null;
  let replayElapsed = 0;
  let replayComplete = false;
  let flight = null;
  let camera = { ...views.world };
  let fromCamera = { ...views.world };
  let targetCamera = { ...views.world };
  let flightHeight = WORLD.height;
  let uiScale = 1;
  let savedScrollLeft = 0;
  const ZOOM_TIME = 1.25, FLY_TIME = 3.2, ARRIVAL_TIME = .95;
  const LEG_TIME = ZOOM_TIME + FLY_TIME + ARRIVAL_TIME;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  let replayPlaying = false;
  host.replaceChildren(); list.replaceChildren();
  host.classList.add('map-host'); detail.classList.add('travel-detail'); list.classList.add('travel-list');

  const toolbar = element('div', 'map-toolbar');
  const legend = element('div', 'map-legend');
  for (const [status, label] of [['visited', '去过'], ['wishlist', '想去'], ['base', '常驻']]) {
    const item = element('span', 'map-legend-item');
    item.append(element('i', `map-key-dot map-key-${status}`), document.createTextNode(label));
    legend.append(item);
  }
  const viewControl = element('div', 'map-view-control');
  viewControl.setAttribute('role', 'group'); viewControl.setAttribute('aria-label', '地图视图');
  const viewButtons = new Map();
  for (const [view, label] of [['world', '世界'], ['europe', '欧洲']]) {
    const button = element('button', 'map-view-button', label);
    button.type = 'button'; button.dataset.mapView = view;
    button.setAttribute('aria-pressed', String(view === currentView));
    button.addEventListener('click', () => { stopReplay(); setView(view); });
    viewControl.append(button); viewButtons.set(view, button);
  }
  toolbar.append(legend, viewControl); host.append(toolbar);
  const replay = element('div', 'map-replay');
  replay.hidden = !visitOrder.length;
  const replayButton = element('button', 'map-replay-button');
  replayButton.type = 'button';
  replayButton.setAttribute('aria-controls', 'travel-map travel-detail');
  const replayIcon = element('span', 'map-replay-icon', '▷'); replayIcon.setAttribute('aria-hidden', 'true');
  const replayLabel = element('span', '', '回看足迹');
  replayButton.append(replayIcon, replayLabel);
  const replayCaption = element('div', 'map-replay-caption');
  const replayPlace = element('span', 'map-replay-place');
  const replayDate = element('span', 'map-replay-date');
  const replayRoute = element('span', 'map-flight-caption');
  replayCaption.append(replayPlace, replayRoute, replayDate);
  const replayProgress = element('div', 'map-replay-progress'); replayProgress.setAttribute('aria-hidden', 'true');
  visitOrder.forEach(() => replayProgress.append(element('span', '')));
  const replayStop = element('button', 'map-replay-stop', '结束'); replayStop.type = 'button'; replayStop.hidden = true;
  replayStop.setAttribute('aria-label', '结束足迹回看');
  const replayNext = element('button', 'map-replay-next', '下一段'); replayNext.type = 'button'; replayNext.hidden = true;
  replayNext.setAttribute('aria-label', '跳到下一段行程');
  replay.append(replayButton, replayCaption, replayProgress, replayNext, replayStop); host.append(replay);
  const scroll = element('div', 'map-scroll');
  scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '足迹地图，可横向滚动；下方收藏栏可展开选择地点。'); scroll.tabIndex = 0;
  const canvas = element('div', 'map-canvas');
  const svg = svgElement('svg', { viewBox: `0 0 ${WORLD.width} ${WORLD.height}`, class: 'map-world', 'aria-label': `常驻${travel.base.name}，去过 ${travel.visits.length} 个国家或地区，想去 ${(travel.wishlist || []).length} 个国家` });
  svg.append(svgElement('title', {}, '世界足迹与想去的地方'));
  const geography = svgElement('g', { class: 'map-geography', id: 'travel-geography' });
  const mapStage = svgElement('g', { class: 'map-flight-geography' });
  const worldCopies = [-1000, 1000].map(x => svgElement('use', { href: '#travel-geography', transform: `translate(${x} 0)`, class: 'map-world-copy', 'aria-hidden': 'true', 'pointer-events': 'none' }));
  mapStage.append(geography, ...worldCopies);
  const grid = svgElement('g', { class: 'map-grid', 'aria-hidden': 'true', style: 'stroke:var(--map-grid-color,#dde7eb);opacity:var(--map-grid-opacity,1)' });
  for (let lon = -150; lon <= 150; lon += 30) {
    const [x] = project({ lon, lat: 0 }); grid.append(svgElement('line', { x1: x, y1: 0, x2: x, y2: 450 }));
  }
  for (let lat = -30; lat <= 60; lat += 30) {
    const [, y] = project({ lon: 0, lat }); grid.append(svgElement('line', { x1: 0, y1: y, x2: 1000, y2: y }));
  }
  geography.append(grid, svgElement('image', { href: landURL, x: 0, y: 0, width: 1000, height: 450, 'aria-hidden': 'true', style: 'opacity:var(--map-land-opacity,1)' }));
  const territoryLayer = svgElement('g', { class: 'map-territories' }); geography.append(territoryLayer);
  const markerLayer = svgElement('g', { class: 'map-markers' });
  const flightLayer = svgElement('g', { class: 'map-flight-layer', 'aria-hidden': 'true' });
  const flightGuide = svgElement('path', { class: 'map-flight-guide', fill: 'none' });
  const flightTrail = svgElement('path', { class: 'map-flight-trail', fill: 'none' });
  const flightArrival = svgElement('circle', { class: 'map-flight-arrival', fill: 'none' });
  const flightPlane = svgElement('g', { class: 'map-flight-plane' });
  flightPlane.append(svgElement('path', { class: 'map-flight-plane-body', d: 'M20 0 C19 -2 14 -3 6 -3 L-4 -15 L-9 -15 L-5 -3 L-13 -3 L-18 -8 L-21 -8 L-18 0 L-21 8 L-18 8 L-13 3 L-5 3 L-9 15 L-4 15 L6 3 C14 3 19 2 20 0Z' }));
  const flightPins = [0, 1].map(() => {
    const group = svgElement('g');
    const dot = svgElement('circle', { class: 'map-flight-point' });
    const bg = svgElement('rect', { class: 'map-flight-label-bg' });
    const label = svgElement('text', { class: 'map-flight-label', 'text-anchor': 'middle' });
    group.append(dot, bg, label); flightLayer.append(group);
    return { group, dot, bg, label };
  });
  flightLayer.prepend(flightGuide, flightTrail, flightArrival);
  flightLayer.append(flightPlane);
  svg.append(mapStage, markerLayer, flightLayer);
  const tooltip = element('div', 'map-tooltip'); tooltip.id = 'travel-map-tooltip'; tooltip.hidden = true; tooltip.setAttribute('aria-hidden', 'true');
  canvas.append(svg, tooltip); scroll.append(canvas); host.append(scroll);
  const hint = element('p', 'map-mobile-hint', '左右滑动地图，点击国家或标记查看日期'); host.append(hint);

  const statusName = (entry) => ({ base: '常驻', visited: '去过', wishlist: '想去' })[entry.status];
  const mapPoint = (entry) => { const [x, y] = project(entry); const { k, tx, ty } = views[currentView]; return [x * k + tx, y * k + ty]; };
  const isVisible = (entry) => currentView === 'world' || EUROPE_CODES.has(entry.countryCode);

  function showDetail(entry) {
    detail.replaceChildren(element('span', `travel-detail-label travel-status-${entry.status}`, statusName(entry)), element('strong', '', entry.name));
    // A wish is a category, never a dated visit.
    if (entry.status === 'visited') detail.append(element('span', 'travel-detail-date', entry.date));
    if (status) status.textContent = `${statusName(entry)}：${entry.name}${entry.status === 'visited' ? `，${entry.date}` : ''}`;
  }
  function showTooltip(entry) {
    tooltip.replaceChildren(element('strong', '', entry.countryName || entry.name), element('span', '', entry.status === 'base' ? `常驻：${entry.name}` : entry.date)); tooltip.hidden = false;
    const [x, y] = mapPoint(entry); const scale = canvas.clientWidth / WORLD.width;
    const leftEdge = scroll.scrollLeft + 10;
    const rightEdge = Math.max(leftEdge, scroll.scrollLeft + scroll.clientWidth - tooltip.offsetWidth - 10);
    tooltip.style.left = `${Math.max(leftEdge, Math.min(rightEdge, x * scale - tooltip.offsetWidth / 2))}px`;
    tooltip.style.top = `${Math.max(9, Math.min(canvas.clientHeight - tooltip.offsetHeight - 9, y * scale - tooltip.offsetHeight - 19))}px`;
  }
  function activate(entry, withTooltip = false) {
    selected = entry;
    for (const collection of [markers, countryNodes, buttons]) for (const [id, node] of collection) {
      const active = id === entry.id;
      node.classList.toggle('is-active', active); node.setAttribute('aria-pressed', String(active));
    }
    showDetail(entry);
    if (withTooltip && isVisible(entry)) showTooltip(entry); else tooltip.hidden = true;
  }
  function manualActivate(entry) {
    stopReplay();
    activate(entry, true);
  }
  function attachInteraction(node, entry) {
    node.addEventListener('pointerenter', () => { if (replayIndex < 0) manualActivate(entry); });
    node.addEventListener('focus', () => manualActivate(entry));
    node.addEventListener('click', () => manualActivate(entry));
    node.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse' && document.activeElement !== node) tooltip.hidden = true; });
    node.addEventListener('blur', () => { tooltip.hidden = true; });
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); manualActivate(entry); }
      if (event.key === 'Escape') tooltip.hidden = true;
    });
  }

  for (const entry of records) {
    const path = entry.countryCode === 'CHN' ? chinaCountryPath : countryPaths[entry.countryCode];
    if (!path) continue; // Very small regions remain independently selectable pins.
    const node = svgElement('path', { d: path, class: `map-country map-country-${entry.status}`, 'data-country': entry.countryCode, 'data-place': entry.id, role: 'button', tabindex: '0', 'aria-label': `${entry.countryName || entry.name}国土，${entry.status === 'base' ? `常驻${entry.name}` : entry.date}`, 'aria-controls': 'travel-detail', 'aria-pressed': 'false', 'fill-rule': 'evenodd', 'vector-effect': 'non-scaling-stroke' });
    attachInteraction(node, entry); territoryLayer.append(node); countryNodes.set(entry.id, node);
    if (entry.countryCode === 'CHN') {
      territoryLayer.append(svgElement('path', { d: chinaBoundaryPath, class: 'map-china-boundary', 'aria-hidden': 'true', 'vector-effect': 'non-scaling-stroke' }));
    }
  }

  function drawMarkers() {
    markerLayer.replaceChildren(); markers.clear();
    for (const entry of records) {
      if (!isVisible(entry)) continue;
      const [x, y] = mapPoint(entry);
      const label = currentView === 'europe' ? europeLabels[entry.countryCode] : worldLabels[entry.countryCode];
      const group = svgElement('g', { class: `map-point map-${entry.status}`, role: 'button', tabindex: '0', 'data-place': entry.id, 'aria-label': `${entry.name}，${entry.date}`, 'aria-controls': 'travel-detail', 'aria-pressed': 'false' });
      if (label) {
        const [dx, dy, width] = label; const lx = Math.min(995 - width, Math.max(5, x + dx)); const ly = Math.min(418, Math.max(5, y + dy));
        group.append(svgElement('line', { x1: x, y1: y, x2: dx < 0 ? lx + width : lx, y2: ly + 14.5, class: 'map-leader', 'aria-hidden': 'true' }));
        group.append(svgElement('rect', { x: lx, y: ly, width, height: 29, rx: 4, class: 'map-label-bg', 'aria-hidden': 'true' }));
        group.append(svgElement('text', { x: lx + width / 2, y: ly + 19, 'text-anchor': 'middle', class: 'map-label', 'aria-hidden': 'true' }, entry.name));
      }
      // The pin and halo intentionally accept pointers; Hong Kong and Macao also have separate labels.
      group.append(svgElement('circle', { cx: x, cy: y, r: 10, class: 'map-pin-halo', 'aria-hidden': 'true' }));
      group.append(svgElement('circle', { cx: x, cy: y, r: 4.4, class: 'map-pin', 'aria-hidden': 'true' }));
      group.append(svgElement('title', {}, `${entry.name} · ${entry.date}`));
      attachInteraction(group, entry); markerLayer.append(group); markers.set(entry.id, group);
    }
  }
  function setView(view) {
    currentView = view; const { k, tx, ty } = views[view];
    geography.setAttribute('transform', `translate(${tx} ${ty}) scale(${k})`);
    svg.setAttribute('data-view', view);
    for (const [key, button] of viewButtons) button.setAttribute('aria-pressed', String(key === view));
    for (const entry of records) {
      const country = countryNodes.get(entry.id);
      if (country) { country.style.display = isVisible(entry) ? '' : 'none'; country.setAttribute('tabindex', isVisible(entry) ? '0' : '-1'); }
    }
    drawMarkers(); tooltip.hidden = true;
    if (selected) activate(selected);
    // Center the enlarged European region on small screens.
    if (view === 'europe') scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) / 2;
  }
  function selectFromList(entry) {
    stopReplay();
    const view = EUROPE_CODES.has(entry.countryCode) ? 'europe' : 'world';
    if (currentView !== view) setView(view);
    activate(entry, true);
    if (scroll.scrollWidth > scroll.clientWidth) {
      const [x] = mapPoint(entry);
      scroll.scrollTo({ left: x / 1000 * canvas.clientWidth - scroll.clientWidth / 2, behavior: 'auto' });
    }
  }

  function updateReplay() {
    const entry = visitOrder[replayIndex];
    const label = reducedMotion.matches
      ? (replayIndex < 0 ? '逐段回看' : replayComplete ? '重新回看' : '下一段')
      : (replayPlaying ? '暂停回看' : replayIndex < 0 ? '回看足迹' : replayComplete ? '重新回看' : '继续回看');
    replayLabel.textContent = label;
    replayIcon.textContent = replayPlaying ? 'Ⅱ' : '▷';
    replayButton.setAttribute('aria-label', label);
    replayButton.setAttribute('aria-pressed', String(replayPlaying));
    replayPlace.textContent = entry ? `${entry.name} · ${entry.date}` : `${visitOrder.length} 段足迹`;
    const route = entry?.route || [];
    replayRoute.textContent = entry ? `${route[legIndex]?.name || entry.name} → ${route[legIndex + 1]?.name || entry.name}` : '上海浦东 / 广州出发';
    replayDate.textContent = entry ? `行程 ${replayIndex + 1}/${visitOrder.length} · 航段 ${legIndex + 1}/${Math.max(1, route.length - 1)} · 行程示意` : '2012 — 2024 · 行程示意';
    [...replayProgress.children].forEach((node, index) => {
      node.classList.toggle('is-past', index < replayIndex || replayComplete);
      node.classList.toggle('is-current', index === replayIndex && !replayComplete);
    });
    replay.classList.toggle('is-playing', replayPlaying);
    host.classList.toggle('is-replaying', replayIndex >= 0);
    markerLayer.setAttribute('aria-hidden', String(replayIndex >= 0));
    territoryLayer.setAttribute('aria-hidden', String(replayIndex >= 0));
    host.dataset.replayState = replayIndex < 0 ? 'idle' : replayComplete ? 'complete' : replayPlaying ? 'playing' : 'paused';
    host.dataset.tripIndex = String(replayIndex);
    host.dataset.legIndex = String(legIndex);
    replayStop.hidden = replayIndex < 0;
    replayNext.hidden = replayIndex < 0 || replayComplete || reducedMotion.matches;
    hint.textContent = replayIndex < 0 ? '左右滑动地图，点击国家或标记查看日期' : '可暂停细看，或跳到下一段行程';
  }
  function pauseReplay() {
    if (replayFrame) cancelAnimationFrame(replayFrame);
    replayFrame = 0; replayLastTime = null; replayPlaying = false;
    updateReplay();
  }
  function stopReplay() {
    const wasActive = replayIndex >= 0;
    pauseReplay();
    replayIndex = -1; legIndex = 0; replayElapsed = 0; replayComplete = false; flight = null;
    camera = { ...views.world };
    mapStage.removeAttribute('transform');
    svg.setAttribute('viewBox', '0 0 1000 450');
    updateReplay();
    host.dataset.legProgress = '0'; host.dataset.cameraProgress = '0';
    if (wasActive) { svg.setAttribute('aria-label', `常驻${travel.base.name}，去过 ${travel.visits.length} 个国家或地区，想去 ${(travel.wishlist || []).length} 个国家`); setView('world'); scroll.scrollLeft = savedScrollLeft; }
  }
  function fitFlightCamera() {
    if (!flight) return;
    const width = Math.max(200, scroll.clientWidth || 1000);
    uiScale = Math.max(1, 800 / width);
    flightHeight = Math.max(450, Math.min(1000, 260000 / width));
    svg.setAttribute('viewBox', `0 0 1000 ${flightHeight}`);
    const b = flight.curveBounds;
    const distance = Math.hypot(flight.end.x - flight.start.x, flight.end.y - flight.start.y);
    const maxZoom = (distance < 15 ? 32 : 5) * uiScale;
    const k = Math.min(maxZoom, (1000 - 190 * uiScale) / Math.max(1, b.width), (flightHeight - 140 * uiScale) / Math.max(1, b.height));
    targetCamera = { k, tx: 500 - (b.minX + b.maxX) / 2 * k, ty: flightHeight / 2 - (b.minY + b.maxY) / 2 * k };
  }
  function prepareLeg() {
    const entry = visitOrder[replayIndex];
    const route = entry.route || [travel.base, entry];
    const previousFlight = flight;
    fromCamera = { ...camera };
    flight = createFlightRoute(route[legIndex], route[legIndex + 1]);
    // Keep connecting legs in the same Pacific-side world copy.
    if (legIndex > 0 && previousFlight) {
      const shift = Math.round((previousFlight.end.x - flight.start.x) / 1000) * 1000;
      if (shift) {
        for (const key of ['start', 'end', 'control']) flight[key].x += shift;
        flight.curveBounds.minX += shift; flight.curveBounds.maxX += shift;
      }
    }
    replayElapsed = reducedMotion.matches ? LEG_TIME : 0;
    fitFlightCamera();
    activate(entry);
    svg.setAttribute('aria-label', `${entry.date}，${entry.name}，${route[legIndex].name}飞往${route[legIndex + 1].name}，行程示意`);
    if (status) status.textContent = svg.getAttribute('aria-label');
    updateReplay(); renderFlight();
  }
  function startReplay() {
    if (replayIndex < 0) savedScrollLeft = scroll.scrollLeft;
    setView('world');
    replayIndex = 0; legIndex = 0; replayComplete = false;
    camera = { ...views.world };
    updateReplay(); scroll.scrollLeft = 0;
    for (const node of countryNodes.values()) node.setAttribute('tabindex', '-1');
    prepareLeg();
  }
  function advanceLeg() {
    const entry = visitOrder[replayIndex];
    const count = Math.max(1, (entry.route?.length || 2) - 1);
    if (legIndex + 1 < count) legIndex++;
    else if (replayIndex + 1 < visitOrder.length) { replayIndex++; legIndex = 0; }
    else { replayComplete = true; pauseReplay(); return false; }
    prepareLeg();
    return true;
  }
  function renderFlight() {
    if (!flight) return;
    const zoom = ease(replayElapsed / ZOOM_TIME);
    const progress = ease((replayElapsed - ZOOM_TIME) / FLY_TIME);
    // Interpolate the camera centre and logarithmic scale; distant trips gently pull back.
    const centre = c => ({ x: (500 - c.tx) / c.k, y: (flightHeight / 2 - c.ty) / c.k });
    const a = centre(fromCamera), b = centre(targetCamera);
    const distant = Math.hypot(a.x - b.x, a.y - b.y) > 150;
    const k = Math.exp(Math.log(fromCamera.k) * (1 - zoom) + Math.log(targetCamera.k) * zoom) / (1 + (distant ? 2 : .15) * Math.sin(Math.PI * zoom));
    camera = { k, tx: 500 - (a.x + (b.x - a.x) * zoom) * k, ty: flightHeight / 2 - (a.y + (b.y - a.y) * zoom) * k };
    mapStage.setAttribute('transform', `translate(${camera.tx} ${camera.ty}) scale(${camera.k})`);
    const screen = point => ({ x: point.x * k + camera.tx, y: point.y * k + camera.ty });
    const start = screen(flight.start), end = screen(flight.end), control = screen(flight.control);
    const path = `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}`;
    flightGuide.setAttribute('d', path);
    // A partial Bézier uses de Casteljau; trail and plane share the same exact endpoint.
    const point = sampleFlightRoute(flight, progress), position = screen(point);
    const partialControl = { x: start.x + (control.x - start.x) * progress, y: start.y + (control.y - start.y) * progress };
    flightTrail.setAttribute('d', `M${start.x} ${start.y} Q${partialControl.x} ${partialControl.y} ${position.x} ${position.y}`);
    const reveal = ease((zoom - .55) / .45);
    flightLayer.setAttribute('opacity', reveal);
    flightGuide.setAttribute('stroke-width', 1.2 * uiScale); flightGuide.setAttribute('stroke-dasharray', `${3 * uiScale} ${6 * uiScale}`);
    flightTrail.setAttribute('stroke-width', 2.4 * uiScale);
    flightPlane.setAttribute('transform', `translate(${position.x} ${position.y}) rotate(${point.angle}) scale(${.78 * uiScale})`);
    const arrival = clamp((replayElapsed - ZOOM_TIME - FLY_TIME) / ARRIVAL_TIME);
    flightPlane.setAttribute('opacity', 1 - ease(arrival) * .7);
    flightArrival.setAttribute('cx', end.x); flightArrival.setAttribute('cy', end.y);
    flightArrival.setAttribute('r', (7 + arrival * 23) * uiScale); flightArrival.setAttribute('opacity', arrival > 0 ? Math.sin(Math.PI * arrival) * .65 : 0);
    flightArrival.setAttribute('stroke-width', 1.5 * uiScale);
    const route = visitOrder[replayIndex].route || [travel.base, visitOrder[replayIndex]];
    for (let i = 0; i < 2; i++) {
      const p = i ? end : start, node = flightPins[i];
      const text = route[legIndex + i].shortName || route[legIndex + i].name;
      const width = ([...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 13 : 7), 0) + 24) * uiScale;
      const x = clamp(p.x - width / 2, 10, 990 - width);
      const y = clamp(p.y + (i ? 17 : -42) * uiScale, 10, flightHeight - 32 * uiScale - 10);
      node.dot.setAttribute('cx', p.x); node.dot.setAttribute('cy', p.y); node.dot.setAttribute('r', 4.5 * uiScale);
      for (const [key, value] of Object.entries({ x, y, width, height: 28 * uiScale, rx: 8 * uiScale })) node.bg.setAttribute(key, value);
      node.label.setAttribute('x', x + width / 2); node.label.setAttribute('y', y + 18.5 * uiScale);
      node.label.setAttribute('font-size', 13 * uiScale); node.label.textContent = text;
    }
    host.dataset.legProgress = progress.toFixed(5);
    host.dataset.cameraProgress = zoom.toFixed(5);
  }
  function tickReplay(now) {
    replayFrame = 0;
    if (!replayPlaying) return;
    if (replayLastTime !== null) replayElapsed += Math.min(.08, Math.max(0, (now - replayLastTime) / 1000));
    replayLastTime = now;
    renderFlight();
    if (replayElapsed >= LEG_TIME && !advanceLeg()) return;
    replayFrame = requestAnimationFrame(tickReplay);
  }
  function playReplay() {
    replayPlaying = true; replayLastTime = null;
    updateReplay();
    if (!replayFrame) replayFrame = requestAnimationFrame(tickReplay);
  }
  replayButton.addEventListener('click', () => {
    if (!visitOrder.length) return;
    if (reducedMotion.matches) {
      if (replayIndex < 0 || replayComplete) startReplay(); else advanceLeg();
      const finalTrip = replayIndex === visitOrder.length - 1;
      const finalLeg = legIndex === (visitOrder[replayIndex].route?.length || 2) - 2;
      if (finalTrip && finalLeg) replayComplete = true;
      updateReplay();
    } else if (replayPlaying) pauseReplay();
    else { if (replayIndex < 0 || replayComplete) startReplay(); playReplay(); }
  });
  replayNext.addEventListener('click', () => {
    if (replayIndex < 0 || replayComplete) return;
    const playing = replayPlaying;
    pauseReplay();
    if (advanceLeg()) {
      if (playing) playReplay();
      else { replayElapsed = ZOOM_TIME; renderFlight(); }
    }
  });
  replayStop.addEventListener('click', () => { stopReplay(); tooltip.hidden = true; replayButton.focus(); });
  host.addEventListener('keydown', event => { if (event.key === 'Escape' && replayIndex >= 0) { stopReplay(); replayButton.focus(); } });
  reducedMotion.addEventListener('change', () => {
    pauseReplay();
    if (flight && reducedMotion.matches) { replayElapsed = LEG_TIME; renderFlight(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseReplay(); });
  window.addEventListener('pagehide', pauseReplay);
  window.addEventListener('blur', pauseReplay);
  window.addEventListener('hashchange', () => { if (location.hash !== '#travel') pauseReplay(); });
  const replayVisibility = new IntersectionObserver(entries => { if (!entries[0].isIntersecting) pauseReplay(); }, { threshold: 0 });
  replayVisibility.observe(host);
  updateReplay();
  for (const [status, title] of [['visited', '去过'], ['wishlist', '想去']]) {
    const entries = records.filter(entry => entry.status === status);
    if (!entries.length) continue;
    const section = element('section', `travel-group travel-group-${status}`);
    const heading = element('h3', 'travel-group-title', title); const count = element('span', '', String(entries.length)); heading.append(count);
    const items = element('div', 'travel-group-items');
    for (const entry of entries) {
      const button = element('button', `travel-place travel-place-${entry.status}`);
      button.type = 'button'; button.dataset.place = entry.id;
      button.setAttribute('aria-label', `${entry.name}，${entry.date}`); button.setAttribute('aria-controls', 'travel-detail'); button.setAttribute('aria-pressed', 'false');
      button.append(element('span', '', entry.name));
      if (entry.status === 'visited') button.append(element('span', 'travel-place-date', entry.date));
      else button.append(element('span', 'travel-place-wish', '○'));
      button.addEventListener('pointerenter', () => { if (replayIndex < 0) selectFromList(entry); });
      button.addEventListener('focus', () => selectFromList(entry));
      button.addEventListener('click', () => selectFromList(entry));
      items.append(button); buttons.set(entry.id, button);
    }
    section.append(heading, items); list.append(section);
  }
  setView('world');
  if (scroll.scrollWidth > scroll.clientWidth) scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth;
  window.addEventListener('resize', () => {
    if (flight) { fitFlightCamera(); renderFlight(); }
    if (!tooltip.hidden && selected && isVisible(selected)) showTooltip(selected);
  });
  scroll.addEventListener('scroll', () => {
    if (!tooltip.hidden && selected && isVisible(selected)) showTooltip(selected);
  }, { passive: true });
}
