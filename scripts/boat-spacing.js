// Project desired positions onto ordered lanes, reserving each tilted silhouette
// and the water between boats. Pooling neighbours makes contact continuous.
export function spaceBoats(boats, left, width, gap = 20) {
  const placed = boats.map(boat => ({ ...boat }));
  if (!placed.length) return placed;
  const rank = boat => boat.side === 'left' ? -1 : boat.side === 'right' ? 1 : 0;
  const ordered = [...placed].sort((a, b) => rank(a) - rank(b));
  const half = boat => 42 * boat.scale;
  const available = Math.max(1, width - 16);
  const hullWidth = ordered.reduce((sum, boat) => sum + half(boat) * 2, 0);
  if (hullWidth > available) ordered.forEach(boat => { boat.scale *= available / hullWidth; });
  const usedWidth = ordered.reduce((sum, boat) => sum + half(boat) * 2, 0);
  const spacing = ordered.length > 1
    ? Math.max(0, Math.min(gap, (available - usedWidth) / (ordered.length - 1))) : 0;
  const offsets = [0];
  for (let i = 1; i < ordered.length; i++) offsets[i] = offsets[i - 1] + half(ordered[i - 1]) + half(ordered[i]) + spacing;
  const lower = left + 8 + half(ordered[0]);
  const upper = Math.max(lower, left + width - 8 - half(ordered.at(-1)) - offsets.at(-1));
  const blocks = [];
  ordered.forEach((boat, index) => {
    const value = Math.max(lower, Math.min(upper, boat.x - offsets[index]));
    blocks.push({ start: index, end: index, sum: value, count: 1 });
    while (blocks.length > 1) {
      const next = blocks.at(-1), previous = blocks.at(-2);
      if (previous.sum / previous.count <= next.sum / next.count) break;
      blocks.splice(-2, 2, { start: previous.start, end: next.end, sum: previous.sum + next.sum, count: previous.count + next.count });
    }
  });
  for (const block of blocks) {
    for (let i = block.start; i <= block.end; i++) ordered[i].x = block.sum / block.count + offsets[i];
  }
  return placed;
}
