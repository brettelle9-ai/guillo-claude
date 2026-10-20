if (!customElements.get('guillo-campaign')) {
  customElements.define('guillo-campaign', class extends HTMLElement {
    connectedCallback() {
      if (this.mounted) return;
      this.mounted = true;
      this.films = [...this.querySelectorAll('video')];
      this.button = this.querySelector('.g-campaign__motion');
      if (!this.films.length || !this.button) return;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.wide = matchMedia('(min-width: 990px)');
      const connection = navigator.connection;
      this.saveData = connection && (connection.saveData || /^(slow-2g|2g)$/.test(connection.effectiveType || ''));
      this.inView = true;
      this.manuallyPaused = false;
      this.started = false;
      this.onToggle = () => {
        this.manuallyPaused = !this.manuallyPaused;
        this.classList.toggle('is-paused', this.manuallyPaused);
        this.button.setAttribute('aria-label', this.manuallyPaused ? 'Play background films' : 'Pause background films');
        this.updatePlayback();
      };
      this.onChange = () => this.updatePlayback();
      this.button.addEventListener('click', this.onToggle);
      this.motion.addEventListener('change', this.onChange);
      this.wide.addEventListener('change', this.onChange);
      document.addEventListener('visibilitychange', this.onChange);
      this.observer = new IntersectionObserver(entries => {
        this.inView = entries[0].isIntersecting;
        this.updatePlayback();
      }, { threshold: .05 });
      this.observer.observe(this);
      this.onLoad = () => {
        const start = () => {
          if (!this.isConnected) return;
          this.started = true;
          this.updatePlayback();
        };
        if ('requestIdleCallback' in window) this.idle = requestIdleCallback(start, { timeout: 1200 });
        else this.timer = setTimeout(start, 100);
      };
      if (document.readyState === 'complete') this.onLoad();
      else window.addEventListener('load', this.onLoad, { once: true });
    }
    updatePlayback() {
      const allowed = this.started && this.inView && !document.hidden && !this.motion.matches && !this.saveData && !this.manuallyPaused;
      this.films.forEach(film => {
        const visible = film.dataset.film === 'primary' || this.wide.matches;
        if (!allowed || !visible) {
          film.pause();
          return;
        }
        if (!film.getAttribute('src')) {
          film.muted = true;
          film.src = film.dataset.src;
          film.addEventListener('playing', () => {
            film.classList.add('is-ready');
            this.button.hidden = false;
          });
        }
        const playback = film.play();
        if (playback && playback.catch) playback.catch(() => {});
      });
      if (this.motion.matches || this.saveData) this.button.hidden = true;
    }
    disconnectedCallback() {
      this.mounted = false;
      this.films?.forEach(film => film.pause());
      this.observer?.disconnect();
      this.button?.removeEventListener('click', this.onToggle);
      this.motion?.removeEventListener('change', this.onChange);
      this.wide?.removeEventListener('change', this.onChange);
      document.removeEventListener('visibilitychange', this.onChange);
      window.removeEventListener('load', this.onLoad);
      if (this.idle && 'cancelIdleCallback' in window) cancelIdleCallback(this.idle);
      clearTimeout(this.timer);
    }
  });
}
