// Creation owns randomness; drawing is deterministic for a given event/progress.
const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const smooth = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

// Decorative constellations, intentionally not astronomical charts.
const starPatterns = [
  [[.08,.64],[.2,.28],[.46,.11],[.69,.37],[.9,.22],[.77,.79]],
  [[.1,.18],[.4,.08],[.68,.25],[.9,.63],[.53,.83],[.28,.58]],
  [[.1,.46],[.3,.12],[.5,.4],[.73,.13],[.9,.55],[.67,.85],[.4,.73]],
  [[.1,.75],[.25,.4],[.45,.18],[.62,.52],[.86,.72]],
  [[.13,.25],[.38,.13],[.64,.27],[.87,.11],[.75,.64],[.46,.86],[.2,.66]],
];

/** All durations are seconds; the controller supplies event.progress in [0,1]. */
export function createSkyEvent(kind, random = Math.random) {
  const next = () => clamp(Number(random()) || 0, 0, 1 - Number.EPSILON);
  const between = (a, b) => mix(a, b, next());
  const event = {
    kind: kind === 'birds' ? 'birds' : 'meteor',
    patternId: Math.floor(next() * 0xffffffffff).toString(36).padStart(8, '0'),
    duration: between(7.6, 8.8),
    birds: [], meteors: [], constellations: [],
    sparkles: Array.from({ length: 34 }, () => ({ x: next(), y: next(), phase: between(0, TAU), size: between(1.5, 3.1) })),
    rippleX: between(.4, .66),
    lightPhase: between(0, TAU),
  };
  if (event.kind === 'birds') {
    const count = 3 + Math.floor(next() * 6);
    const flockHeight = between(.38, .57);
    const formation = next() < .5 ? -1 : 1;
    const start = between(.02, .045);
    const end = between(.935, .965);
    event.duration = between(9, 10);
    event.birds = Array.from({ length: count }, (_, index) => ({
      start, end,
      lane: clamp(flockHeight + formation * (index - (count - 1) / 2) * .035 + between(-.065, .065), .23, .74),
      size: between(10.5, 15.8),
      phase: between(0, TAU),
      wingCycles: between(8.5, 13.5),
      sway: between(.022, .052),
      arc: between(-.065, .045),
      tone: between(0, 1),
    }));
    // One shared speed prevents larger/faster birds from catching their
    // neighbours. Each offset reserves both full wing envelopes plus clear air.
    let span = 0;
    const maxHalf = Math.max(...event.birds.map(bird => bird.size * 1.65));
    event.birds.forEach((bird, index) => {
      const gap = index ? between(20, 30) : 0;
      if (index) span += (event.birds[index - 1].size + bird.size) * 1.65 + gap;
      bird.flockOffset = span;
      bird.wingGap = gap;
    });
    event.flock = { start, end, span, maxHalf };
    event.birds.forEach(bird => { bird.flockSpan = span; bird.flockMaxHalf = maxHalf; });
  } else {
    const available = starPatterns.map((_, index) => index);
    const cells = [
      { x: .04, y: .06, width: .37, height: .49 },
      { x: .55, y: .04, width: .36, height: .46 },
      { x: .28, y: .55, width: .4, height: .37 },
    ];
    event.constellations = cells.map((cell, index) => {
      const chosen = available.splice(Math.floor(next() * available.length), 1)[0];
      return {
        pattern: chosen,
        x: cell.x + between(-.018, .018), y: cell.y + between(-.018, .018),
        width: cell.width * between(.9, 1.04), height: cell.height * between(.87, 1.02),
        reveal: .02 + index * .055 + between(0, .035),
        phase: between(0, TAU),
        points: starPatterns[chosen].map(([x, y]) => ({ x: x + between(-.018, .018), y: y + between(-.018, .018), size: between(1.6, 2.5) })),
      };
    });
    const count = 5 + Math.floor(next() * 4);
    event.meteors = Array.from({ length: count }, (_, index) => {
      const start = .12 + index / Math.max(1, count - 1) * .57 + between(-.025, .025);
      const x = between(.58, .98);
      const y = between(.03, .34);
      return {
        start, end: Math.min(.975, start + between(.19, .285)),
        x, y,
        endX: Math.max(.035, x - between(.28, .65)),
        endY: Math.min(.97, y + between(.29, .62)),
        length: between(.12, .27),
        thickness: between(1.9, 3.2),
        glow: between(5.8, 8.8),
      };
    });
  }
  return event;
}

