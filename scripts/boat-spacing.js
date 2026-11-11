// Keep the two paper boats apart, including their tilted silhouettes.
// Positions remain continuous when a drifting boat reaches the other's space.
export function spaceBoats(boats, left, width, gap = 20) {
  const placed = boats.map(boat => ({ ...boat }));
  const half = boat => 42 * boat.scale;
  const limit = (x, boat) => Math.max(left + half(boat) + 8, Math.min(left + width - half(boat) - 8, x));
  for (const boat of placed) boat.x = limit(boat.x, boat);
  if (placed.length < 2) return placed;
  const [main, visitor] = placed;
  const separation = half(main) + half(visitor) + gap;
  if (visitor.side === 'left') {
    visitor.x = limit(Math.min(visitor.x, main.x - separation), visitor);
    main.x = Math.max(main.x, visitor.x + separation);
  } else {
    visitor.x = limit(Math.max(visitor.x, main.x + separation), visitor);
    main.x = Math.min(main.x, visitor.x - separation);
  }
  return placed;
}
