// Pure geometry for illustrative flight playback, not a recorded flight track.
// Coordinates match footprints.js; adjacent worlds are spaced 1000 units apart.
const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 450;
const MAX_ZOOM = 5;
const EPSILON = 1e-10;

/** Project geographic coordinates into the existing world SVG coordinate system. */
export function projectFlightPoint({ lon, lat }) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new TypeError('Flight coordinates require finite longitude and latitude; latitude must be within -90 to 90.');
  }
  return { x: (lon + 180) / 360 * WORLD_WIDTH, y: (85 - lat) / 145 * WORLD_HEIGHT };
}

function pointAt(start, control, end, progress) {
  const remaining = 1 - progress;
  return {
    x: remaining * remaining * start.x + 2 * remaining * progress * control.x + progress * progress * end.x,
    y: remaining * remaining * start.y + 2 * remaining * progress * control.y + progress * progress * end.y,
  };
}

function measureCurve(start, control, end) {
  const points = [start, end];
  for (const axis of ['x', 'y']) {
    const denominator = start[axis] - 2 * control[axis] + end[axis];
    if (Math.abs(denominator) < EPSILON) continue;
    const progress = (start[axis] - control[axis]) / denominator;
    if (progress > 0 && progress < 1) points.push(pointAt(start, control, end, progress));
  }
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Create an illustrative quadratic Bézier route with a fitted camera.
 *
 * start/end/control are {x,y} in the unwrapped world coordinate system.
 * end.x chooses the closest adjacent copy of the destination; wrapOffsetX is
 * its horizontal offset from the normally projected destination (often ±1000).
 * curveBounds is exact; bounds adds padding in world units for markers/plane.
 * camera can be used as `translate(tx ty) scale(k)` on a 1000×450 SVG, or by
 * applying camera.viewBox instead. Do not apply both transforms together.
 */
export function createFlightRoute(origin, destination) {
  const start = projectFlightPoint(origin);
  const projectedEnd = projectFlightPoint(destination);
  const originalDeltaX = projectedEnd.x - start.x;
  let deltaX = ((originalDeltaX + WORLD_WIDTH / 2) % WORLD_WIDTH + WORLD_WIDTH) % WORLD_WIDTH - WORLD_WIDTH / 2;
  // For exactly antipodal longitudes, keep the original direction deterministically.
  if (Math.abs(Math.abs(deltaX) - WORLD_WIDTH / 2) < EPSILON) {
    deltaX = Math.sign(originalDeltaX) * WORLD_WIDTH / 2;
  }
  const end = { x: start.x + deltaX, y: projectedEnd.y };
  const wrapOffsetX = Math.round((end.x - projectedEnd.x) / WORLD_WIDTH) * WORLD_WIDTH;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  const offset = Math.min(100, distance * 0.28);
  // Choose the normal pointing upward on the map; vertical routes bow to one side.
  const direction = deltaX < 0 ? -1 : 1;
  const normal = distance > EPSILON ? { x: direction * deltaY / distance, y: -direction * deltaX / distance } : { x: 0, y: 0 };
  const control = {
    x: (start.x + end.x) / 2 + normal.x * offset,
    y: (start.y + end.y) / 2 + normal.y * offset,
  };
  const path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  const curveBounds = measureCurve(start, control, end);
  const padding = Math.max(18, Math.min(36, distance * 0.08));
  const bounds = {
    minX: curveBounds.minX - padding,
    minY: curveBounds.minY - padding,
    maxX: curveBounds.maxX + padding,
    maxY: curveBounds.maxY + padding,
    width: curveBounds.width + padding * 2,
    height: curveBounds.height + padding * 2,
    padding,
  };
  const k = Math.min(MAX_ZOOM, WORLD_WIDTH / bounds.width, WORLD_HEIGHT / bounds.height);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const camera = {
    k,
    tx: WORLD_WIDTH / 2 - centerX * k,
    ty: WORLD_HEIGHT / 2 - centerY * k,
    viewBox: {
      x: centerX - WORLD_WIDTH / k / 2,
      y: centerY - WORLD_HEIGHT / k / 2,
      width: WORLD_WIDTH / k,
      height: WORLD_HEIGHT / k,
    },
  };
  return { start, end, control, path, curveBounds, bounds, camera, wrapOffsetX };
}

/**
 * Sample a route at a Bézier parameter clamped to [0,1]. This is not an
 * arc-length parameter; callers can ease progress for the desired pacing.
 * angle is clockwise SVG degrees for artwork whose nose points right.
 * tangent is the curve derivative in world units. A stationary route uses
 * {x:1,y:0} and angle 0 to keep plane orientation finite and deterministic.
 */
export function sampleFlightRoute(route, progress) {
  if (!Number.isFinite(progress)) throw new TypeError('Flight progress must be finite.');
  const t = Math.max(0, Math.min(1, progress));
  const { start, control, end } = route;
  const point = pointAt(start, control, end, t);
  let tangent = {
    x: 2 * ((1 - t) * (control.x - start.x) + t * (end.x - control.x)),
    y: 2 * ((1 - t) * (control.y - start.y) + t * (end.y - control.y)),
  };
  if (Math.hypot(tangent.x, tangent.y) < EPSILON) tangent = { x: 1, y: 0 };
  const rawAngle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
  const baseline = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
  // Keep westbound headings continuous across the atan2 ±180° seam.
  const angle = baseline + ((rawAngle - baseline + 540) % 360 - 180);
  return { ...point, angle, tangent, progress: t };
}
