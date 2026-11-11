// A tiny warm light shared by the folded paper and the surrounding water.
// Both helpers inherit boat opacity; caller owns translation, scale and roll.
const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
const candleX = 20;
const candleBase = -10;

function lightLevel(time, night, phase) {
  const dusk = clamp(night);
  // Deterministic, slow changes stay still when the scene clock is paused.
  const flicker = .94 + .04 * Math.sin(time * 2.1 + phase) + .02 * Math.sin(time * 3.7 + phase * .63);
  return dusk * dusk * (3 - 2 * dusk) * flicker;
}

function ellipseLight(ctx, x, y, radiusX, radiusY, stops) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(radiusX, radiusY);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [at, color] of stops) glow.addColorStop(at, color);
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Called on the water plane, before rotating/drawing the paper body. */
export function drawCandleWater(ctx, time, night, phase = 0) {
  const light = lightLevel(time, night, phase);
  if (light <= 0) return;
  ctx.save();
  ctx.globalAlpha *= light;
  ellipseLight(ctx, candleX, 6, 60, 18, [
    [0, 'rgba(255,204,116,.28)'],
    [.35, 'rgba(247,185,88,.15)'],
    [.72, 'rgba(230,157,64,.055)'],
    [1, 'rgba(230,157,64,0)'],
  ]);
  // Small separated reflections travel across the same water plane as the wake.
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const depth = i / 7;
    const x = candleX + Math.sin(time * .9 + phase + i * 1.7) * (1.1 + depth * 3.2);
    const y = 4.5 + i * 3.4 + Math.sin(time * 1.1 + i * 1.9 + phase) * .6;
    const half = 1.7 + depth * 3.7 + Math.sin(time * .7 + phase + i * 2.2) * .75;
    ctx.strokeStyle = `rgba(255,214,139,${.42 * (1 - depth * .87)})`;
    ctx.lineWidth = 1.15 - depth * .4;
    ctx.beginPath(); ctx.moveTo(x - half, y);
    ctx.quadraticCurveTo(x, y + .7, x + half, y); ctx.stroke();
  }
  ctx.restore();
}

function clipPaper(ctx) {
  // Match the existing paper planes, so warmth never stains a rectangular area.
  const planes = [
    [[-34, -13], [-10, -29], [15, -12]],
    [[-24, -13], [-3, -41], [1, -10]],
    [[-3, -41], [25, -13], [1, -10]],
    [[-35, -14], [1, -7], [35, -14], [21, 0], [-21, 0]],
  ];
  ctx.beginPath();
  for (const points of planes) {
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
  }
  ctx.clip();
}

/** Called after the paper body, with the boat's roll already applied. */
export function drawBoatCandle(ctx, time, night, phase = 0) {
  const light = lightLevel(time, night, phase);
  if (light <= 0) return;
  const sway = Math.sin(time * 1.7 + phase) * .65 + Math.sin(time * 3.1 + phase * .7) * .2;
  const flameY = candleBase - 15;
  ctx.save();
  ctx.globalAlpha *= light;

  // Air glow has a transparent perimeter; the brighter light is clipped to paper.
  ellipseLight(ctx, candleX, flameY, 40, 38, [
    [0, 'rgba(255,205,112,.17)'],
    [.3, 'rgba(255,190,83,.085)'],
    [1, 'rgba(255,174,62,0)'],
  ]);
  ctx.save(); clipPaper(ctx);
  ellipseLight(ctx, candleX, flameY, 40, 40, [
    [0, 'rgba(255,218,137,.40)'],
    [.4, 'rgba(255,199,105,.24)'],
    [1, 'rgba(255,180,77,0)'],
  ]);
  ctx.restore();

  // A short wax candle tucked into the right side of the paper boat.
  const wax = ctx.createLinearGradient(candleX - 2.5, 0, candleX + 2.5, 0);
  wax.addColorStop(0, '#d9ac6a'); wax.addColorStop(.38, '#fff0c3'); wax.addColorStop(1, '#e8c68f');
  ctx.fillStyle = wax;
  ctx.beginPath();
  ctx.moveTo(candleX - 2.5, candleBase - 9.7);
  ctx.quadraticCurveTo(candleX, candleBase - 10.6, candleX + 2.5, candleBase - 9.7);
  ctx.lineTo(candleX + 2.2, candleBase);
  ctx.quadraticCurveTo(candleX, candleBase + .8, candleX - 2.2, candleBase);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffedbd';
  ctx.beginPath(); ctx.ellipse(candleX, candleBase - 9.7, 2.45, .65, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#f4ddb0'; ctx.lineWidth = .65; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(candleX + 1.3, candleBase - 9); ctx.quadraticCurveTo(candleX + 2, candleBase - 6.8, candleX + 1.4, candleBase - 5.5); ctx.stroke();
  ctx.strokeStyle = '#705034'; ctx.lineWidth = .75;
  ctx.beginPath(); ctx.moveTo(candleX, candleBase - 9.8); ctx.lineTo(candleX + .3, candleBase - 12.1); ctx.stroke();

  const tipX = candleX + sway;
  const tipY = candleBase - 19 + Math.sin(time * 2.3 + phase) * .35;
  const flame = ctx.createLinearGradient(0, tipY, 0, candleBase - 11.5);
  flame.addColorStop(0, '#ffe8a5'); flame.addColorStop(.48, '#ffc766'); flame.addColorStop(1, '#ee9e45');
  ctx.fillStyle = flame;
  ctx.beginPath(); ctx.moveTo(candleX, candleBase - 11.4);
  ctx.bezierCurveTo(candleX - 3.5, candleBase - 12.8, candleX - 1.4 + sway, candleBase - 16.1, tipX, tipY);
  ctx.bezierCurveTo(candleX + .6 + sway, candleBase - 16, candleX + 3.3, candleBase - 13, candleX, candleBase - 11.4);
  ctx.fill();
  ctx.fillStyle = '#fff5c8';
  ctx.beginPath(); ctx.moveTo(candleX, candleBase - 11.6);
  ctx.bezierCurveTo(candleX - 1.35, candleBase - 12.6, candleX - .35, candleBase - 14.5, candleX + sway * .3, candleBase - 15.4);
  ctx.bezierCurveTo(candleX + 1.1, candleBase - 13.9, candleX + 1.2, candleBase - 12.3, candleX, candleBase - 11.6);
  ctx.fill();
  ctx.restore();
}