function resolveLayout({ width = 1, height = 1, horizon = height * .42, celestial, sceneBounds } = {}) {
  width = Math.max(1, width); height = Math.max(1, height);
  const sun = celestial || { x: width * .83, y: horizon * .45, radius: 28 };
  const left = clamp(sceneBounds?.left ?? Math.max(0, sun.x - Math.min(240, width * .66)), 0, width - 1);
  const top = clamp(sceneBounds?.top ?? (sun.y - sun.radius * 2.2), 0, height);
  const bottom = clamp(sceneBounds?.bottom ?? height, top, height);
  const sceneWidth = clamp(sceneBounds?.width ?? width - left, 1, width - left);
  const skyTop = Math.max(top + 5, sun.y - sun.radius * 2.2);
  const skyBottom = Math.max(skyTop + 20, horizon - 12);
  return { width, height, horizon, sun, left, top, bottom, sceneWidth, skyTop, skyHeight: skyBottom - skyTop };
}

/**
 * Pure pose helper. layout is the same object passed to drawSkyEvent.
 * halfWidth includes wing tips, head, beak and rotation. At bird.end the entire
 * bird is right of layout.width, independently of sceneBounds.width.
 */
export function getBirdPose(bird, progress, layout) {
  const scene = layout.skyTop === undefined ? resolveLayout(layout) : layout;
  const { width, left, sceneWidth, skyTop, skyHeight } = scene;
  const flight = clamp((progress - bird.start) / (bird.end - bird.start));
  const layoutScale = clamp(sceneWidth / 340, .8, 1.12);
  const size = bird.size * layoutScale;
  const halfWidth = size * 1.65;
  const groupHalf = bird.flockMaxHalf * layoutScale;
  const leadX = mix(left - groupHalf - 10, width + (bird.flockSpan * layoutScale) + groupHalf + 12, flight);
  const x = leadX - bird.flockOffset * layoutScale;
  const y = clamp(
    skyTop + skyHeight * (bird.lane + Math.sin(flight * TAU + bird.phase) * bird.sway + Math.sin(flight * Math.PI) * bird.arc),
    skyTop + Math.min(size * 1.4, skyHeight * .4),
    skyTop + skyHeight - Math.min(size * .8, skyHeight * .25),
  );
  return {
    x, y, size, halfWidth,
    leftEdge: x - halfWidth, rightEdge: x + halfWidth,
    alpha: smooth(0, .045, flight),
    roll: Math.sin(flight * TAU + bird.phase) * .055,
    flap: Math.sin(progress * TAU * bird.wingCycles + bird.phase),
    visible: progress >= bird.start && x + halfWidth >= left && x - halfWidth <= width,
    finished: progress >= bird.end,
  };
}

