import { drawSkyEvent } from './sky-effects.js?v=20261111-moonlight';
import { drawCandleWater, drawBoatCandle } from './boat-candle.js?v=20261111-living';

// A small, dependency-free illustrated sea. Animation and input belong to seaside.js.
const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const rgb = (day, night, amount, alpha = 1) => `rgba(${day.map((v, i) => Math.round(mix(v, night[i], amount))).join(',')},${alpha})`;
const smooth = (start, end, value) => { const t = clamp((value - start) / (end - start)); return t * t * (3 - 2 * t); };

// One reversible path: the sun crosses the horizon before the moon rises.
export function getCelestialCycle(night, horizon, anchor, width) {
  const phase = clamp(night);
  const sunset = smooth(0, .55, phase);
  const moonrise = smooth(.43, 1, phase);
  const below = horizon + anchor.radius * 1.45;
  const arc = Math.min(70, width * .085);
  return {
    sun: { ...anchor, x: anchor.x - Math.sin(sunset * Math.PI / 2) * arc, y: mix(anchor.y, below, sunset) },
    moon: { ...anchor, x: anchor.x - Math.sin((1 - moonrise) * Math.PI / 2) * arc, y: mix(below, anchor.y, moonrise) },
    stars: smooth(.48, .94, phase),
    dusk: Math.sin(phase * Math.PI) ** 4,
  };
}

/** Reflect only the visible part of the celestial body, including its last rim. */
export function getReflectionStrength(body, horizon, anchor) {
  const radius = Math.max(1, body.radius);
  const above = horizon - body.y;
  const visibleDisc = smooth(-radius, radius, above);
  const altitude = clamp(above / Math.max(radius * 2, horizon - anchor.y));
  return visibleDisc * (.42 + .58 * smooth(0, 1, altitude));
}

/** The same gentle swell carries both the water and each boat. */
export function sampleWave(x, y, time, horizon, height) {
  const depth = clamp((y - horizon) / Math.max(1, height - horizon));
  const amplitude = 1.6 + depth * 8.2;
  const a = x * .012 + time * 1.05 + depth * 8;
  const b = x * .026 - time * .78 + depth * 13;
  return {
    lift: amplitude * (Math.sin(a) * .72 + Math.sin(b) * .28),
    roll: clamp(amplitude * (.012 * Math.cos(a) * .72 + .026 * Math.cos(b) * .28), -.07, .07),
  };
}

function paperBody(ctx, night) {
  // The hull and the raised fold are separate planes, rather than an icon outline.
  ctx.lineJoin = 'round';
  ctx.lineWidth = .7;
  const polygon = (points, fill, stroke = null) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  };
  polygon([[-34, -13], [-10, -29], [15, -12]], rgb([207, 222, 220], [161, 189, 199], night));
  polygon([[-24, -13], [-3, -41], [1, -10]], rgb([252, 248, 231], [222, 233, 229], night));
  polygon([[-3, -41], [25, -13], [1, -10]], rgb([232, 237, 222], [183, 209, 215], night));
  polygon([[-35, -14], [1, -7], [35, -14], [21, 0], [-21, 0]], rgb([230, 237, 226], [187, 211, 214], night));
  polygon([[-35, -14], [1, -7], [-21, 0]], rgb([250, 248, 232], [217, 230, 225], night));
  polygon([[1, -7], [35, -14], [21, 0]], rgb([195, 219, 214], [151, 184, 195], night));
  ctx.beginPath(); ctx.moveTo(-34, -14); ctx.lineTo(1, -7); ctx.lineTo(34, -14);
  ctx.strokeStyle = rgb([133, 167, 167], [106, 147, 164], night, .45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, -40); ctx.lineTo(1, -11);
  ctx.strokeStyle = rgb([178, 194, 182], [139, 172, 181], night, .45); ctx.stroke();
}

