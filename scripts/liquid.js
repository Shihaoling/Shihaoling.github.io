// One pointer listener moves the specular highlight on visible glass panels.
export function initLiquidGlass() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  let pending = false;
  let active;
  let clientX = 0;
  let clientY = 0;

  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches || reducedTransparency.matches) return;
    const panel = event.target.closest?.('.profile-overview, .education-section, .liquid-card');
    if (!panel) return;
    active = panel;
    clientX = event.clientX;
    clientY = event.clientY;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (!active) return;
      const rect = active.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      active.style.setProperty('--liquid-x', `${x.toFixed(1)}%`);
      active.style.setProperty('--liquid-y', `${y.toFixed(1)}%`);
    });
  }, { passive: true });
}
