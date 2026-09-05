/**
 * Mega-menu hover grace period.
 *
 * Horizon binds `on:pointerleave="/deactivate"` to each nav item and closes the
 * panel immediately. The panel's box is clipped to start below the header row,
 * so a cursor travelling diagonally from a nav item toward the panel's product
 * tiles crosses a band that belongs to neither the item nor the panel — and the
 * menu shuts before it can be reached. (Horizon's own docstring says
 * "Deactivate the active item after a delay"; the delay was never implemented.)
 *
 * This defers a pointer-driven close: the panel stays open while the cursor is
 * still inside the corridor between the nav and the open panel, closes at once
 * if the cursor leaves that corridor, and cancels the close entirely once the
 * cursor reaches the panel. Keyboard/focus closes are left untouched.
 */
(() => {
  const SAFETY_MS = 400;

  /** Union of the nav strip and the open panel — the corridor the cursor may cross. */
  const inCorridor = (menu, submenu, x, y) => {
    const m = menu.getBoundingClientRect();
    const s = submenu.getBoundingClientRect();
    if (!s.height) return false;
    return (
      x >= Math.min(m.left, s.left) &&
      x <= Math.max(m.right, s.right) &&
      y >= Math.min(m.top, s.top) &&
      y <= Math.max(m.bottom, s.bottom)
    );
  };

  const patch = (menu) => {
    if (menu.dataset.guilloHoverPatched === 'true' || typeof menu.deactivate !== 'function') return;
    menu.dataset.guilloHoverPatched = 'true';

    const original = menu.deactivate.bind(menu);
    let pending = null;

    const cancel = () => {
      if (!pending) return;
      clearTimeout(pending.timer);
      document.removeEventListener('pointermove', pending.onMove, true);
      pending = null;
    };

    menu.deactivate = function (event) {
      // Focus/blur closes stay immediate so keyboard navigation is unaffected.
      if (!event || event.type !== 'pointerleave') {
        cancel();
        return original(event);
      }

      const submenu = menu.querySelector('.menu-list__list-item:has([aria-expanded="true"]) .menu-list__submenu');
      if (!submenu) return original(event);

      cancel();

      const close = () => {
        cancel();
        original(event);
      };

      const onMove = (e) => {
        // Reached the panel — keep it open and stand down.
        if (submenu.matches(':hover')) return cancel();
        if (!inCorridor(menu, submenu, e.clientX, e.clientY)) close();
      };

      document.addEventListener('pointermove', onMove, true);
      pending = {
        onMove,
        // If the cursor simply stops inside the corridor without entering the
        // panel (e.g. parked over the header actions), close on the safety net.
        timer: setTimeout(() => {
          if (submenu.matches(':hover') || menu.matches(':hover')) return cancel();
          close();
        }, SAFETY_MS),
      };
    };

    menu.addEventListener('pointerenter', cancel, true);
  };

  const patchAll = () => document.querySelectorAll('header-menu').forEach(patch);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchAll, { once: true });
  } else {
    patchAll();
  }

  // The custom element can upgrade after this runs, and the header re-renders
  // in the theme editor.
  const observer = new MutationObserver(patchAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