export function createOceanRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  let width = 1;
  let height = 1;
  let ratio = 1;
  let disposed = false;
  // Fixed scatter positions avoid flicker and allocating random particles per frame.
  const stars = Array.from({ length: 48 }, (_, index) => ({
    x: ((index * 137.508 + 37) % 997) / 997,
    y: ((index * 79.73 + 23) % 173) / 173,
    radius: index % 9 === 0 ? 1.4 : index % 3 === 0 ? 1 : .65,
    phase: index * 1.81,
  }));
  const glints = Array.from({ length: 100 }, (_, index) => ({
    x: ((index * 123.417 + 19) % 997) / 997,
    depth: ((index * 71.113 + 31) % 997) / 997,
    length: 5 + (index * 17 % 27),
    phase: index * 2.33,
  }));
  const reflectionRows = Array.from({ length: 56 }, (_, index) => ({
    fraction: (index + .35) / 56,
    phase: index * 2.39996,
    offset: Math.sin(index * 4.713),
  }));

  function resize(nextWidth, nextHeight, dpr = 1) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    ratio = clamp(dpr, 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function celestialReflection(time, kind, body, horizon, anchor) {
    const strength = getReflectionStrength(body, horizon, anchor);
    if (strength < .001) return;
    const moon = kind === 'moon';
    const seaHeight = Math.max(1, height - horizon);
    const compact = width < 600;
    const brightness = strength * (compact ? .78 : 1);
    const spreadMax = Math.min(compact ? 76 : 165, width * .22);
    const warm = [255, 222, 148], cool = [165, 212, 237];
    const coreWarm = [255, 245, 204], coreCool = [225, 244, 248];
    ctx.save(); ctx.beginPath(); ctx.rect(0, horizon, width, seaHeight); ctx.clip();
    ctx.lineCap = 'round';

    for (let i = 0; i < reflectionRows.length; i++) {
      // Fewer far-water slivers on small displays, without changing their phase.
      if (compact && i % 4 === 3) continue;
      const row = reflectionRows[i];
      const depth = row.fraction ** 1.62;
      const baseY = horizon + 2 + depth * Math.max(1, seaHeight - 4);
      const wave = sampleWave(body.x, baseY, time, horizon, height);
      const span = 3.5 + depth ** .85 * spreadMax;
      const centre = body.x + Math.sin(time * .54 + row.phase) * span * .16 + wave.lift * .8;
      const y = baseY + wave.lift * .6;
      const breath = .68 + .32 * Math.sin(time * .93 + row.phase);

      // A feathered underglow is split into wave-width patches rather than a
      // solid beam. Its edges are transparent even on a narrow viewport.
      const wash = ctx.createLinearGradient(centre - span, y, centre + span, y);
      wash.addColorStop(0, rgb(warm, cool, Number(moon), 0));
      wash.addColorStop(.38, rgb(warm, cool, Number(moon), brightness * (.075 - depth * .025) * breath));
      wash.addColorStop(.62, rgb(warm, cool, Number(moon), brightness * (.075 - depth * .025) * breath));
      wash.addColorStop(1, rgb(warm, cool, Number(moon), 0));
      ctx.strokeStyle = wash; ctx.lineWidth = 3 + depth * 7;
      ctx.beginPath(); ctx.moveTo(centre - span, y);
      ctx.quadraticCurveTo(centre, y + wave.roll * span * .3, centre + span, y); ctx.stroke();

      // Alternate a split crest and an off-centre crest. Unequal bright pieces
      // leave water between them, and all pieces move with sampleWave().
      const split = i % 3 !== 1;
      const fragments = split ? 2 : 1;
      for (let part = 0; part < fragments; part++) {
        const side = split ? (part ? 1 : -1) : row.offset * .4;
        const shimmer = .7 + .3 * Math.sin(time * 1.12 + row.phase + part * 1.7);
        const offset = side * span * (.38 + .1 * Math.sin(time * .65 + row.phase));
        const half = span * (split ? .14 + shimmer * .12 : .31 + shimmer * .12);
        const x = centre + offset;
        const localWave = sampleWave(x, baseY, time, horizon, height);
        const py = baseY + localWave.lift * .6 + (part ? 1 + depth * 1.5 : 0);
        const alpha = brightness * (.40 - depth * .12) * shimmer;
        const reflection = ctx.createLinearGradient(x - half, py, x + half, py);
        reflection.addColorStop(0, rgb(warm, cool, Number(moon), 0));
        reflection.addColorStop(.2, rgb(warm, cool, Number(moon), alpha * .75));
        reflection.addColorStop(.5, rgb(coreWarm, coreCool, Number(moon), alpha));
        reflection.addColorStop(.8, rgb(warm, cool, Number(moon), alpha * .75));
        reflection.addColorStop(1, rgb(warm, cool, Number(moon), 0));
        ctx.strokeStyle = reflection; ctx.lineWidth = .9 + depth * 3.5;
        ctx.beginPath(); ctx.moveTo(x - half, py);
        ctx.quadraticCurveTo(x, py + localWave.roll * half * .6, x + half, py); ctx.stroke();
      }

      // A few crests briefly catch the light. They use the same simulation
      // clock, so pausing or slowing the water also settles these highlights.
      if (i % 4 === 0) {
        const glimmer = Math.max(0, Math.sin(time * 1.16 + row.phase)) ** 6;
        if (glimmer > .08) {
          const x = centre + row.offset * span * .35;
          const half = 1.8 + depth * 5;
          ctx.strokeStyle = rgb(coreWarm, coreCool, Number(moon), brightness * glimmer * .6);
          ctx.lineWidth = .8 + depth * .7;
          ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function sky(time, night, horizon, anchor, cycle) {
    const fill = ctx.createLinearGradient(0, 0, 0, horizon + 30);
    fill.addColorStop(0, rgb([178, 211, 224], [20, 39, 63], night));
    fill.addColorStop(.65, rgb([207, 228, 232], [39, 62, 83], night));
    const baseHorizon = [237, 237, 218].map((v, i) => mix(v, [74, 95, 113][i], night));
    fill.addColorStop(1, rgb(baseHorizon, [235, 178, 142], cycle.dusk * .55));
    ctx.fillStyle = fill; ctx.fillRect(0, 0, width, horizon + 30);

    if (cycle.stars > .005) {
      for (const star of stars) {
        const reveal = smooth(star.x * .18, .8 + star.x * .18, cycle.stars);
        const y = 28 + star.y * Math.max(1, horizon - 72) + (1 - reveal) * Math.min(42, (horizon - anchor.y) * .35);
        const alpha = reveal * (.25 + .3 * (.5 + .5 * Math.sin(time * .27 + star.phase)));
        ctx.fillStyle = `rgba(231,240,239,${alpha})`;
        ctx.beginPath(); ctx.arc(star.x * width, y, star.radius, 0, TAU); ctx.fill();
      }
    }

    // Broad soft clouds travel slowly enough to read as weather, not UI motion.
    for (let i = 0; i < 4; i++) {
      const cloudWidth = Math.min(190, width * .28) * (i % 2 ? .72 : 1);
      const x = ((width * (.16 + i * .29) + Math.sin(time * .025 + i) * 10) % (width + cloudWidth)) - cloudWidth * .35;
      const y = horizon * (.32 + (i % 3) * .19);
      ctx.fillStyle = rgb([251, 251, 240], [126, 149, 164], night, mix(.36, .035, night));
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.bezierCurveTo(x - 6, y - 2, x + cloudWidth * .16, y - 4, x + cloudWidth * .24, y - 4);
      ctx.bezierCurveTo(x + cloudWidth * .3, y - 24, x + cloudWidth * .55, y - 22, x + cloudWidth * .63, y - 7);
      ctx.bezierCurveTo(x + cloudWidth * .78, y - 14, x + cloudWidth * .91, y - 4, x + cloudWidth, y + 7);
      ctx.bezierCurveTo(x + cloudWidth * .66, y + 12, x + cloudWidth * .22, y + 12, x, y + 8);
      ctx.fill();
    }

    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, horizon); ctx.clip();
    for (const [kind, body] of [['sun', cycle.sun], ['moon', cycle.moon]]) {
      const { x, y, radius: r } = body;
      if (y - r >= horizon) continue;
      const moon = kind === 'moon';
      const edge = clamp((horizon + r - y) / (r * 2));
      const halo = ctx.createRadialGradient(x, y, r * .45, x, y, r * 3.6);
      halo.addColorStop(0, rgb([255, 224, 157], [196, 219, 230], Number(moon), .19 * edge));
      halo.addColorStop(1, rgb([255, 224, 157], [196, 219, 230], Number(moon), 0));
      ctx.fillStyle = halo; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      if (!moon) {
        const disk = ctx.createLinearGradient(0, y - r, 0, y + r);
        disk.addColorStop(0, rgb([255, 242, 196], [255, 210, 153], cycle.dusk));
        disk.addColorStop(1, rgb([239, 217, 170], [229, 162, 123], cycle.dusk));
        ctx.fillStyle = disk; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#e5eee9'; ctx.beginPath();
        ctx.moveTo(x + r * .5, y - r * .866);
        ctx.arc(x, y, r, -Math.PI / 3, Math.PI / 3, true);
        ctx.bezierCurveTo(x - r * .5, y + r * .53, x - r * .5, y - r * .53, x + r * .5, y - r * .866);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function sea(time, night, horizon, anchor, cycle) {
    const seaHeight = Math.max(1, height - horizon);
    const water = ctx.createLinearGradient(0, horizon, 0, height);
    water.addColorStop(0, rgb([128, 181, 190], [64, 100, 120], night));
    water.addColorStop(.32, rgb([101, 165, 178], [42, 80, 104], night));
    water.addColorStop(1, rgb([77, 142, 161], [25, 58, 82], night));
    ctx.fillStyle = water; ctx.fillRect(0, horizon, width, seaHeight);

    // These broad shallow swells share the boat's displacement function.
    const bands = 17;
    for (let i = 0; i < bands; i++) {
      const depth = (i / (bands - 1)) ** 1.7;
      const y = horizon + depth * seaHeight;
      const thickness = 3 + depth * 34;
      const gradient = ctx.createLinearGradient(0, y - 6, 0, y + thickness);
      gradient.addColorStop(0, rgb([210, 237, 229], [156, 194, 205], night, .13 + depth * .085));
      gradient.addColorStop(1, rgb([88, 153, 169], [42, 79, 104], night, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      for (let x = -25; x <= width + 25; x += 22) {
        const wave = sampleWave(x, y, time, horizon, height);
        if (x === -25) ctx.moveTo(x, y + wave.lift); else ctx.lineTo(x, y + wave.lift);
      }
      ctx.lineTo(width + 25, y + thickness); ctx.lineTo(-25, y + thickness); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgb([224, 242, 232], [168, 204, 218], night, .075 + depth * .13);
      ctx.lineWidth = .65 + depth * 1.3;
      ctx.beginPath();
      for (let x = -25; x <= width + 25; x += 22) {
        const lift = sampleWave(x, y, time, horizon, height).lift;
        if (x === -25) ctx.moveTo(x, y + lift); else ctx.lineTo(x, y + lift);
      }
      ctx.stroke();
    }

    celestialReflection(time, 'sun', cycle.sun, horizon, anchor);
    celestialReflection(time, 'moon', cycle.moon, horizon, anchor);

    // Short curved wave crests, with distant crests smaller and closer together.
    for (const glint of glints) {
      const depth = glint.depth ** 1.55;
      const x = glint.x * width + Math.sin(time * .49 + glint.phase) * (3 + depth * 13);
      const y = horizon + 7 + depth * (seaHeight - 8);
      const lift = sampleWave(x, y, time, horizon, height).lift;
      const length = glint.length * (.35 + depth * 1.35);
      const alpha = .10 + .12 * (.5 + .5 * Math.sin(time * .85 + glint.phase));
      ctx.strokeStyle = rgb([222, 244, 235], [175, 211, 222], night, alpha);
      ctx.lineWidth = .8 + depth * .85;
      ctx.beginPath(); ctx.moveTo(x, y + lift);
      ctx.quadraticCurveTo(x + length * .5, y + lift - 1.2 - depth, x + length, y + lift);
      ctx.stroke();
    }

    const haze = ctx.createLinearGradient(0, horizon - 2, 0, horizon + 14);
    haze.addColorStop(0, rgb([234, 239, 221], [107, 132, 147], night, .35));
    haze.addColorStop(1, rgb([234, 239, 221], [107, 132, 147], night, 0));
    ctx.fillStyle = haze; ctx.fillRect(0, horizon - 2, width, 16);
  }

  function boat(boat, time, night) {
    const { x, y, scale = 1, roll = 0, opacity = 1, phase = 0 } = boat;
    if (opacity <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.globalAlpha = opacity;

    drawCandleWater(ctx, time, night, phase);

    // The wake sits on the water plane instead of rotating with the folded paper.
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const travel = (time * 9 + i * 15 + phase * 7) % 76;
      const dissolve = Math.sin(travel / 76 * Math.PI);
      ctx.strokeStyle = rgb([229, 247, 238], [174, 216, 228], night, .32 * dissolve);
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-22 - travel, 1 - travel * .065);
      ctx.quadraticCurveTo(-35 - travel, Math.sin(time * 1.1 + i) * 2, -48 - travel, 2 + travel * .065);
      ctx.stroke();
    }
    ctx.fillStyle = rgb([36, 93, 109], [5, 28, 46], night, .24);
    ctx.beginPath(); ctx.ellipse(0, 1.8, 29, 3.9, 0, 0, TAU); ctx.fill();

    // Break the reflection into strips, so the paper is visibly sitting in water.
    ctx.save();
    ctx.globalAlpha = opacity * mix(.25, .34, night);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const offset = Math.sin(time * 1.1 + phase + i) * (2 + i * .35);
      ctx.rect(-37 + offset, 3 + i * 3.1, 74, 1.9);
    }
    ctx.clip(); ctx.translate(Math.sin(time * 1.1 + phase) * 2.3, 3); ctx.scale(1, -.45); ctx.rotate(-roll * .5);
    paperBody(ctx, night); ctx.restore();

    ctx.save(); ctx.rotate(roll); paperBody(ctx, night); drawBoatCandle(ctx, time, night, phase); ctx.restore();
    ctx.strokeStyle = rgb([234, 248, 236], [189, 224, 232], night, .45);
    ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-29, 1.2);
    ctx.quadraticCurveTo(-3, 4.2 + Math.sin(time * 1.1 + phase), 27, 1.6); ctx.stroke();
    ctx.restore();
  }

  function render({ time = 0, night = 0, horizon = height * .42, celestial, boats = [], skyEvent = null, sceneBounds = null } = {}) {
    if (disposed) return;
    night = clamp(night);
    horizon = clamp(horizon, 70, Math.max(70, height - 30));
    const sun = celestial || { x: width * .83, y: horizon * .45, radius: Math.min(30, width * .065) };
    const cycle = getCelestialCycle(night, horizon, sun, width);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalAlpha = 1;
    sky(time, night, horizon, sun, cycle);
    sea(time, night, horizon, sun, cycle);
    drawSkyEvent(ctx, skyEvent, { width, height, horizon, celestial: sun, sceneBounds: skyEvent?.sceneBounds || sceneBounds });
    [...boats].sort((a, b) => a.y - b.y).forEach(item => boat(item, time, night));
  }

  return { resize, render, destroy() { disposed = true; } };
}
