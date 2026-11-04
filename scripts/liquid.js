// Keep the page halo under the pointer while scrolling, and dim it on exit.
export function initLiquidGlass() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  const surface = document.querySelector('.content-surface');
  const glow = surface?.querySelector('.ambient-glow');
  const orb = glow?.firstElementChild;
  let pending = false;
  let inside = false;
  let clientX = 0;
  let clientY = 0;

  function hide() {
    inside = false;
    glow?.classList.remove('is-visible');
    document.documentElement.classList.add('pointer-outside');
  }
  function update() {
    pending = false;
    if (!inside || !finePointer.matches || reducedMotion.matches || reducedTransparency.matches) return;
    const panel = document.elementFromPoint(clientX, clientY)?.closest?.('.profile-overview, .education-section, .liquid-card');
    if (panel) {
      const rect = panel.getBoundingClientRect();
      if (rect.width && rect.height) {
        const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        panel.style.setProperty('--liquid-x', `${x.toFixed(1)}%`);
        panel.style.setProperty('--liquid-y', `${y.toFixed(1)}%`);
      }
    }
    if (orb && surface) {
      const rect = surface.getBoundingClientRect();
      orb.style.transform = `translate3d(${Math.round(clientX - rect.left - 310)}px, ${Math.round(clientY - rect.top - 310)}px, 0)`;
      glow.classList.add('is-visible');
    }
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }

  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches || reducedTransparency.matches) return;
    inside = true;
    clientX = event.clientX;
    clientY = event.clientY;
    document.documentElement.classList.remove('pointer-outside');
    schedule();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) hide(); }, { passive: true });
  window.addEventListener('blur', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  window.addEventListener('scroll', () => { if (inside) schedule(); }, { passive: true });
  window.addEventListener('resize', () => { if (inside) schedule(); });
  finePointer.addEventListener('change', hide);
  reducedMotion.addEventListener('change', hide);
  reducedTransparency.addEventListener('change', hide);
}
