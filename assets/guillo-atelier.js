if (!customElements.get('guillo-atelier')) {
  customElements.define('guillo-atelier', class extends HTMLElement {
    connectedCallback() {
      this.cleanup = new AbortController();
      const signal = this.cleanup.signal;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.reveals = [...this.querySelectorAll('.ga-reveal')];
      if (!this.motion.matches && 'IntersectionObserver' in window) {
        this.revealObserver = new IntersectionObserver(entries => {
          entries.forEach(({isIntersecting, target}) => {
            if (isIntersecting) { target.classList.add('is-visible'); target.classList.remove('is-awaiting'); this.revealObserver.unobserve(target); }
          });
        }, {threshold: 0.06});
        this.reveals.forEach(el => {
          if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('is-awaiting'); this.revealObserver.observe(el); }
        });
      }
      this.querySelectorAll('.ga-view-controls').forEach(el => el.hidden = false);
      this.addEventListener('click', event => {
        const button = event.target.closest('[data-view-button]');
        if (button) {
          const visual = button.closest('.ga-signature__visual');
          visual.querySelectorAll('[data-view-button]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
          visual.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('is-current', el.dataset.view === button.dataset.viewButton));
        }
      }, {signal});
      this.video = this.querySelector('.ga-day video');
      this.scene = this.querySelector('.ga-day__scene');
      this.toggle = this.querySelector('.ga-film-control');
      this.userPaused = false;
      this.inView = false;
      const syncVideo = () => {
        const allowed = this.inView && !this.motion.matches && !this.userPaused && !document.hidden && !navigator.connection?.saveData;
        if (!allowed) { this.video.pause(); return; }
        if (!this.video.src) this.video.src = this.video.dataset.src;
        this.video.muted = true;
        this.video.play().then(() => {
          this.scene.classList.add('is-playing'); this.toggle.hidden = false;
        }).catch(() => {});
      };
      this.toggle.addEventListener('click', () => {
        this.userPaused = !this.userPaused;
        this.toggle.innerHTML = this.userPaused ? 'Play film <span aria-hidden="true">▷</span>' : 'Pause film <span aria-hidden="true">Ⅱ</span>';
        this.toggle.setAttribute('aria-label', this.userPaused ? 'Play outfit film' : 'Pause outfit film');
        syncVideo();
      }, {signal});
      document.addEventListener('visibilitychange', syncVideo, {signal});
      this.motion.addEventListener('change', () => {
        if (this.motion.matches) this.reveals.forEach(el => {el.classList.remove('is-awaiting');el.classList.add('is-visible');});
        syncVideo();
      }, {signal});
      if ('IntersectionObserver' in window) {
        this.filmObserver = new IntersectionObserver(entries => {
          this.inView = entries[0].isIntersecting; syncVideo();
        }, {threshold: .15});
        this.filmObserver.observe(this.scene);
      }
    }
    disconnectedCallback() {
      this.cleanup?.abort(); this.revealObserver?.disconnect(); this.filmObserver?.disconnect(); this.video?.pause();
    }
  });
}
