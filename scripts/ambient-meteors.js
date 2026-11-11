import { moonVisibility, moonLineStops } from './sky-effects.js?v=20261111-ambient-meteors';

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const smooth = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

/** Randomness is sampled once. Scheduling, lifetime and the one-meteor cap are external. */
export function createAmbientMeteor(random = Math.random) {
  const next = () => clamp(Number(random()) || 0, 0, 1 - Number.EPSILON);
  const between = (a, b) => mix(a, b, next());
  return {
    duration: between(.55, .85),
    angle: between(48, 62) * Math.PI / 180,
    tailLength: between(45, 85),
    travelLength: between(130, 215),
    originX: next(), originY: next(),
    thickness: between(.7, 1.1),
    brightness: between(.82, 1),
  };
}

/**
 * Pixel geometry keeps the down-left angle identical on phones and wide screens.
 * The complete head and tail fit the visible sky before opacity is applied.
 */
export function getMeteorPose(meteor, progress, layout) {
  const width = Math.max(1, layout.width), height = Math.max(1, layout.height);
  const horizon = layout.horizon ?? height * .42;
  const moon = layout.celestial || { x: width * .83, y: horizon * .45, radius: 28 };
  const bounds = layout.sceneBounds;
  const left = Math.max(10, bounds?.left != null ? bounds.left + 10 : moon.x - Math.min(240, width * .66));
  const right = width - 10;
  const top = Math.max(10, bounds?.top != null ? bounds.top + 8 : 0, moon.y - Math.max(90, moon.radius * 2.4));
  const bottom = Math.min(height - 10, horizon - 15, bounds?.bottom != null ? bounds.bottom - 6 : height);
  const availableWidth = Math.max(0, right - left), availableHeight = Math.max(0, bottom - top);
  const angle = clamp(meteor.angle, 48 * Math.PI / 180, 62 * Math.PI / 180);
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const budget = Math.min(availableWidth / cosine, availableHeight / sine);
  const tailLength = Math.min(meteor.tailLength, width * .205, budget * .32);
  const travelLength = Math.min(meteor.travelLength, Math.max(0, budget - tailLength));
  const total = tailLength + travelLength;
  const tipX = mix(left + cosine * total, right, clamp(meteor.originX));
  const tipY = mix(top, bottom - sine * total, clamp(meteor.originY));
  const startX = tipX - cosine * tailLength, startY = tipY + sine * tailLength;
  const p = clamp(progress);
  const x = startX - cosine * travelLength * p;
  const y = startY + sine * travelLength * p;
  const night = smooth(.8, 1, layout.night ?? 1);
  const alpha = smooth(0, .11, p) * (1 - smooth(.66, 1, p)) * night * meteor.brightness;
  return {
    x, y, tailX: x + cosine * tailLength, tailY: y - sine * tailLength,
    startX, startY, endX: startX - cosine * travelLength, endY: startY + sine * travelLength,
    angle, tailLength, travelLength, alpha,
    bounds: { left, right, top, bottom },
    visible: availableWidth > 24 && availableHeight > 24 && budget > 45 && p > 0 && p < 1 && alpha > .001,
  };
}

/** Paint only: no random calls, clocks, timers, animation loops or DOM access. */
export function drawAmbientMeteor(ctx, meteor, layout) {
  if (!meteor) return;
  const progress = clamp(meteor.progress ?? 0);
  const pose = getMeteorPose(meteor, progress, layout);
  if (!pose.visible) return;
  const moon = layout.celestial;
  const { x, y, tailX, tailY, alpha } = pose;
  const outerWidth = meteor.thickness + 2;
  const trail = ctx.createLinearGradient(tailX, tailY, x, y);
  for (const stop of moonLineStops({ x: tailX, y: tailY }, { x, y }, moon, progress, outerWidth * .5 + .5)) {
    const taper = stop.offset ** 1.65;
    trail.addColorStop(stop.offset, `rgba(219,238,245,${alpha * taper * stop.alpha})`);
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = trail;
  ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(x, y);
  ctx.save(); ctx.globalAlpha *= .12; ctx.lineWidth = outerWidth; ctx.stroke(); ctx.restore();
  ctx.lineWidth = meteor.thickness; ctx.stroke();
  const headAlpha = alpha * moonVisibility(x, y, moon, progress, 2.6);
  ctx.fillStyle = `rgba(239,246,242,${headAlpha})`;
  ctx.beginPath(); ctx.arc(x, y, meteor.thickness * .84, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
