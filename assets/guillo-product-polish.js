(() => {
 const proof = document.querySelector('[data-ge-proof]');
 if (!proof) return;
 const track = proof.querySelector('[data-proof-track]');
 const dots = [...proof.querySelectorAll('[data-proof-dot]')];
 const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
 dots.forEach((dot, index) => dot.addEventListener('click', () => {
  track.scrollTo({left: index * track.clientWidth, behavior: reduce ? 'instant' : 'smooth'});
 }));
 let frame;
 track.addEventListener('scroll', () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
   const active = Math.round(track.scrollLeft / track.clientWidth);
   dots.forEach((dot, index) => dot.setAttribute('aria-pressed', String(index === active)));
  });
 }, {passive: true});
})();
