if (!customElements.get('guillo-atelier')) {
  customElements.define('guillo-atelier', class extends HTMLElement {
    connectedCallback() {
      this.cleanup = new AbortController();
      const signal = this.cleanup.signal;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.hero = document.querySelector('guillo-campaign');
      this.header = document.querySelector('#header-component');
      this.categories = [...this.querySelectorAll('.ga-category')];
      this.drift = [...this.querySelectorAll('.ga-drift')].filter(el => !el.closest('.ga-category'));
      this.lowerReveals = [...document.querySelectorAll('.guillo-story__panel,.guillo-story__media,.guillo-newsletter__inner,.guillo-quotes__cell,.guillo-footer__col')];
      this.lowerReveals.forEach(el => el.classList.add('ga-reveal'));
      this.reveals = [...this.querySelectorAll('.ga-reveal:not(.ga-category)'), ...this.lowerReveals];
      this.story = this.querySelector('.ga-signature');
      this.stage = this.querySelector('.ga-signature__stage');
      this.frames = [...this.querySelectorAll('[data-view]')];
      this.chapters = [...this.querySelectorAll('[data-chapter]')];
      this.viewButtons = [...this.querySelectorAll('[data-view-button]')];
      this.classList.toggle('has-story-controls', this.frames.length > 0);
      this.querySelectorAll('.ga-view-controls').forEach(el => el.hidden = false);
      const clamp = value => Math.min(1, Math.max(0, value));
      const setView = index => {
        if (index === this.activeView) return;
        this.activeView = index;
        this.frames.forEach((el, i) => el.classList.toggle('is-current', i === index));
        this.chapters.forEach((el, i) => {
          el.classList.toggle('is-current', i === index);
          el.setAttribute('aria-hidden', String(i !== index));
        });
        this.viewButtons.forEach((el, i) => el.setAttribute('aria-pressed', String(i === index)));
        if (this.story) this.story.dataset.currentView = String(index);
      };
      setView(0);
      const renderScroll = () => {
        this.frame = 0;
        const viewport = innerHeight;
        const headerHeight = Math.ceil(this.header?.getBoundingClientRect().height || 80);
        this.style.setProperty('--ga-header', `${headerHeight}px`);
        if (this.hero) {
          const heroBox = this.hero.getBoundingClientRect();
          document.body.classList.toggle('guillo-past-hero', heroBox.bottom < headerHeight + 20);
          if (!this.motion.matches) this.hero.style.setProperty('--campaign-exit', clamp(-heroBox.top / (heroBox.height * .85)).toFixed(4));
        }
        if (!this.motion.matches) {
          this.categories.forEach(card => {
            const image = card.querySelector('.ga-card__image');
            const box = image.getBoundingClientRect();
            if (box.bottom > -100 && box.top < viewport + 200) {
              const open = clamp((viewport * .96 - box.top) / (viewport * .76));
              card.style.setProperty('--ga-open', open.toFixed(4));
            }
          });
          this.drift.forEach(el => {
            const box = el.getBoundingClientRect();
            if (box.bottom > -80 && box.top < viewport + 80) {
              const position = clamp((viewport - box.top) / (viewport + box.height));
              el.style.setProperty('--ga-image-y', `${(28 - position * 56).toFixed(2)}px`);
            }
          });
          if (this.story && this.classList.contains('has-story-motion')) {
            const box = this.story.getBoundingClientRect();
            const travel = Math.max(1, box.height - this.stage.offsetHeight);
            const progress = clamp((headerHeight - box.top) / travel);
            this.story.style.setProperty('--ga-story-progress', progress.toFixed(4));
            if (this.manualView !== undefined && Math.abs(scrollY - this.manualScrollY) > 24) this.manualView = undefined;
            setView(this.manualView ?? Math.min(this.frames.length - 1, Math.floor(progress * this.frames.length)));
          }
        }
        this.reveals.forEach(el => {
          if (this.motion.matches || el.getBoundingClientRect().top < viewport * .94) {
            el.classList.remove('is-awaiting'); el.classList.add('is-visible');
          }
        });
      };
      const schedule = () => {
        if (!this.frame) this.frame = requestAnimationFrame(renderScroll);
      };
      const setMotion = () => {
        const enabled = !this.motion.matches;
        this.classList.toggle('has-scroll-motion', enabled);
        this.classList.toggle('has-story-motion', enabled && this.frames.length === 3);
        this.hero?.classList.toggle('has-exit-motion', enabled);
        this.reveals.forEach(el => {
          if (!enabled) el.classList.remove('is-awaiting');
          else if (!el.classList.contains('is-visible') && el.getBoundingClientRect().top > innerHeight) el.classList.add('is-awaiting');
        });
        schedule();
      };
      window.addEventListener('scroll', schedule, {passive:true, signal});
      window.addEventListener('resize', schedule, {passive:true, signal});
      this.motion.addEventListener('change', setMotion, {signal});
      this.addEventListener('click', event => {
        const button = event.target.closest('[data-view-button]');
        if (!button) return;
        this.manualView = Number(button.dataset.viewButton);
        this.manualScrollY = scrollY;
        setView(this.manualView);
      }, {signal});
      this.video = this.querySelector('.ga-day video');
      this.scene = this.querySelector('.ga-day__scene');
      this.toggle = this.querySelector('.ga-film-control');
      this.userPaused = false;
      this.inView = false;
      const syncVideo = () => {
        if (!this.video) return;
        const allowed = this.inView && !this.motion.matches && !this.userPaused && !document.hidden && !navigator.connection?.saveData;
        if (!allowed) { this.video.pause(); return; }
        if (!this.video.src) this.video.src = this.video.dataset.src;
        this.video.muted = true;
        this.video.play().then(() => {
          this.scene.classList.add('is-playing'); this.toggle.hidden = false;
        }).catch(() => {});
      };
      this.toggle?.addEventListener('click', () => {
        this.userPaused = !this.userPaused;
        this.toggle.innerHTML = this.userPaused ? 'Play film <span aria-hidden="true">▷</span>' : 'Pause film <span aria-hidden="true">Ⅱ</span>';
        this.toggle.setAttribute('aria-label', this.userPaused ? 'Play outfit film' : 'Pause outfit film');
        syncVideo();
      }, {signal});
      document.addEventListener('visibilitychange', syncVideo, {signal});
      this.motion.addEventListener('change', syncVideo, {signal});
      if ('IntersectionObserver' in window && this.scene) {
        this.filmObserver = new IntersectionObserver(entries => {
          this.inView = entries[0].isIntersecting; syncVideo();
        }, {threshold: .15});
        this.filmObserver.observe(this.scene);
      }
      setMotion();
    }
    disconnectedCallback() {
      this.cleanup?.abort(); cancelAnimationFrame(this.frame); this.filmObserver?.disconnect(); this.video?.pause();
      this.hero?.classList.remove('has-exit-motion');
      this.lowerReveals?.forEach(el => el.classList.remove('ga-reveal','is-awaiting','is-visible'));
      document.body.classList.remove('guillo-past-hero');
    }
  });
}
