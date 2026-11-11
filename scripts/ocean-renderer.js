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
  const eventGlints = Array.from({ length: 34 }, (_, index) => ({
    x: ((index * 137.317 + 39) % 997) / 997,
    y: ((index * 89.113 + 81) % 997) / 997,
    phase: index * 2.17,
    size: 1.5 + (index % 4) * .55,
  }));
  const constellation = [[.12, .42], [.26, .2], [.43, .38], [.59, .17], [.79, .32], [.69, .67], [.48, .73]];

  function resize(nextWidth, nextHeight, dpr = 1) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    ratio = clamp(dpr, 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
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

    // A broken, widening light path belongs to the sun/moon above it.
    for (const [kind, body] of [['sun', cycle.sun], ['moon', cycle.moon]]) {
      const strength = clamp((horizon + body.radius * .3 - body.y) / Math.max(1, horizon - anchor.y));
      if (strength <= 0) continue;
      for (let i = 0; i < 31; i++) {
      const depth = (i / 31) ** 1.65;
      const y = horizon + 2 + depth * seaHeight;
      const spread = 3 + depth * Math.min(115, width * .17);
      const drift = Math.sin(i * 2.4 + time * .74) * spread * .37;
      const half = spread * (.41 + .25 * Math.sin(i * 3.83 + time * .43));
      const alpha = (.26 - depth * .14) * (.7 + .3 * Math.sin(i * 1.8 + time * .8)) * strength;
      ctx.strokeStyle = rgb([255, 225, 176], [200, 224, 231], Number(kind === 'moon'), alpha);
      ctx.lineWidth = 1 + depth * 2.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(body.x + drift - half, y);
      ctx.quadraticCurveTo(body.x + drift, y + Math.sin(i + time * .5) * 1.8, body.x + drift + half, y);
      ctx.stroke();
      }
    }

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

    ctx.save(); ctx.rotate(roll); paperBody(ctx, night); ctx.restore();
    ctx.strokeStyle = rgb([234, 248, 236], [189, 224, 232], night, .45);
    ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-29, 1.2);
    ctx.quadraticCurveTo(-3, 4.2 + Math.sin(time * 1.1 + phase), 27, 1.6); ctx.stroke();
    ctx.restore();
  }

  function event(event, night, horizon, sun, bounds) {
    if (!event) return;
    const p = clamp(event.progress);
    const envelope = smooth(0, .12, p) * (1 - smooth(.82, 1, p));
    if (envelope <= 0) return;
    const left = clamp(bounds?.left ?? Math.max(0, sun.x - Math.min(240, width * .66)), 0, width);
    const sceneWidth = clamp(bounds?.width ?? (width - left), 1, Math.max(1, width - left));
    const top = clamp(bounds?.top ?? (sun.y - sun.radius * 2.2), 0, height);
    const bottom = clamp(bounds?.bottom ?? height, top, height);
    const skyTop = Math.max(top + 5, sun.y - sun.radius * 2.2);
    const skyBottom = Math.max(skyTop + 8, horizon - 12);
    const skyHeight = skyBottom - skyTop;
    const seaSpace = Math.max(0, bottom - horizon - 12);
    const localTime = p * (event.duration || 6.5);
    const daylight = event.kind === 'birds';
    // A local glow gathers around the celestial body; there is no full-screen flash.
    // Let the gradient reach transparent before the scenic boundary. Clipping a
    // larger radial glow to the scene produced a visible rectangular edge.
    const edgeRoom = Math.max(1, Math.min(sun.x - left, left + sceneWidth - sun.x, sun.y - top, bottom - sun.y) - 1);
    const haloRadius = Math.max(1, Math.min(sceneWidth * .52, sun.radius * 4.5, edgeRoom));
    const halo = ctx.createRadialGradient(sun.x, sun.y, Math.min(sun.radius * .5, haloRadius * .3), sun.x, sun.y, haloRadius);
    halo.addColorStop(0, daylight ? `rgba(255,235,164,${envelope * .28})` : `rgba(173,206,237,${envelope * .16})`);
    halo.addColorStop(1, 'rgba(210,229,236,0)');
    ctx.fillStyle = halo; ctx.fillRect(sun.x - haloRadius, sun.y - haloRadius, haloRadius * 2, haloRadius * 2);
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, sceneWidth, bottom - top); ctx.clip();

    if (daylight) {
      // A seven-bird formation flies through the patch of sky the visitor can see.
      for (let i = 0; i < 7; i++) {
        const flight = clamp((p - .07 - i * .025) / .77);
        const alpha = Math.sin(flight * Math.PI) * envelope;
        if (alpha <= .001) continue;
        const bx = left + mix(-sceneWidth * .12, sceneWidth * 1.14, flight);
        const by = skyTop + skyHeight * (.57 + Math.sin(i * 1.7) * .14) - Math.sin(flight * Math.PI) * Math.min(19, skyHeight * .17);
        const size = (10 + (i % 3) * 2.2) * clamp(sceneWidth / 310, .8, 1.12);
        const wing = size * (.22 + Math.sin(localTime * 5.1 + i * .65) * .47);
        const wings = () => {
          ctx.beginPath(); ctx.moveTo(bx - size, by - wing);
          ctx.bezierCurveTo(bx - size * .72, by - wing - 1, bx - size * .33, by - 2, bx, by + 1.4);
          ctx.bezierCurveTo(bx + size * .33, by - 2, bx + size * .72, by - wing - 1, bx + size, by - wing);
        };
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        wings(); ctx.strokeStyle = `rgba(55,100,118,${alpha * .65})`; ctx.lineWidth = 3.2; ctx.stroke();
        wings(); ctx.strokeStyle = `rgba(253,251,236,${alpha * .94})`; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = `rgba(249,246,228,${alpha})`;
        ctx.beginPath(); ctx.ellipse(bx, by + 1, 2.3, 1.5, 0, 0, TAU); ctx.fill();
      }
      const warmth = envelope * (.7 + .3 * Math.sin(p * Math.PI));
      ctx.strokeStyle = `rgba(255,235,170,${warmth * .34})`; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const angle = i * TAU / 10 + .12;
        const inner = sun.radius * 1.35;
        const outer = inner + 7 + Math.sin(p * Math.PI) * 8;
        ctx.beginPath(); ctx.moveTo(sun.x + Math.cos(angle) * inner, sun.y + Math.sin(angle) * inner);
        ctx.lineTo(sun.x + Math.cos(angle) * outer, sun.y + Math.sin(angle) * outer); ctx.stroke();
      }
    } else {
      // A little constellation is gradually traced, then several meteors pass it.
      for (let i = 0; i < constellation.length; i++) {
        const star = constellation[i];
        const x = left + sceneWidth * star[0];
        const y = skyTop + skyHeight * star[1];
        const reveal = smooth(.02 + i * .035, .16 + i * .035, p) * envelope;
        if (i > 0) {
          const previous = constellation[i - 1];
          const trace = smooth(.06 + i * .035, .2 + i * .035, p);
          const px = left + sceneWidth * previous[0], py = skyTop + skyHeight * previous[1];
          ctx.strokeStyle = `rgba(172,211,235,${reveal * .46})`; ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(mix(px, x, trace), mix(py, y, trace)); ctx.stroke();
        }
        const twinkle = .68 + .32 * Math.sin(localTime * 2.7 + i);
        const radius = (i % 3 === 0 ? 2.7 : 1.8) * (.85 + twinkle * .15);
        ctx.fillStyle = `rgba(239,245,226,${reveal * twinkle})`;
        ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(216,237,244,${reveal * .75})`; ctx.lineWidth = 1.1;
        const arm = radius * 2.3;
        ctx.beginPath(); ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y); ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm); ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const flight = clamp((p - .16 - i * .15) / .28);
        if (flight <= 0 || flight >= 1) continue;
        const alpha = Math.sin(flight * Math.PI) * envelope;
        const x = left + sceneWidth * mix(.91 - i * .035, .13 + i * .08, flight);
        const y = skyTop + skyHeight * mix(.06 + i * .085, .75 + (i % 2) * .12, flight);
        const length = Math.min(sceneWidth * (.23 - i * .024), 105);
        const trail = ctx.createLinearGradient(x + length, y - length * .35, x, y);
        trail.addColorStop(0, 'rgba(213,235,248,0)'); trail.addColorStop(.7, `rgba(194,223,244,${alpha * .35})`);
        trail.addColorStop(1, `rgba(244,248,231,${alpha})`);
        ctx.strokeStyle = trail; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + length, y - length * .35); ctx.lineTo(x, y);
        ctx.save(); ctx.globalAlpha = .24; ctx.lineWidth = 8 - i * .6; ctx.stroke(); ctx.restore();
        ctx.lineWidth = 3 - i * .3; ctx.stroke();
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 8 - i * .6);
        glow.addColorStop(0, `rgba(223,242,250,${alpha * .6})`); glow.addColorStop(1, 'rgba(223,242,250,0)');
        ctx.fillStyle = glow; ctx.fillRect(x - 8, y - 8, 16, 16);
        ctx.fillStyle = `rgba(249,250,233,${alpha})`; ctx.beginPath(); ctx.arc(x, y, 2.7 - i * .25, 0, TAU); ctx.fill();
      }
    }

    // The sky responds in the water too: an illuminated path, sparkles and three
    // low, widening ripples all stay inside the scenic part of the homepage.
    if (seaSpace > 8) {
      const light = daylight ? [255, 238, 174] : [191, 225, 245];
      for (let i = 0; i < 23; i++) {
        const depth = i / 22;
        const y = horizon + 7 + depth * seaSpace * .87;
        const spread = (8 + depth * Math.min(80, sceneWidth * .21)) * (.7 + .3 * Math.sin(i * 2.37 + localTime * 1.5));
        const x = sun.x + Math.sin(i * 1.8 + localTime) * (3 + depth * 9);
        ctx.strokeStyle = `rgba(${light.join(',')},${envelope * (.27 - depth * .11)})`;
        ctx.lineWidth = 1 + depth * 2.2; ctx.beginPath(); ctx.moveTo(x - spread, y);
        ctx.quadraticCurveTo(x, y + Math.sin(localTime * 1.4 + i) * 2.4, x + spread, y); ctx.stroke();
      }
      for (const speck of eventGlints) {
        const x = left + 9 + speck.x * Math.max(1, sceneWidth - 18);
        const y = horizon + 10 + speck.y * Math.max(1, seaSpace - 10);
        const pulse = Math.max(0, Math.sin(localTime * 2.8 + speck.phase)) ** 3;
        const alpha = envelope * pulse * .7;
        if (alpha < .02) continue;
        const size = speck.size * (.65 + speck.y * .5);
        ctx.strokeStyle = `rgba(${light.join(',')},${alpha})`; ctx.lineWidth = .9;
        ctx.beginPath(); ctx.moveTo(x - size * 1.8, y); ctx.lineTo(x + size * 1.8, y);
        ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const expansion = clamp((p - .15 - i * .18) / .42);
        if (expansion <= 0 || expansion >= 1) continue;
        const alpha = Math.sin(expansion * Math.PI) * envelope * .32;
        const x = clamp(sun.x - sceneWidth * .16, left + sceneWidth * .22, left + sceneWidth * .78);
        const y = horizon + seaSpace * (.31 + i * .07);
        const radius = 10 + expansion * Math.min(95, sceneWidth * .34);
        ctx.strokeStyle = `rgba(${light.join(',')},${alpha})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(x, y, radius, 2.5 + expansion * 9, 0, 0, TAU); ctx.stroke();
      }
    }
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
    event(skyEvent, night, horizon, sun, skyEvent?.sceneBounds || sceneBounds);
    [...boats].sort((a, b) => a.y - b.y).forEach(item => boat(item, time, night));
  }

  return { resize, render, destroy() { disposed = true; } };
}
