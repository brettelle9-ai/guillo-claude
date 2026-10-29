if (!customElements.get('guillo-runway')) customElements.define('guillo-runway', class extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.abort = new AbortController();
    this.track = this.querySelector('.gr-track');
    this.looks = [...this.querySelectorAll('[data-gr-look]')];
    this.content = this.querySelector('[data-gr-content]');
    this.index = Math.floor(this.looks.length / 2);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sizes = new Map();
    this.money = value => new Intl.NumberFormat(document.documentElement.lang || 'en', {style:'currency', currency:this.dataset.currency || 'AUD'}).format(value / 100);
    const on = (node, type, callback) => node.addEventListener(type, callback, {signal:this.abort.signal});
    on(this, 'click', e => this.click(e));
    on(this, 'change', e => {
      if (!e.target.matches('[data-gr-variant]')) return;
      this.sizes.set(e.target.closest('[data-gr-piece]').dataset.product, e.target.value);
      this.total(); this.status('');
      const option = e.target.value ? e.target.selectedOptions[0] : [...e.target.options].find(o => o.value && !o.disabled);
      e.target.closest('.gr-piece').querySelector('[data-gr-price]').textContent = this.money(Number(option?.dataset.price || 0));
    });
    on(this, 'keydown', e => {
      if (e.target.matches('select,input,textarea')) return;
      if (e.key === 'Escape' && this.detail) { e.preventDefault(); this.close(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); this.go(this.index + (e.key === 'ArrowRight' ? 1 : -1));
      }
    });
    on(this.track, 'pointerdown', e => {
      if (this.detail || e.target.closest('[data-gr-pin]')) return;
      this.pointer = {x:e.clientX,y:e.clientY,id:e.pointerId}; this.swiped = false;
    });
    on(this.track, 'pointerup', e => {
      if (!this.pointer || this.detail || this.pointer.id !== e.pointerId) return;
      const dx = e.clientX - this.pointer.x, dy = e.clientY - this.pointer.y;
      this.pointer = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        this.swiped = true; this.go(this.index + (dx < 0 ? 1 : -1));
        clearTimeout(this.swipeTimer); this.swipeTimer = setTimeout(() => {this.swiped=false;},250);
      }
    });
    on(this.track, 'pointercancel', () => {this.pointer=null;});
    on(document, 'shopify:block:select', e => {
      const i = this.looks.findIndex(look => look.contains(e.target) || look === e.target);
      if (i >= 0) {if(this.detail)this.close(false); this.go(i);}
    });
    this.sync();
    requestAnimationFrame(() => this.classList.add('is-ready'));
  }
  disconnectedCallback() {
    this.abort?.abort(); clearTimeout(this.switchTimer); clearTimeout(this.closeTimer);
    clearTimeout(this.swipeTimer); clearTimeout(this.highlightTimer);
  }
  click(e) {
    const button = e.target.closest('button');
    if (!button || !this.contains(button)) return;
    if (button.matches('[data-gr-open]')) {
      if (this.swiped) {e.preventDefault(); return;}
      if (!this.detail) this.open(this.looks.indexOf(button.closest('[data-gr-look]')), button);
    } else if (button.matches('[data-gr-prev]')) this.go(this.index - 1);
    else if (button.matches('[data-gr-next]')) this.go(this.index + 1);
    else if (button.matches('[data-gr-dot]')) this.go(Number(button.dataset.grDot));
    else if (button.matches('[data-gr-close]')) this.close();
    else if (button.matches('[data-gr-pin]')) {
      const piece = this.content.querySelector(`[data-gr-piece][data-index="${button.dataset.grPin}"]`);
      if (!piece) return;
      this.content.querySelectorAll('.is-highlighted').forEach(el => el.classList.remove('is-highlighted'));
      piece.classList.add('is-highlighted');
      piece.querySelector('select')?.focus({preventScroll:true});
      if (matchMedia('(max-width:749px)').matches) piece.scrollIntoView({behavior:this.reduced?'instant':'smooth',block:'center'});
      clearTimeout(this.highlightTimer); this.highlightTimer=setTimeout(()=>piece.classList.remove('is-highlighted'),1800);
    } else if (button.matches('[data-gr-add-one]')) this.add([button.closest('[data-gr-piece]')],button);
    else if (button.matches('[data-gr-add-all]')) this.add([...this.content.querySelectorAll('[data-gr-piece]')],button);
  }
  go(index) {
    if (this.busy || !this.looks.length) return;
    this.index = (index + this.looks.length) % this.looks.length;
    this.sync();
    if (this.detail) {
      this.classList.add('is-switching'); clearTimeout(this.switchTimer);
      this.switchTimer = setTimeout(() => {this.render();this.classList.remove('is-switching');},this.reduced?0:220);
    }
  }
  sync() {
    this.looks.forEach((look,i) => {
      const offset=i-this.index;
      look.style.setProperty('--offset',offset);
      look.style.setProperty('--scale',i===this.index?'1':'.82');
      look.style.setProperty('--opacity',i===this.index?'1':'.72');
      look.style.setProperty('--depth',String(10-Math.abs(offset)));
      look.classList.toggle('is-active',i===this.index);
      look.classList.toggle('is-chosen',this.detail && i===this.index);
      look.inert=!!this.detail && i!==this.index;
      look.querySelector('[data-gr-open]').setAttribute('aria-expanded',String(!!this.detail && i===this.index));
      const pins=look.querySelector('.gr-pins');
      pins.inert=!(this.detail && i===this.index);
      pins.setAttribute('aria-hidden',String(pins.inert));
    });
    this.querySelector('[data-gr-current]').textContent=String(this.index+1).padStart(2,'0');
    this.querySelector('[data-gr-title]').textContent=this.looks[this.index].dataset.title;
    this.querySelector('.gr-numbers').style.setProperty('--number-index',this.index);
    this.querySelectorAll('[data-gr-dot]').forEach((dot,i) => dot.setAttribute('aria-pressed',String(i===this.index)));
  }
  open(index, trigger) {
    clearTimeout(this.closeTimer);clearTimeout(this.switchTimer);
    this.index=index; this.trigger=trigger; this.detail=true;
    this.render(); this.sync();
    this.content.hidden=false; this.content.inert=false;
    this.querySelector('[data-gr-close]').hidden=false;
    this.querySelector('[data-gr-hint]').textContent='A closer look. Every piece, considered.';
    requestAnimationFrame(() => this.classList.add('is-detail'));
  }
  render() {
    this.content.replaceChildren(this.looks[this.index].querySelector('template').content.cloneNode(true));
    this.content.querySelectorAll('[data-gr-variant]').forEach(select => {
      const saved=this.sizes.get(select.closest('[data-gr-piece]').dataset.product);
      if (saved && [...select.options].some(option=>option.value===saved && !option.disabled)) select.value=saved;
      const available=[...select.options].filter(option=>option.value && !option.disabled);
      if (available.length===1 && available[0].textContent.trim()==='Default Title') select.value=available[0].value;
    });
    this.total();
    const soldOut=[...this.content.querySelectorAll('[data-gr-variant]')].some(select => ![...select.options].some(option=>option.value && !option.disabled));
    this.content.querySelector('[data-gr-add-all]').disabled=soldOut;
    if(soldOut)this.status('One piece is currently sold out. Available pieces can be added separately.');
  }
  close(restoreFocus=true) {
    if (this.busy) return;
    clearTimeout(this.switchTimer); this.classList.remove('is-detail','is-switching');
    this.detail=false; this.content.inert=true; this.sync();
    this.querySelector('[data-gr-close]').hidden=true;
    this.querySelector('[data-gr-hint]').textContent='Select a look. Make it yours.';
    clearTimeout(this.closeTimer);
    this.closeTimer=setTimeout(()=>{if(!this.detail)this.content.hidden=true;},this.reduced?0:700);
    if(restoreFocus)this.looks[this.index].querySelector('[data-gr-open]').focus({preventScroll:true});
  }
  total() {
    let sum=0;
    this.content.querySelectorAll('[data-gr-variant]').forEach(select=>{
      const option=select.value?select.selectedOptions[0]:[...select.options].find(o=>o.value&&!o.disabled);
      sum+=Number(option?.dataset.price||0);
    });
    this.content.querySelector('[data-gr-total]').textContent=this.money(sum);
  }
  status(message) { this.content.querySelector('[data-gr-status]').textContent=message; }
  async add(pieces,button) {
    if(this.busy)return;
    const missing=pieces.find(piece=>!piece.querySelector('select').value);
    if(missing){this.status('Choose a size for each piece you want to add.');missing.querySelector('select').focus();return;}
    const items=pieces.map(piece=>({id:piece.querySelector('select').value,quantity:1}));
    this.busy=true; const label=button.textContent;
    this.querySelectorAll('button,select').forEach(el=>{el.dataset.grDisabled=String(el.disabled);el.disabled=true;});
    button.textContent='Adding…';this.status('');
    try {
      const response=await fetch(`${this.dataset.root||'/'}cart/add.js`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items,sections:[...new Set([...document.querySelectorAll('cart-items-component[data-section-id]')].map(el=>el.dataset.sectionId))].slice(0,5).join(','),sections_url:location.pathname})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.description||'Unable to add these pieces. Please try again.');
      this.status(items.length===1?'Piece added to your bag.':'Your complete look has been added to your bag.');
      this.content.querySelector('.gr-cart-link').hidden=false;
      document.dispatchEvent(new CustomEvent('cart:update',{bubbles:true,detail:{resource:{},sourceId:this.id,data:{source:'product-form-component',itemCount:items.length,sections:data.sections}}}));
    } catch(error) {this.status(error.message||'Unable to add. Please try again.');}
    finally {
      this.busy=false;button.textContent=label;
      this.querySelectorAll('[data-gr-disabled]').forEach(el=>{el.disabled=el.dataset.grDisabled==='true';delete el.dataset.grDisabled;});
    }
  }
});
