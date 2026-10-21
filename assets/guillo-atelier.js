if (!customElements.get('guillo-atelier')) {
  customElements.define('guillo-atelier', class extends HTMLElement {
    connectedCallback() {
      this.abort = new AbortController();
      const signal = this.abort.signal;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const immersive = matchMedia('(min-height: 600px)');
      const hero = document.querySelector('guillo-campaign');
      const header = document.querySelector('#header-component');
      const cards = [...this.querySelectorAll('.ga-category')];
      const scenes = [...this.querySelectorAll('.ga-scene')];
      const headings = [...this.querySelectorAll('.ga-heading h2,.ga-banner h2')];
      const story = this.querySelector('.ga-signature');
      const stage = this.querySelector('.ga-signature__stage');
      const filmArea = this.querySelector('.ga-signature__photos');
      const frames = [...this.querySelectorAll('[data-view]')];
      const chapters = [...this.querySelectorAll('[data-chapter]')];
      const controls = [...this.querySelectorAll('[data-view-button]')];
      const clamp = n => Math.max(0, Math.min(1, n));
      let current = -1, manual, manualY = 0, manualUntil = 0;
      const setView = n => {
        if (n === current) return;
        current = n;
        frames.forEach((el,i) => {el.classList.toggle('is-current',i===n);el.setAttribute('aria-hidden',String(i!==n));});
        chapters.forEach((el,i) => {el.classList.toggle('is-current',i===n);el.setAttribute('aria-hidden',String(i!==n));});
        controls.forEach((el,i) => el.setAttribute('aria-pressed',String(i===n)));
        if (story) story.dataset.currentView = n;
        this.updateSignorePlayback?.();
      };
      const render = () => {
        this.raf = 0;
        const vh = innerHeight;
        const hh = Math.min(Math.ceil(header?.getBoundingClientRect().height || 80),Math.round(vh*.2));
        this.style.setProperty('--ga-header',`${hh}px`);
        if (hero) {
          const box = hero.getBoundingClientRect();
          document.body.classList.toggle('guillo-past-hero',box.bottom < hh+20);
          if (!reduced.matches) hero.style.setProperty('--campaign-exit',clamp(-box.top/(box.height*.9)).toFixed(4));
        }
        if (reduced.matches) {this.updateSignorePlayback?.();return;}
        headings.forEach(el => {
          const box=el.getBoundingClientRect();
          if (box.bottom>0 && box.top<vh) el.style.setProperty('--heading-in',clamp((vh*.98-box.top)/(vh*.22)).toFixed(4));
        });
        cards.forEach(card => {
          const box = card.querySelector('.ga-card__image').getBoundingClientRect();
          if (box.bottom > -100 && box.top < vh+200) card.style.setProperty('--ga-open',clamp((vh*.96-box.top)/(vh*.5)).toFixed(4));
        });
        scenes.forEach(scene => {
          const box = scene.getBoundingClientRect();
          if (box.bottom > -100 && box.top < vh+200) scene.style.setProperty('--scene-in',clamp((vh*.98-box.top)/(vh*.68)).toFixed(4));
        });
        if (story && immersive.matches && frames.length === 3) {
          const box = story.getBoundingClientRect();
          const progress = clamp((hh-box.top)/Math.max(1,box.height-stage.offsetHeight));
          story.style.setProperty('--ga-story-progress',progress.toFixed(4));
          if (manual !== undefined) {
            if (performance.now()<manualUntil) manualY=scrollY;
            else if (Math.abs(scrollY-manualY)>24) manual=undefined;
          }
          const view = manual ?? (progress<.36?0:progress<.72?1:2);
          setView(view);
          frames.forEach((frame,i) => {
            const open=manual!==undefined?Number(i<=manual):i===0?1:clamp((progress-(i===1?.18:.54))/.3);
            frame.style.setProperty('--frame-open',open.toFixed(4));
          });
        }
        this.updateSignorePlayback?.();
      };
      const schedule = () => {if (!this.raf) this.raf=requestAnimationFrame(render);};
      const motion = () => {
        this.classList.toggle('has-scroll-motion',!reduced.matches);
        this.classList.toggle('has-story-motion',!reduced.matches && immersive.matches && frames.length===3);
        hero?.classList.toggle('has-exit-motion',!reduced.matches);
        schedule();
      };
      controls.forEach(button => button.addEventListener('click',() => {manual=Number(button.dataset.viewButton);manualY=scrollY;manualUntil=performance.now()+500;setView(manual);schedule();},{signal}));
      const resumeScroll=()=>{manual=undefined;schedule();};
      window.addEventListener('wheel',resumeScroll,{passive:true,signal});
      window.addEventListener('touchmove',resumeScroll,{passive:true,signal});
      window.addEventListener('scroll',schedule,{passive:true,signal});
      window.addEventListener('resize',schedule,{passive:true,signal});
      reduced.addEventListener('change',motion,{signal});
      immersive.addEventListener('change',motion,{signal});
      const film=this.querySelector('[data-signore-film]');
      const connection=navigator.connection;
      const saveData=connection?.saveData || /^(slow-2g|2g)$/.test(connection?.effectiveType || '');
      this.updateSignorePlayback=()=>{
        if (!film) return;
        const area=filmArea.getBoundingClientRect();
        const section=story.getBoundingClientRect();
        const headerBottom=Math.max(0,header?.getBoundingClientRect().bottom || 0);
        const visible=Math.max(0,Math.min(area.bottom,innerHeight)-Math.max(area.top,headerBottom));
        const viewHeight=Math.min(area.height,Math.max(1,innerHeight-headerBottom));
        const reached=section.top<=headerBottom+innerHeight*.12 && section.bottom>headerBottom;
        const allowed=reached && visible/viewHeight>=.7 && current===0 && !reduced.matches && !saveData && !document.hidden;
        if (!allowed) {film.pause();return;}
        if (!film.getAttribute('src')) {film.muted=true;film.src=film.dataset.src;}
        const playing=film.play();
        playing?.catch(()=>{});
      };
      if (film && stage) {
        film.addEventListener('playing',()=>film.classList.add('is-ready'),{signal});
        document.addEventListener('visibilitychange',this.updateSignorePlayback,{signal});
        reduced.addEventListener('change',this.updateSignorePlayback,{signal});
      }
      setView(0);motion();
    }
    disconnectedCallback() {this.abort?.abort();this.querySelector('[data-signore-film]')?.pause();cancelAnimationFrame(this.raf);document.body.classList.remove('guillo-past-hero');}
  });
}
