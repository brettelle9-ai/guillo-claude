/* One quiet reveal per icon group; labels never move or disappear. */
(() => {
  const mounted = new WeakSet();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mount = () => document.querySelectorAll('[data-bellagio-features]').forEach(group => {
    if (mounted.has(group)) return;
    mounted.add(group);
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      if (reduced.matches || !group.isConnected) return;
      group.querySelectorAll('.bellagio-features__icon').forEach((icon, i) => {
        if (!icon.animate) return;
        const timing = {duration: 800, delay: i * 70, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'};
        icon.animate([{opacity: .3, transform: 'translateY(4px)'}, {opacity: 1, transform: 'translateY(0)'}], timing);
        icon.querySelectorAll('path,rect').forEach(shape => {
          if (!shape.getTotalLength) return;
          const length = shape.getTotalLength();
          shape.animate([{strokeDasharray: `${length} ${length}`, strokeDashoffset: length}, {strokeDasharray: `${length} ${length}`, strokeDashoffset: 0}], {...timing, duration: 1100});
        });
      });
    }, {threshold: .2});
    observer.observe(group);
  });
  document.addEventListener('shopify:section:load', mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
