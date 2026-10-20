if (!customElements.get('guillo-atelier')) {
  customElements.define('guillo-atelier', class extends HTMLElement {
    connectedCallback() {
      this.cleanup = new AbortController();
      const signal = this.cleanup.signal;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.reveals = [...this.querySelectorAll('.ga-reveal')];
      // One passive scroll listener and a single animation frame update visible layers.
      // No wheel interception: the page retains normal native scrolling.
      this.drift = [...this.querySelectorAll('.ga-drift')];
      const clamp = value => Math.min(1, Math.max(0, value));
      const renderScroll = () => {
        this.frame = 0;
        if (this.motion.matches) return;
        const viewport = innerHeight;
        this.drift.forEach(el => {
          const box = el.getBoundingClientRect();
          if (box.bottom > -80 && box.top < viewport + 80) {
            const position = clamp((viewport - box.top) / (viewport + box.height));
            el.style.setProperty('--ga-image-y', `${(18 - position * 36).toFixed(2)}px`);
          }
        });
        this.reveals.forEach(el => {
          // Also reveal elements passed by a fast scroll or back navigation.
          if (el.getBoundingClientRect().top < viewport * .96) {
            el.classList.remove('is-awaiting'); el.classList.add('is-visible');
          }
        });
      };
      const schedule = () => {
        if (!this.frame) this.frame = requestAnimationFrame(renderScroll);
      };
      const setMotion = () => {
        this.classList.toggle('has-scroll-motion', !this.motion.matches);
        if (this.motion.matches) {
          this.reveals.forEach(el => el.classList.remove('is-awaiting'));
        } else {
          this.reveals.forEach(el => {
            if (!el.classList.contains('is-visible') && el.getBoundingClientRect().top > innerHeight) el.classList.add('is-awaiting');
          });
        }
        schedule();
      };
      window.addEventListener('scroll', schedule, {passive:true, signal});
      window.addEventListener('resize', schedule, {passive:true, signal});
      this.motion.addEventListener('change', setMotion, {signal});
      setMotion();
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
      this.cleanup?.abort(); cancelAnimationFrame(this.frame); this.filmObserver?.disconnect(); this.video?.pause();
    }
  });
}
