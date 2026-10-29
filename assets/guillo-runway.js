if (!customElements.get('guillo-runway')) customElements.define('guillo-runway', class extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.abort = new AbortController();
    this.track = this.querySelector('.gr-track');
    this.looks = [...this.querySelectorAll('[data-gr-look]')];
    this.dialog = this.querySelector('dialog');
    this.content = this.querySelector('[data-gr-content]');
    this.index = Math.floor(this.looks.length / 2);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.money = value => new Intl.NumberFormat(document.documentElement.lang || 'en', {style:'currency', currency:this.dataset.currency || 'AUD'}).format(value / 100);
    const on = (node, type, callback) => node.addEventListener(type, callback, {signal:this.abort.signal});
    on(this, 'click', e => this.click(e));
    on(this, 'change', e => { if(e.target.matches('[data-gr-variant]')) { this.total(); this.status(''); const option=e.target.value?e.target.selectedOptions[0]:[...e.target.options].find(o=>o.value); e.target.closest('.gr-piece').querySelector('[data-gr-price]').textContent = this.money(Number(option?.dataset.price || 0)); } });
    on(this.track, 'scroll', () => { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => this.sync()); });
    on(this.track, 'keydown', e => { if(e.key === 'ArrowRight' || e.key === 'ArrowLeft') {e.preventDefault(); this.go(this.index + (e.key === 'ArrowRight' ? 1 : -1));} });
    on(this.dialog, 'cancel', e => {e.preventDefault();this.close();});
    on(this.dialog, 'click', e => {if(e.target === this.dialog) {const r=this.dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right)this.close();}});
    on(this.dialog,'close',()=>this.unlock());
    this.resize = new ResizeObserver(() => {if(!this.dialog.open)this.go(this.index, true);});
    this.resize.observe(this.track);
    this.visibility = new IntersectionObserver(entries => entries.forEach(entry => {this.inView=entry.isIntersecting;this.video();}),{threshold:.15});
    this.visibility.observe(this);
    on(document,'visibilitychange',()=>this.video());
    on(document,'shopify:block:select',e=>{const i=this.looks.findIndex(look=>look.contains(e.target)||look===e.target);if(i>=0)this.go(i);});
    this.go(this.index, true);
    this.sync();
  }
  disconnectedCallback(){this.abort?.abort();this.resize?.disconnect();this.visibility?.disconnect();cancelAnimationFrame(this.raf);clearTimeout(this.closeTimer);this.unlock();}
  go(index, instant=false){this.index=(index+this.looks.length)%this.looks.length;const look=this.looks[this.index];this.track.scrollTo({left:look.offsetLeft-this.track.offsetLeft-(this.track.clientWidth-look.clientWidth)/2,behavior:instant||this.reduced?'instant':'smooth'});}
  sync(){const rect=this.track.getBoundingClientRect();const center=rect.left+rect.width/2;let nearest=0,distance=Infinity;this.looks.forEach((look,i)=>{const r=look.getBoundingClientRect();const d=Math.abs(r.left+r.width/2-center);if(d<distance){distance=d;nearest=i;}});this.index=nearest;this.looks.forEach((look,i)=>look.classList.toggle('is-active',i===nearest));this.querySelector('[data-gr-current]').textContent=String(nearest+1).padStart(2,'0');this.querySelectorAll('[data-gr-dot]').forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===nearest)));this.video();}
  video(){this.looks.forEach((look,i)=>{const video=look.querySelector('video');if(!video)return;if(i===this.index&&this.inView&&!document.hidden&&!this.dialog.open&&!this.reduced)video.play().catch(()=>{});else video.pause();});}
  click(e){const button=e.target.closest('button');if(!button)return;if(button.matches('[data-gr-open]'))this.open(this.looks.indexOf(button.closest('[data-gr-look]')),button);else if(button.matches('[data-gr-prev]'))this.go(this.index-1);else if(button.matches('[data-gr-next]'))this.go(this.index+1);else if(button.matches('[data-gr-dot]'))this.go(Number(button.dataset.grDot));else if(button.matches('[data-gr-close]'))this.close();else if(button.matches('[data-gr-detail-prev],[data-gr-detail-next]'))this.show(this.detailIndex+(button.hasAttribute('data-gr-detail-next')?1:-1));else if(button.matches('[data-gr-pin]')){const piece=this.content.querySelector(`[data-gr-piece][data-index="${button.dataset.grPin}"]`);piece?.scrollIntoView({behavior:this.reduced?'instant':'smooth',block:'nearest'});piece?.querySelector('select')?.focus({preventScroll:true});}else if(button.matches('[data-gr-add-one]'))this.add([button.closest('[data-gr-piece]')],button);else if(button.matches('[data-gr-add-all]'))this.add([...this.content.querySelectorAll('[data-gr-piece]')],button);}
  open(index, trigger){clearTimeout(this.closeTimer);this.trigger=trigger;this.show(index);this.previousOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';this.locked=true;this.dialog.showModal();requestAnimationFrame(()=>requestAnimationFrame(()=>this.dialog.classList.add('is-visible')));this.video();}
  show(index){this.detailIndex=(index+this.looks.length)%this.looks.length;this.content.replaceChildren(this.looks[this.detailIndex].querySelector('template').content.cloneNode(true));this.dialog.scrollTop=0;this.total();}
  close(){if(this.busy)return;this.dialog.classList.remove('is-visible');this.closeTimer=setTimeout(()=>{this.dialog.close();this.trigger?.focus({preventScroll:true});this.video();},this.reduced?0:450);}
  unlock(){if(this.locked){document.documentElement.style.overflow=this.previousOverflow;this.locked=false;}}
  total(){let sum=0;this.content.querySelectorAll('[data-gr-variant]').forEach(select=>{const option=select.value?select.selectedOptions[0]:[...select.options].find(o=>o.value&&!o.disabled);sum+=Number(option?.dataset.price||0);});this.content.querySelector('[data-gr-total]').textContent=this.money(sum);}
  status(message){this.content.querySelector('[data-gr-status]').textContent=message;}
  async add(pieces,button){if(this.busy)return;const missing=pieces.find(piece=>!piece.querySelector('select').value);if(missing){this.status('Choose a size for each piece you want to add.');missing.querySelector('select').focus();return;}
    const items=pieces.map(piece=>({id:piece.querySelector('select').value,quantity:1}));this.busy=true;const label=button.textContent;this.dialog.querySelectorAll('button,select').forEach(el=>{el.dataset.grDisabled=String(el.disabled);el.disabled=true;});button.textContent='Adding…';this.status('');
    try{const response=await fetch(`${this.dataset.root || '/'}cart/add.js`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items,sections:[...new Set([...document.querySelectorAll('cart-items-component[data-section-id]')].map(el=>el.dataset.sectionId))].slice(0,5).join(','),sections_url:location.pathname})});const data=await response.json();if(!response.ok)throw new Error(data.description||'Unable to add these pieces. Please try again.');this.status(items.length===1?'Piece added to your bag.':'Your complete look has been added to your bag.');this.content.querySelector('.gr-cart-link').hidden=false;document.dispatchEvent(new CustomEvent('cart:update',{bubbles:true,detail:{resource:{},sourceId:this.id,data:{source:'product-form-component',itemCount:items.length,sections:data.sections}}}));
    }catch(error){this.status(error.message || 'Unable to add. Please try again.');}finally{this.busy=false;button.textContent=label;this.dialog.querySelectorAll('[data-gr-disabled]').forEach(el=>{el.disabled=el.dataset.grDisabled==='true';delete el.dataset.grDisabled;});}
  }
});
