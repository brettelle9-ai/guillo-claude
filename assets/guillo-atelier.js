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
      const headings = [...this.querySelectorAll('.ga-heading h2,.ga-outfit h2')];
      const story = this.querySelector('.ga-signature');
      const stage = this.querySelector('.ga-signature__stage');
      const frames = [...this.querySelectorAll('[data-view]')];
      const chapters = [...this.querySelectorAll('[data-chapter]')];
      const controls = [...this.querySelectorAll('[data-view-button]')];
      const clamp = n => Math.max(0, Math.min(1, n));
      let current = -1, manual, manualY = 0;
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
        if (reduced.matches) return;
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
          if (manual !== undefined && Math.abs(scrollY-manualY)>24) manual=undefined;
          const view = manual ?? (progress<.36?0:progress<.72?1:2);
          setView(view);
          frames.forEach((frame,i) => {
            const open=manual!==undefined?Number(i<=manual):i===0?1:clamp((progress-(i===1?.18:.54))/.3);
            frame.style.setProperty('--frame-open',open.toFixed(4));
          });
        }
      };
      const schedule = () => {if (!this.raf) this.raf=requestAnimationFrame(render);};
      const motion = () => {
        this.classList.toggle('has-scroll-motion',!reduced.matches);
        this.classList.toggle('has-story-motion',!reduced.matches && immersive.matches && frames.length===3);
        hero?.classList.toggle('has-exit-motion',!reduced.matches);
        schedule();
      };
      controls.forEach(button => button.addEventListener('click',() => {manual=Number(button.dataset.viewButton);manualY=scrollY;setView(manual);schedule();},{signal}));
      window.addEventListener('scroll',schedule,{passive:true,signal});
      window.addEventListener('resize',schedule,{passive:true,signal});
      reduced.addEventListener('change',motion,{signal});
      immersive.addEventListener('change',motion,{signal});
      const film=this.querySelector('[data-signore-film]');
      this.signoreInView=false;
      const connection=navigator.connection;
      const saveData=connection?.saveData || /^(slow-2g|2g)$/.test(connection?.effectiveType || '');
      this.updateSignorePlayback=()=>{
        if (!film) return;
        const allowed=this.signoreInView && current===0 && !reduced.matches && !saveData && !document.hidden;
        if (!allowed) {film.pause();return;}
        if (!film.getAttribute('src')) {film.muted=true;film.src=film.dataset.src;}
        const playing=film.play();
        playing?.catch(()=>{});
      };
      if (film && stage) {
        film.addEventListener('playing',()=>film.classList.add('is-ready'),{signal});
        this.signoreObserver=new IntersectionObserver(entries=>{
          this.signoreInView=entries[0].isIntersecting;
          this.updateSignorePlayback();
        },{threshold:.15});
        this.signoreObserver.observe(stage);
        document.addEventListener('visibilitychange',this.updateSignorePlayback,{signal});
        reduced.addEventListener('change',this.updateSignorePlayback,{signal});
      }
      setView(0);motion();
      const form=this.querySelector('[data-guillo-outfit]');
      if (form) {
        const items=[...form.querySelectorAll('[data-outfit-item]')];
        const status=form.querySelector('[data-outfit-status]');
        const button=form.querySelector('button[type="submit"]');
        button.hidden=false;
        form.addEventListener('change',event => {
          if (event.target.matches('[data-outfit-size]')) event.target.closest('[data-outfit-item]').querySelector('[data-outfit-include]').checked=Boolean(event.target.value);
          status.classList.remove('is-error');status.textContent='Choose the pieces and sizes you want.';
        },{signal});
        form.addEventListener('submit',async event => {
          event.preventDefault();
          if (button.disabled) return;
          const chosen=items.filter(el=>el.querySelector('[data-outfit-include]').checked);
          const missing=chosen.find(el=>!el.querySelector('[data-outfit-size]').value);
          if (!chosen.length || missing) {
            status.classList.add('is-error');status.textContent=missing?'Choose a size for each selected piece.':'Select at least one piece and choose its size.';
            if (missing) missing.querySelector('select').focus();
            return;
          }
          button.disabled=true;status.textContent='Adding your selected pieces…';
          try {
            const response=await fetch(form.dataset.addUrl,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({items:chosen.map(el=>({id:Number(el.querySelector('select').value),quantity:1}))})});
            const result=await response.json();
            if (!response.ok) throw new Error(result.description || 'Unable to add these pieces. Please check availability and try again.');
            status.classList.remove('is-error');status.textContent='Your selected pieces are in the bag.';
            if (window.GuilloCart) {
              try {await window.GuilloCart.refresh(true);window.GuilloCart.notifyAdded({});}
              catch {location.assign(form.dataset.cartUrl);}
            }
            else location.assign(form.dataset.cartUrl);
          } catch(error) {status.classList.add('is-error');status.textContent=error.message;}
          finally {button.disabled=false;}
        },{signal});
      }
    }
    disconnectedCallback() {this.abort?.abort();this.signoreObserver?.disconnect();this.querySelector('[data-signore-film]')?.pause();cancelAnimationFrame(this.raf);document.body.classList.remove('guillo-past-hero');}
  });
}
