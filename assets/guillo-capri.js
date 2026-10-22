(() => {
  const initialise = (event) => {
  const root = document.querySelector('.guillo-capri-page [data-guillo-pdp]');
  if (!root || root.dataset.capriReady) return;
  root.dataset.capriReady = 'true';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gallery = root.querySelector('[data-gallery]');
  if (gallery && gallery.children.length > 1) {
    const controls = document.createElement('div');
    controls.className = 'capri-gallery-controls';
    const previous = document.createElement('button');
    const next = document.createElement('button');
    previous.type = next.type = 'button';
    previous.setAttribute('aria-label', 'Previous product image');
    next.setAttribute('aria-label', 'Next product image');
    previous.textContent = '←';
    next.textContent = '→';
    controls.append(previous, next);
    gallery.parentElement.append(controls);
    const update = () => {
      previous.disabled = gallery.scrollLeft < 2;
      next.disabled = gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 2;
    };
    const move = (direction) => gallery.scrollBy({left: direction * gallery.clientWidth, behavior: reduce.matches ? 'instant' : 'smooth'});
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    gallery.addEventListener('scroll', update, {passive: true});
    new ResizeObserver(update).observe(gallery);
    update();
  }
  // Only play the shorts film while its section is visible.
  const film = root.querySelector('.capri-film video');
  if (film && event?.type === 'shopify:section:load') {
    const playButton = film.closest('[data-video-tile]')?.querySelector('[data-video-play]');
    playButton?.addEventListener('click', () => film.play().catch(() => {}));
    film.addEventListener('play', () => { if (playButton) playButton.hidden = true; });
    film.addEventListener('pause', () => { if (playButton) playButton.hidden = false; });
  }
  if (film && !reduce.matches) {
    film.muted = true;
    film.loop = true;
    film.playsInline = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && document.visibilityState === 'visible') film.play().catch(() => {});
      else film.pause();
    }, {threshold: .45});
    observer.observe(film);
    document.addEventListener('visibilitychange', () => {if (document.hidden) film.pause();});
  }
  };
  initialise();
  document.addEventListener('shopify:section:load', initialise);
})();
