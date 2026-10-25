/* The first view plays the product film; the image remains its loading fallback. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const videos = new Set();
  function pause(video) { video.pause(); }
  function play(video) {
    if (reduced.matches || document.hidden || !video.dataset.inView) return;
    if (!video.dataset.loaded) {
      video.querySelectorAll('source[data-src]').forEach(s => { s.src = s.dataset.src; });
      video.dataset.loaded = 'true'; video.load();
    }
    video.play().catch(() => video.classList.remove('is-playing'));
  }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    const video = entry.target;
    if (entry.isIntersecting) { video.dataset.inView = 'true'; play(video); }
    else { delete video.dataset.inView; pause(video); }
  }), {threshold:.45});
  function mount() {
    document.querySelectorAll('[data-guillo-card-video]').forEach(video => {
      if (videos.has(video)) return;
      videos.add(video); observer.observe(video);
      video.addEventListener('playing', () => video.classList.add('is-playing'));
      video.addEventListener('error', () => video.classList.remove('is-playing'));
    });
  }
  document.addEventListener('visibilitychange', () => videos.forEach(video => document.hidden ? pause(video) : play(video)));
  reduced.addEventListener('change', () => videos.forEach(video => reduced.matches ? pause(video) : play(video)));
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
  mount();
})();
