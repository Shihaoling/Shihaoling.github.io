// Keep the page halo under the pointer while scrolling, and dim it on exit.
export function initLiquidGlass() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  const surface = document.querySelector('.content-surface');
  const glow = surface?.querySelector('.ambient-glow');
  const orb = glow?.firstElementChild;
  let orbHalfWidth = orb ? orb.offsetWidth / 2 : 0;
  let orbHalfHeight = orb ? orb.offsetHeight / 2 : 0;
  let pending = false;
  let inside = false;
  let activePanel = null;
  let idleTimer = 0;
  let clientX = 0;
  let clientY = 0;

  function clearPanel() {
    activePanel?.classList.remove('is-liquid-active');
    activePanel = null;
  }
  function hide() {
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    inside = false;
    clearPanel();
    glow?.classList.remove('is-visible');
    document.documentElement.classList.add('pointer-outside');
  }
  function update() {
    pending = false;
    if (!inside || !finePointer.matches || reducedMotion.matches || reducedTransparency.matches) return;
    const panel = document.elementFromPoint(clientX, clientY)?.closest?.('.profile-overview, .education-section, .liquid-card');
    if (panel !== activePanel) {
      clearPanel();
      activePanel = panel;
      activePanel?.classList.add('is-liquid-active');
    }
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
      orb.style.transform = `translate3d(${Math.round(clientX - rect.left - orbHalfWidth)}px, ${Math.round(clientY - rect.top - orbHalfHeight)}px, 0)`;
      glow.classList.add('is-visible');
    }
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }
  function keepAlive() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(hide, 1800);
  }

  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches || reducedTransparency.matches) return;
    inside = true;
    clientX = event.clientX;
    clientY = event.clientY;
    document.documentElement.classList.remove('pointer-outside');
    schedule();
    keepAlive();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) hide(); }, { passive: true });
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  window.addEventListener('hashchange', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  window.addEventListener('scroll', () => { if (inside) { schedule(); keepAlive(); } }, { passive: true });
  window.addEventListener('resize', () => {
    if (orb) { orbHalfWidth = orb.offsetWidth / 2; orbHalfHeight = orb.offsetHeight / 2; }
    if (inside) schedule();
  });
  finePointer.addEventListener('change', hide);
  reducedMotion.addEventListener('change', hide);
  reducedTransparency.addEventListener('change', hide);
}