function drawBird(ctx, bird, pose) {
  if (!pose.visible || pose.alpha <= 0) return;
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.roll);
  ctx.scale(pose.size / 14, pose.size / 14); ctx.globalAlpha = pose.alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const wing = 5 + pose.flap * 9;
  // Two separately shaded, pointed wings and a small body/head give the bird
  // a recognisable three-quarter silhouette through the whole wingbeat.
  ctx.beginPath(); ctx.moveTo(0, -1);
  ctx.bezierCurveTo(-6, -8, -11, -wing, -17, -wing - 2);
  ctx.lineTo(-13, -wing + 4); ctx.quadraticCurveTo(-5, 1, 2, 2); ctx.closePath();
  ctx.fillStyle = '#dce5e3'; ctx.fill(); ctx.strokeStyle = '#7898a4'; ctx.lineWidth = .65; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-17, -wing - 2); ctx.lineTo(-12, -wing - .3); ctx.lineTo(-13, -wing + 4); ctx.closePath();
  ctx.fillStyle = '#738895'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(-6, 2); ctx.lineTo(-3, 5); ctx.closePath();
  ctx.fillStyle = '#e7ece6'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-7, 5);
  ctx.bezierCurveTo(-3, 1, 3, -2, 7, -2); ctx.bezierCurveTo(11, -6, 14, -3, 12, 1);
  ctx.quadraticCurveTo(6, 5, -1, 5); ctx.closePath(); ctx.fillStyle = '#fafbf0'; ctx.fill();
  ctx.strokeStyle = '#7898a4'; ctx.lineWidth = .65; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 1);
  ctx.bezierCurveTo(7, -5, 13, -wing, 19, -wing - 4);
  ctx.bezierCurveTo(16, -wing + 2, 9, 3, 1, 4); ctx.closePath();
  ctx.fillStyle = bird.tone > .5 ? '#fffdf1' : '#f1f5ee'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(19, -wing - 4); ctx.lineTo(13.7, -wing - 1.1);
  ctx.lineTo(14.8, -wing + 2); ctx.quadraticCurveTo(17, -wing, 19, -wing - 4); ctx.closePath();
  ctx.fillStyle = '#718794'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(12.3, -1.6); ctx.lineTo(15.6, -.2); ctx.lineTo(12, .6); ctx.closePath();
  ctx.fillStyle = '#c69a58'; ctx.fill();
  ctx.fillStyle = '#395769'; ctx.beginPath(); ctx.arc(10.7, -1.8, .52, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawConstellations(ctx, event, scene, envelope, time) {
  const { left, sceneWidth, skyTop, skyHeight } = scene;
  for (const cluster of event.constellations) {
    const originX = left + cluster.x * sceneWidth;
    const originY = skyTop + cluster.y * skyHeight;
    const w = cluster.width * sceneWidth, h = cluster.height * skyHeight;
    for (let i = 0; i < cluster.points.length; i++) {
      const point = cluster.points[i];
      const x = originX + point.x * w, y = originY + point.y * h;
      const reveal = smooth(cluster.reveal + i * .018, cluster.reveal + .15 + i * .018, event.progress) * envelope;
      if (i) {
        const previous = cluster.points[i - 1];
        const px = originX + previous.x * w, py = originY + previous.y * h;
        const trace = smooth(cluster.reveal + i * .018, cluster.reveal + .16 + i * .018, event.progress);
        ctx.strokeStyle = `rgba(172,211,235,${reveal * .46})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(mix(px, x, trace), mix(py, y, trace)); ctx.stroke();
      }
      const twinkle = .72 + .28 * Math.sin(time * 2.3 + cluster.phase + i);
      const radius = point.size * (.86 + .14 * twinkle);
      ctx.fillStyle = `rgba(240,246,229,${reveal * twinkle})`;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(216,237,244,${reveal * .7})`; ctx.lineWidth = .85;
      ctx.beginPath(); ctx.moveTo(x - radius * 2, y); ctx.lineTo(x + radius * 2, y);
      ctx.moveTo(x, y - radius * 2); ctx.lineTo(x, y + radius * 2); ctx.stroke();
    }
  }
}

function drawMeteors(ctx, event, scene, envelope) {
  const { left, width, skyTop, skyHeight } = scene;
  const span = width - left;
  for (const meteor of event.meteors) {
    const flight = clamp((event.progress - meteor.start) / (meteor.end - meteor.start));
    if (flight <= 0 || flight >= 1) continue;
    const alpha = Math.sin(flight * Math.PI) * envelope;
    const startX = left + span * meteor.x, startY = skyTop + skyHeight * meteor.y;
    const endX = left + span * meteor.endX, endY = skyTop + skyHeight * meteor.endY;
    const x = mix(startX, endX, flight), y = mix(startY, endY, flight);
    const dx = startX - endX, dy = startY - endY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const length = Math.min(span * meteor.length, 125);
    const tx = x + dx / distance * length, ty = y + dy / distance * length;
    const trail = ctx.createLinearGradient(tx, ty, x, y);
    trail.addColorStop(0, 'rgba(213,235,248,0)'); trail.addColorStop(.7, `rgba(194,223,244,${alpha * .35})`);
    trail.addColorStop(1, `rgba(244,248,231,${alpha})`);
    ctx.strokeStyle = trail; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y);
    ctx.save(); ctx.globalAlpha = .24; ctx.lineWidth = meteor.glow; ctx.stroke(); ctx.restore();
    ctx.lineWidth = meteor.thickness; ctx.stroke();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, meteor.glow);
    glow.addColorStop(0, `rgba(223,242,250,${alpha * .6})`); glow.addColorStop(1, 'rgba(223,242,250,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - meteor.glow, y - meteor.glow, meteor.glow * 2, meteor.glow * 2);
    ctx.fillStyle = `rgba(249,250,233,${alpha})`; ctx.beginPath(); ctx.arc(x, y, meteor.thickness * .8, 0, TAU); ctx.fill();
  }
}

function drawWater(ctx, event, scene, envelope, time) {
  const { left, sceneWidth, horizon, bottom, sun } = scene;
  const seaSpace = Math.max(0, bottom - horizon - 12);
  if (seaSpace <= 8) return;
  const light = event.kind === 'birds' ? '255,238,174' : '191,225,245';
  for (let i = 0; i < 23; i++) {
    const depth = i / 22, y = horizon + 7 + depth * seaSpace * .87;
    const spread = (8 + depth * Math.min(80, sceneWidth * .21)) * (.7 + .3 * Math.sin(i * 2.37 + time * 1.5 + event.lightPhase));
    const x = sun.x + Math.sin(i * 1.8 + time) * (3 + depth * 9);
    ctx.strokeStyle = `rgba(${light},${envelope * (.27 - depth * .11)})`; ctx.lineWidth = 1 + depth * 2.2;
    ctx.beginPath(); ctx.moveTo(x - spread, y); ctx.quadraticCurveTo(x, y + Math.sin(time * 1.4 + i) * 2.4, x + spread, y); ctx.stroke();
  }
  for (const speck of event.sparkles) {
    const x = left + 9 + speck.x * Math.max(1, sceneWidth - 18);
    const y = horizon + 10 + speck.y * Math.max(1, seaSpace - 10);
    const alpha = envelope * Math.max(0, Math.sin(time * 2.8 + speck.phase)) ** 3 * .7;
    if (alpha < .02) continue;
    const size = speck.size * (.65 + speck.y * .5);
    ctx.strokeStyle = `rgba(${light},${alpha})`; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(x - size * 1.8, y); ctx.lineTo(x + size * 1.8, y);
    ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const expansion = clamp((event.progress - .15 - i * .18) / .42);
    if (expansion <= 0 || expansion >= 1) continue;
    const x = left + sceneWidth * event.rippleX, y = horizon + seaSpace * (.31 + i * .07);
    ctx.strokeStyle = `rgba(${light},${Math.sin(expansion * Math.PI) * envelope * .32})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x, y, 10 + expansion * Math.min(95, sceneWidth * .34), 2.5 + expansion * 9, 0, 0, TAU); ctx.stroke();
  }
}

/** Paint only: no timers, DOM access, mutation or random calls. */
export function drawSkyEvent(ctx, event, layout) {
  if (!event) return;
  const progress = clamp(event.progress ?? 0);
  if (progress >= 1) return;
  const scene = resolveLayout({ ...layout, sceneBounds: event.sceneBounds || layout.sceneBounds });
  const { width, left, top, bottom, sceneWidth, sun } = scene;
  const envelope = smooth(0, .12, progress) * (1 - smooth(.84, 1, progress));
  const time = progress * event.duration;
  const daylight = event.kind === 'birds';
  ctx.save();
  const edgeRoom = Math.max(1, Math.min(sun.x - left, width - sun.x, sun.y - top, bottom - sun.y) - 1);
  const haloRadius = Math.max(1, Math.min(sceneWidth * .52, sun.radius * 4.5, edgeRoom));
  const halo = ctx.createRadialGradient(sun.x, sun.y, Math.min(sun.radius * .5, haloRadius * .3), sun.x, sun.y, haloRadius);
  halo.addColorStop(0, daylight ? `rgba(255,235,164,${envelope * .28})` : `rgba(173,206,237,${envelope * .16})`);
  halo.addColorStop(1, 'rgba(210,229,236,0)');
  ctx.fillStyle = halo; ctx.fillRect(sun.x - haloRadius, sun.y - haloRadius, haloRadius * 2, haloRadius * 2);
  // The protected left/top edge stays outside the profile. The right edge is
  // the full viewport, so birds are never clipped at the narrower content wrap.
  ctx.beginPath(); ctx.rect(left, top, width - left, bottom - top); ctx.clip();
  if (daylight) {
    for (const bird of event.birds) drawBird(ctx, bird, getBirdPose(bird, progress, scene));
    ctx.strokeStyle = `rgba(255,235,170,${envelope * .34})`; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const angle = i * TAU / 10 + .12, inner = sun.radius * 1.35;
      const outer = inner + 7 + Math.sin(progress * Math.PI) * 8;
      ctx.beginPath(); ctx.moveTo(sun.x + Math.cos(angle) * inner, sun.y + Math.sin(angle) * inner);
      ctx.lineTo(sun.x + Math.cos(angle) * outer, sun.y + Math.sin(angle) * outer); ctx.stroke();
    }
  } else {
    drawConstellations(ctx, event, scene, envelope, time);
    drawMeteors(ctx, event, scene, envelope);
  }
  drawWater(ctx, event, scene, envelope, time);
  ctx.restore();
}
