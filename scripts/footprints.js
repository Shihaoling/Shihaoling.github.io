// Offline map geometry and source attribution: see docs/MAP_SOURCE.md.
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
  if (!host || !detail || !list || !travel?.base || !Array.isArray(travel.visits)) return;

  const normalize = (entry, status, index) => ({ ...entry, status, id: status === 'base' ? 'base' : entry.id || `${status}-${index}`, countryCode: entry.countryCode || codeByName[entry.name], date: status === 'wishlist' ? '想去' : status === 'base' ? entry.date || '常驻' : entry.date });
  const records = [normalize(travel.base, 'base', 0), ...travel.visits.map((entry, index) => normalize(entry, 'visited', index)), ...(travel.wishlist || []).map((entry, index) => normalize(entry, 'wishlist', index))]
    .filter(entry => Number.isFinite(Number(entry.lon)) && Number.isFinite(Number(entry.lat)));
  const markers = new Map();
  const countryNodes = new Map();
  const buttons = new Map();
  let currentView = 'world';
  let selected = records[0];
  host.replaceChildren(); list.replaceChildren();
  host.classList.add('map-host'); detail.classList.add('travel-detail'); list.classList.add('travel-list');
  detail.setAttribute('aria-live', 'polite'); detail.setAttribute('aria-atomic', 'true');

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
    button.addEventListener('click', () => setView(view));
    viewControl.append(button); viewButtons.set(view, button);
  }
  toolbar.append(legend, viewControl); host.append(toolbar);
  const scroll = element('div', 'map-scroll');
  scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '足迹地图，可横向滚动；下方地点列表同样可以选择。'); scroll.tabIndex = 0;
  const canvas = element('div', 'map-canvas');
  const svg = svgElement('svg', { viewBox: `0 0 ${WORLD.width} ${WORLD.height}`, class: 'map-world', 'aria-label': `常驻${travel.base.name}，去过 ${travel.visits.length} 个国家或地区，想去 ${(travel.wishlist || []).length} 个国家` });
  svg.append(svgElement('title', {}, '世界足迹与想去的地方'));
  const geography = svgElement('g', { class: 'map-geography' });
  const grid = svgElement('g', { class: 'map-grid', 'aria-hidden': 'true' });
  for (let lon = -150; lon <= 150; lon += 30) {
    const [x] = project({ lon, lat: 0 }); grid.append(svgElement('line', { x1: x, y1: 0, x2: x, y2: 450 }));
  }
  for (let lat = -30; lat <= 60; lat += 30) {
    const [, y] = project({ lon: 0, lat }); grid.append(svgElement('line', { x1: 0, y1: y, x2: 1000, y2: y }));
  }
  geography.append(grid, svgElement('image', { href: landURL, x: 0, y: 0, width: 1000, height: 450, 'aria-hidden': 'true' }));
  const territoryLayer = svgElement('g', { class: 'map-territories' }); geography.append(territoryLayer);
  const markerLayer = svgElement('g', { class: 'map-markers' }); svg.append(geography, markerLayer);
  const tooltip = element('div', 'map-tooltip'); tooltip.id = 'travel-map-tooltip'; tooltip.hidden = true; tooltip.setAttribute('aria-hidden', 'true');
  canvas.append(svg, tooltip); scroll.append(canvas); host.append(scroll);
  const hint = element('p', 'map-mobile-hint', '左右滑动地图，或点击下方地点'); host.append(hint);

  const statusName = (entry) => ({ base: '常驻', visited: '去过', wishlist: '想去' })[entry.status];
  const mapPoint = (entry) => { const [x, y] = project(entry); const { k, tx, ty } = views[currentView]; return [x * k + tx, y * k + ty]; };
  const isVisible = (entry) => currentView === 'world' || EUROPE_CODES.has(entry.countryCode);

  function showDetail(entry) {
    detail.replaceChildren(element('span', `travel-detail-label travel-status-${entry.status}`, statusName(entry)), element('strong', '', entry.name));
    // A wish is a category, never a dated visit.
    if (entry.status === 'visited') detail.append(element('span', 'travel-detail-date', entry.date));
  }
  function showTooltip(entry) {
    tooltip.replaceChildren(element('strong', '', entry.countryName || entry.name), element('span', '', entry.status === 'base' ? `常驻：${entry.name}` : entry.date)); tooltip.hidden = false;
    const [x, y] = mapPoint(entry); const scale = canvas.clientWidth / WORLD.width;
    tooltip.style.left = `${Math.max(10, Math.min(canvas.clientWidth - tooltip.offsetWidth - 10, x * scale - tooltip.offsetWidth / 2))}px`;
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
  function attachInteraction(node, entry) {
    node.addEventListener('pointerenter', () => activate(entry, true));
    node.addEventListener('focus', () => activate(entry, true));
    node.addEventListener('click', () => activate(entry, true));
    node.addEventListener('pointerleave', () => { if (document.activeElement !== node) tooltip.hidden = true; });
    node.addEventListener('blur', () => { tooltip.hidden = true; });
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(entry, true); }
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
    const view = EUROPE_CODES.has(entry.countryCode) ? 'europe' : 'world';
    if (currentView !== view) setView(view);
    activate(entry, true);
    if (scroll.scrollWidth > scroll.clientWidth) {
      const [x] = mapPoint(entry);
      scroll.scrollTo({ left: x / 1000 * canvas.clientWidth - scroll.clientWidth / 2, behavior: 'auto' });
    }
  }
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
      button.addEventListener('pointerenter', () => selectFromList(entry));
      button.addEventListener('focus', () => selectFromList(entry));
      button.addEventListener('click', () => selectFromList(entry));
      items.append(button); buttons.set(entry.id, button);
    }
    section.append(heading, items); list.append(section);
  }
  setView('world');
  if (scroll.scrollWidth > scroll.clientWidth) scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth;
  window.addEventListener('resize', () => {
    if (!tooltip.hidden && selected && isVisible(selected)) showTooltip(selected);
  });
}
