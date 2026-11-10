// A small, dependency-free illustrated sea. Animation and input belong to seaside.js.
const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const rgb = (day, night, amount, alpha = 1) => `rgba(${day.map((v, i) => Math.round(mix(v, night[i], amount))).join(',')},${alpha})`;

/** The same gentle swell carries both the water and each boat. */
export function sampleWave(x, y, time, horizon, height) {
  const depth = clamp((y - horizon) / Math.max(1, height - horizon));
  const amplitude = 1.1 + depth * 3.3;
  const a = x * .014 + time * .62 + depth * 8;
  const b = x * .031 - time * .39 + depth * 13;
  return {
    lift: amplitude * (Math.sin(a) * .72 + Math.sin(b) * .28),
    roll: clamp(amplitude * (.014 * Math.cos(a) * .72 + .031 * Math.cos(b) * .28), -.055, .055),
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

  function resize(nextWidth, nextHeight, dpr = 1) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    ratio = clamp(dpr, 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function sky(time, night, horizon, sun) {
    const fill = ctx.createLinearGradient(0, 0, 0, horizon + 30);
    fill.addColorStop(0, rgb([178, 211, 224], [20, 39, 63], night));
    fill.addColorStop(.65, rgb([207, 228, 232], [39, 62, 83], night));
    fill.addColorStop(1, rgb([237, 237, 218], [74, 95, 113], night));
    ctx.fillStyle = fill; ctx.fillRect(0, 0, width, horizon + 30);

    if (night > .005) {
      for (const star of stars) {
        const y = 28 + star.y * Math.max(1, horizon - 72);
        const alpha = night * (.25 + .3 * (.5 + .5 * Math.sin(time * .27 + star.phase)));
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

    const { x, y, radius: r } = sun;
    const halo = ctx.createRadialGradient(x, y, r * .45, x, y, r * 3.6);
    halo.addColorStop(0, rgb([255, 238, 173], [196, 219, 230], night, .19));
    halo.addColorStop(1, rgb([255, 238, 173], [196, 219, 230], night, 0));
    ctx.fillStyle = halo; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    if (night < .999) {
      ctx.globalAlpha = 1 - night;
      const disk = ctx.createLinearGradient(0, y - r, 0, y + r);
      disk.addColorStop(0, '#fff2c4'); disk.addColorStop(1, '#efd9aa');
      ctx.fillStyle = disk; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    if (night > .001) {
      ctx.globalAlpha = night;
      ctx.fillStyle = '#e5eee9';
      ctx.beginPath();
      ctx.moveTo(x + r * .5, y - r * .866);
      ctx.arc(x, y, r, -Math.PI / 3, Math.PI / 3, true);
      ctx.bezierCurveTo(x - r * .5, y + r * .53, x - r * .5, y - r * .53, x + r * .5, y - r * .866);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function sea(time, night, horizon, sun) {
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
      const thickness = 2 + depth * 26;
      const gradient = ctx.createLinearGradient(0, y - 6, 0, y + thickness);
      gradient.addColorStop(0, rgb([210, 237, 229], [156, 194, 205], night, .065 + depth * .045));
      gradient.addColorStop(1, rgb([88, 153, 169], [42, 79, 104], night, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      for (let x = -25; x <= width + 25; x += 22) {
        const wave = sampleWave(x, y, time, horizon, height);
        if (x === -25) ctx.moveTo(x, y + wave.lift); else ctx.lineTo(x, y + wave.lift);
      }
      ctx.lineTo(width + 25, y + thickness); ctx.lineTo(-25, y + thickness); ctx.closePath(); ctx.fill();
    }

    // A broken, widening light path belongs to the sun/moon above it.
    for (let i = 0; i < 31; i++) {
      const depth = (i / 31) ** 1.65;
      const y = horizon + 2 + depth * seaHeight;
      const spread = 3 + depth * Math.min(115, width * .17);
      const drift = Math.sin(i * 2.4 + time * .44) * spread * .32;
      const half = spread * (.33 + .23 * Math.sin(i * 3.83 + time * .21));
      const alpha = (.17 - depth * .11) * (.7 + .3 * Math.sin(i * 1.8 + time * .5));
      ctx.strokeStyle = rgb([255, 239, 187], [200, 224, 231], night, alpha);
      ctx.lineWidth = 1 + depth * 2.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sun.x + drift - half, y);
      ctx.quadraticCurveTo(sun.x + drift, y + Math.sin(i + time * .5) * 1.8, sun.x + drift + half, y);
      ctx.stroke();
    }

    // Short curved wave crests, with distant crests smaller and closer together.
    for (const glint of glints) {
      const depth = glint.depth ** 1.55;
      const x = glint.x * width + Math.sin(time * .21 + glint.phase) * (2 + depth * 7);
      const y = horizon + 7 + depth * (seaHeight - 8);
      const lift = sampleWave(x, y, time, horizon, height).lift;
      const length = glint.length * (.25 + depth * 1.1);
      const alpha = .055 + .06 * (.5 + .5 * Math.sin(time * .4 + glint.phase));
      ctx.strokeStyle = rgb([222, 244, 235], [175, 211, 222], night, alpha);
      ctx.lineWidth = .65 + depth * .55;
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
    for (let i = 0; i < 3; i++) {
      const travel = (time * 4 + i * 18 + phase * 7) % 55;
      ctx.strokeStyle = rgb([229, 247, 238], [158, 201, 216], night, .14 * (1 - travel / 65));
      ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(-25 - travel, 2 - i * 1.8);
      ctx.quadraticCurveTo(-39 - travel, 1 + Math.sin(time + i) * 1.5, -49 - travel, 3 + i * 1.2);
      ctx.stroke();
    }
    ctx.fillStyle = rgb([36, 93, 109], [5, 28, 46], night, .17);
    ctx.beginPath(); ctx.ellipse(0, 1.5, 27, 3.2, 0, 0, TAU); ctx.fill();

    // Break the reflection into strips, so the paper is visibly sitting in water.
    ctx.save();
    ctx.globalAlpha = opacity * mix(.15, .2, night);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const offset = Math.sin(time * .8 + phase + i) * 2;
      ctx.rect(-37 + offset, 3 + i * 2.7, 74, 1.5);
    }
    ctx.clip(); ctx.translate(Math.sin(time * .7 + phase) * 1.4, 3); ctx.scale(1, -.34); ctx.rotate(-roll * .5);
    paperBody(ctx, night); ctx.restore();

    ctx.save(); ctx.rotate(roll); paperBody(ctx, night); ctx.restore();
    ctx.strokeStyle = rgb([222, 241, 229], [170, 206, 217], night, .27);
    ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-27, 1.2);
    ctx.quadraticCurveTo(-3, 3.7 + Math.sin(time * .7 + phase), 25, 1.6); ctx.stroke();
    ctx.restore();
  }

  function event(event, night, horizon, sun) {
    if (!event) return;
    const progress = clamp(event.progress);
    const alpha = Math.sin(progress * Math.PI);
    if (event.kind === 'birds') {
      // On a narrow page the visible sky starts below the profile card, so
      // anchor passing visitors to the actual sun/moon rather than page height.
      const startX = Math.max(width * .08, sun.x - Math.min(210, width * .56));
      const x = mix(startX, width + 12, progress);
      const startY = Math.min(horizon - 35, sun.y + sun.radius * .8);
      const y = startY - Math.sin(progress * Math.PI) * Math.min(18, sun.radius * .6);
      ctx.strokeStyle = rgb([77, 119, 133], [189, 212, 219], night, alpha * .7);
      ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const bx = x + i * 26; const by = y + (i % 2) * 15;
        const wing = 3 + Math.sin(progress * 19 + i * .8) * 2.7;
        ctx.beginPath(); ctx.moveTo(bx - 9, by - wing); ctx.quadraticCurveTo(bx - 4, by - 4, bx, by);
        ctx.quadraticCurveTo(bx + 4, by - 4, bx + 9, by - wing); ctx.stroke();
      }
    } else if (event.kind === 'meteor') {
      const x = mix(Math.min(width - 22, sun.x + sun.radius), Math.max(18, sun.x - Math.min(220, width * .5)), progress);
      const y = mix(Math.max(22, sun.y - sun.radius * 1.5), Math.min(horizon - 24, sun.y + sun.radius * 1.8), progress);
      const length = Math.min(width * .13, 100);
      const trail = ctx.createLinearGradient(x + length, y - length * .5, x, y);
      trail.addColorStop(0, 'rgba(225,241,239,0)'); trail.addColorStop(1, `rgba(225,241,239,${alpha * .8})`);
      ctx.strokeStyle = trail; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x + length, y - length * .5); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(243,247,229,${alpha})`; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.fill();
    }
  }

  function render({ time = 0, night = 0, horizon = height * .42, celestial, boats = [], skyEvent = null } = {}) {
    if (disposed) return;
    night = clamp(night);
    horizon = clamp(horizon, 70, Math.max(70, height - 30));
    const sun = celestial || { x: width * .83, y: horizon * .45, radius: Math.min(30, width * .065) };
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalAlpha = 1;
    sky(time, night, horizon, sun);
    sea(time, night, horizon, sun);
    event(skyEvent, night, horizon, sun);
    [...boats].sort((a, b) => a.y - b.y).forEach(item => boat(item, time, night));
  }

  return { resize, render, destroy() { disposed = true; } };
}
