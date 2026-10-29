if (!customElements.get('guillo-runway')) customElements.define('guillo-runway', class extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready=true; this.abort=new AbortController(); this.track=this.querySelector('.gr-track');
    this.allLooks=[...this.querySelectorAll('[data-gr-look]')];this.looks=this.allLooks;
    this.content=this.querySelector('[data-gr-content]');
    if(!this.looks.length)return;
    this.index=Math.floor(this.looks.length/2); this.position=this.index; this.target=this.index; this.velocity=0;
    this.progress=0; this.detail=false; this.paused=false; this.inView=false; this.direction=1; this.sizes=new Map();
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.money=value=>new Intl.NumberFormat(document.documentElement.lang||'en',{style:'currency',currency:this.dataset.currency||'AUD'}).format(value/100);
    const on=(node,event,fn,options={})=>node.addEventListener(event,fn,{...options,signal:this.abort.signal});
    on(this,'click',e=>this.click(e));
    on(this,'keydown',e=>{
      if(e.target.matches('input,textarea'))return;
      if(e.key==='Escape'&&this.detail){e.preventDefault();this.close();}
      if(!this.detail&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();this.go(this.index+(e.key==='ArrowRight'?1:-1));}
    });
    on(this.track,'pointerdown',e=>{
      if(this.detail||e.button!==0)return;
      this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,position:this.position,lastX:e.clientX,lastTime:performance.now(),velocity:0,active:false};
      this.stopAuto();
    });
    on(window,'pointermove',e=>{
      const d=this.drag;if(!d||d.id!==e.pointerId)return;
      const dx=e.clientX-d.x,dy=e.clientY-d.y;
      if(!d.active){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){this.drag=null;this.scheduleAuto();return;}if(Math.abs(dx)<6)return;d.active=true;this.classList.add('is-dragging');}
      const now=performance.now(),dt=Math.max(.008,(now-d.lastTime)/1000);
      d.velocity=-(e.clientX-d.lastX)/this.step/dt;d.lastX=e.clientX;d.lastTime=now;
      const raw=d.position-dx/this.step;this.position=Math.max(-.18,Math.min(this.looks.length-1+.18,raw));
      this.target=this.position;this.velocity=0;this.index=this.clamp(Math.round(this.position));this.paint();this.controls();
    });
    const release=e=>{
      const d=this.drag;if(!d||d.id!==e.pointerId)return;this.drag=null;this.classList.remove('is-dragging');
      if(d.active){this.suppressClickUntil=performance.now()+350;this.velocity=d.velocity*.3;this.go(Math.round(this.position+d.velocity*.15));}else this.scheduleAuto();
    };
    on(window,'pointerup',release);on(window,'pointercancel',release);
    on(this.track,'dragstart',e=>e.preventDefault());
    on(this.track,'wheel',e=>{
      if(this.detail||e.ctrlKey)return;
      const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
      if(!delta)return;
      const factor=e.deltaMode===1?16:e.deltaMode===2?this.track.clientWidth:1;
      const next=this.target+delta*factor/this.step;
      if((next<0&&this.target<=.001)||(next>this.looks.length-1&&this.target>=this.looks.length-1-.001))return;
      e.preventDefault();this.stopAuto();this.target=Math.max(0,Math.min(this.looks.length-1,next));
      this.index=this.clamp(Math.round(this.target));this.controls();this.animate();
      clearTimeout(this.wheelTimer);this.wheelTimer=setTimeout(()=>{this.go(Math.round(this.target));},150);
    },{passive:false});
    on(this,'pointerenter',()=>{this.hovered=true;this.stopAuto();});
    on(this,'pointerleave',()=>{this.hovered=false;this.scheduleAuto();});
    on(this,'focusin',()=>{this.focused=true;this.stopAuto();});
    on(this,'focusout',e=>{if(!this.contains(e.relatedTarget)){this.focused=false;this.scheduleAuto();}});
    on(document,'visibilitychange',()=>document.hidden?this.stopAuto():this.scheduleAuto());
    on(document,'shopify:block:select',e=>{const i=this.looks.findIndex(look=>look===e.target||look.contains(e.target));if(i>=0){if(this.detail)this.close(false);this.go(i);}});
    this.resize=new ResizeObserver(()=>{this.style.setProperty('--gr-track-height',`${this.track.clientHeight}px`);this.width=this.track.clientWidth;this.mobile=this.width<750;this.step=this.mobile?this.width*.57:Math.min(300,this.width*.235);this.paint();});this.resize.observe(this.track);
    this.visibility=new IntersectionObserver(entries=>{this.inView=entries[0].isIntersecting;if(this.inView)this.scheduleAuto();else this.stopAuto();},{threshold:.35});this.visibility.observe(this);
    this.style.setProperty('--gr-track-height',`${this.track.clientHeight}px`);this.width=this.track.clientWidth;this.mobile=this.width<750;this.step=this.mobile?this.width*.57:Math.min(300,this.width*.235);
    this.setMode(false);this.classList.add('is-ready');
  }
  disconnectedCallback(){this.abort?.abort();this.resize?.disconnect();this.visibility?.disconnect();cancelAnimationFrame(this.raf);this.stopAuto();clearTimeout(this.wheelTimer);clearTimeout(this.hideTimer);clearTimeout(this.highlightTimer);}
  setMode(night){
    if(this.busy)return;
    const current=this.looks[this.index];
    const candidates=this.allLooks.filter(look=>look.dataset.period==='both'||look.dataset.period===(night?'night':'day'));
    if(!candidates.length)return;
    if(this.detail&&!candidates.includes(current)){this.close(false);this.progress=0;this.selectedIndex=null;this.content.hidden=true;}
    this.classList.toggle('is-night',night);
    this.querySelector('[data-gr-night]').setAttribute('aria-checked',String(night));
    this.looks=candidates;
    this.allLooks.forEach(look=>{look.hidden=!candidates.includes(look);});
    this.index=Math.max(0,candidates.indexOf(current));this.position=this.index;this.target=this.index;this.velocity=0;
    if(this.detail)this.selectedIndex=this.index;
    this.querySelectorAll('[data-gr-dot]').forEach((dot,i)=>{dot.hidden=!candidates.includes(this.allLooks[i]);});
    this.querySelector('[data-gr-intro]').textContent=`${candidates.length} ${night?'evening':'day'} looks, styled head to toe. Select a look to explore the pieces.`;
    this.paint();this.controls();this.scheduleAuto();
  }
  clamp(value){return Math.max(0,Math.min(this.looks.length-1,value));}
  stopAuto(){clearTimeout(this.autoTimer);}
  scheduleAuto(){this.stopAuto();if(this.paused||this.reduced||this.detail||this.hovered||this.focused||this.drag||!this.inView||document.hidden||this.looks.length<2)return;this.autoTimer=setTimeout(()=>{if(this.index>=this.looks.length-1)this.direction=-1;if(this.index<=0)this.direction=1;this.go(this.index+this.direction);},4500);}
  animate(){if(this.raf)return;this.lastFrame=performance.now();this.raf=requestAnimationFrame(now=>this.frame(now));}
  frame(now){
    this.raf=0;const dt=Math.min(.035,Math.max(.001,(now-this.lastFrame)/1000));this.lastFrame=now;
    let moving=false;
    if(!this.drag?.active){
      const acceleration=(this.target-this.position)*165-this.velocity*23;
      this.velocity+=acceleration*dt;this.position+=this.velocity*dt;
      if(this.reduced||Math.abs(this.position-this.target)<.0005&&Math.abs(this.velocity)<.006){this.position=this.target;this.velocity=0;}else moving=true;
    }
    const goal=this.detail?1:0;
    if(this.reduced)this.progress=goal;
    else if(this.progress!==goal){const t=Math.min(1,(now-this.progressStarted)/550);this.progress=this.progressFrom+(goal-this.progressFrom)*(1-Math.pow(1-t,3));if(t<1)moving=true;else this.progress=goal;}
    this.paint();
    if(moving)this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  paint(){
    if(!this.width)return;
    const p=this.progress||0;this.style.setProperty('--gr-light-x',`${(50-(this.mobile?0:16.5)*p).toFixed(2)}%`);
    this.looks.forEach((look,i)=>{
      const offset=i-this.position,distance=Math.abs(offset),scale=1-Math.min(distance,2.5)*.085;
      let x=offset*this.step,s=scale,opacity=distance>3?0:1,blur=Math.min(3,Math.max(0,distance-.12)*1.05);
      if(this.selectedIndex===i){const selectedX=this.mobile?0:-this.width*.165;x=x*(1-p)+selectedX*p;s=scale*(1-p)+1.045*p;blur*=1-p;}
      else opacity*=1-p;
      look.style.setProperty('--look-x',`${x.toFixed(3)}px`);look.style.setProperty('--look-scale',s.toFixed(4));look.style.setProperty('--look-opacity',opacity.toFixed(4));look.style.setProperty('--look-blur',`${blur.toFixed(3)}px`);look.style.setProperty('--look-depth',String(20-Math.round(distance*2)));
    });
  }
  controls(){
    this.looks.forEach((look,i)=>{
      const chosen=this.detail&&i===this.index;look.classList.toggle('is-active',i===this.index);look.classList.toggle('is-chosen',chosen);
      look.inert=!!this.detail&&!chosen;look.querySelector('[data-gr-open]').setAttribute('aria-expanded',String(chosen));
      const pins=look.querySelector('.gr-pins');pins.inert=!chosen;pins.setAttribute('aria-hidden',String(!chosen));
    });
    this.querySelector('[data-gr-current]').textContent=String(this.allLooks.indexOf(this.looks[this.index])+1).padStart(2,'0');this.querySelector('[data-gr-title]').textContent=this.looks[this.index].dataset.title;
    this.querySelectorAll('[data-gr-dot]').forEach((dot,i)=>dot.setAttribute('aria-pressed',String(this.allLooks[i]===this.looks[this.index])));
    this.querySelector('[data-gr-prev]').disabled=this.index===0;this.querySelector('[data-gr-next]').disabled=this.index===this.looks.length-1;
    this.querySelector('.gr-selected-heading').setAttribute('aria-hidden',String(!this.detail));
    this.querySelector('.gr-controls').inert=!!this.detail;
  }
  go(index){if(this.busy||this.detail)return;this.index=this.clamp(index);this.target=this.index;this.controls();this.animate();this.scheduleAuto();}
  click(e){
    const button=e.target.closest('button');if(!button||!this.contains(button))return;
    if(button.matches('[data-gr-night]'))this.setMode(!this.classList.contains('is-night'));
    else if(button.matches('[data-gr-open]')){if(performance.now()<(this.suppressClickUntil||0)){e.preventDefault();return;}if(!this.detail)this.open(this.looks.indexOf(button.closest('[data-gr-look]')),button);}
    else if(button.matches('[data-gr-prev]'))this.go(this.index-1);
    else if(button.matches('[data-gr-next]'))this.go(this.index+1);
    else if(button.matches('[data-gr-dot]'))this.go(this.looks.indexOf(this.allLooks[Number(button.dataset.grDot)]));
    else if(button.matches('[data-gr-pause]')){this.paused=!this.paused;button.textContent=this.paused?'▷':'Ⅱ';button.setAttribute('aria-label',this.paused?'Play runway':'Pause runway');button.setAttribute('aria-pressed',String(this.paused));this.scheduleAuto();}
    else if(button.matches('[data-gr-close]'))this.close();
    else if(button.matches('[data-gr-pin]'))this.revealPiece(button.dataset.grPin);
    else if(button.matches('[data-gr-size-toggle]'))this.toggleSizes(button.closest('[data-gr-piece]'));
    else if(button.matches('[data-gr-variant]'))this.selectSize(button);
    else if(button.matches('[data-gr-add-one]'))this.add([button.closest('[data-gr-piece]')],button);
    else if(button.matches('[data-gr-add-all]'))this.add([...this.content.querySelectorAll('[data-gr-piece]')],button);
  }
  open(index,trigger){
    clearTimeout(this.hideTimer);this.stopAuto();this.drag=null;this.classList.remove('is-dragging');this.index=index;this.selectedIndex=index;this.target=index;this.trigger=trigger;this.progressFrom=this.progress;this.progressStarted=performance.now();this.detail=true;
    this.render();this.content.hidden=false;this.content.inert=false;this.querySelector('[data-gr-close]').hidden=false;this.controls();
    requestAnimationFrame(()=>{if(this.detail)this.classList.add('is-detail');});this.animate();
  }
  close(restoreFocus=true){
    if(this.busy)return;this.progressFrom=this.progress;this.progressStarted=performance.now();this.detail=false;this.classList.remove('is-detail');this.content.inert=true;this.querySelector('[data-gr-close]').hidden=true;this.controls();this.animate();
    clearTimeout(this.hideTimer);this.hideTimer=setTimeout(()=>{if(!this.detail){this.content.hidden=true;this.selectedIndex=null;}},this.reduced?0:800);
    if(restoreFocus)this.looks[this.index].querySelector('[data-gr-open]').focus({preventScroll:true});this.scheduleAuto();
  }
  render(){
    this.content.replaceChildren(this.looks[this.index].querySelector('template').content.cloneNode(true));
    this.content.querySelectorAll('[data-gr-piece]').forEach(piece=>{
      const saved=this.sizes.get(piece.dataset.product),variants=[...piece.querySelectorAll('[data-gr-variant]')],available=variants.filter(v=>!v.disabled);
      const chosen=variants.find(v=>v.dataset.grVariant===saved&&!v.disabled)||available.find(v=>v.dataset.label==='Default Title');
      if(chosen)this.selectSize(chosen,false);
    });
    this.total();
    const unavailable=[...this.content.querySelectorAll('[data-gr-piece]')].some(piece=>![...piece.querySelectorAll('[data-gr-variant]')].some(v=>!v.disabled));
    this.content.querySelector('[data-gr-add-all]').disabled=unavailable;
    if(unavailable)this.status('One piece is sold out. Available pieces can be added separately.');
  }
  toggleSizes(piece,force){const options=piece.querySelector('[data-gr-options]'),button=piece.querySelector('[data-gr-size-toggle]');const open=force===undefined?options.hidden:force;options.hidden=!open;button.setAttribute('aria-expanded',String(open));button.textContent=open?'−':'+';}
  revealPiece(index){
    const piece=this.content.querySelector(`[data-gr-piece][data-index="${index}"]`);if(!piece)return;
    this.content.querySelectorAll('[data-gr-piece]').forEach(other=>{other.classList.toggle('is-highlighted',other===piece);this.toggleSizes(other,other===piece);});
    this.looks[this.index].querySelectorAll('[data-gr-pin]').forEach(pin=>pin.classList.toggle('is-active',pin.dataset.grPin===index));
    if(this.mobile)piece.scrollIntoView({behavior:this.reduced?'instant':'smooth',block:'nearest'});
    else{const list=this.content.querySelector('.gr-pieces');if(piece.offsetTop+piece.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTo({top:piece.offsetTop-list.offsetTop,behavior:this.reduced?'instant':'smooth'});}
    clearTimeout(this.highlightTimer);this.highlightTimer=setTimeout(()=>piece.classList.remove('is-highlighted'),1600);
  }
  selectSize(button,update=true){
    if(button.disabled)return;const piece=button.closest('[data-gr-piece]');piece.dataset.selected=button.dataset.grVariant;piece.dataset.selectedPrice=button.dataset.price;
    this.sizes.set(piece.dataset.product,button.dataset.grVariant);piece.querySelectorAll('[data-gr-variant]').forEach(v=>v.setAttribute('aria-pressed',String(v===button)));
    piece.querySelector('[data-gr-size-label]').textContent=button.dataset.label==='Default Title'?'One size':`Size ${button.dataset.label}`;
    piece.querySelector('[data-gr-price]').textContent=this.money(Number(button.dataset.price));piece.querySelector('[data-gr-add-one]').disabled=false;
    if(update){this.total();this.status('');}
  }
  total(){let sum=0;this.content.querySelectorAll('[data-gr-piece]').forEach(piece=>{sum+=Number(piece.dataset.selectedPrice||piece.dataset.price||0);});this.content.querySelector('[data-gr-total]').textContent=this.money(sum);}
  status(message){this.content.querySelector('[data-gr-status]').textContent=message;}
  async add(pieces,button){
    if(this.busy)return;const missing=pieces.find(piece=>!piece.dataset.selected);
    if(missing){this.status('Choose a size for each piece you want to add.');this.toggleSizes(missing,true);missing.querySelector('[data-gr-variant]:not([disabled])')?.focus({preventScroll:true});return;}
    const items=pieces.map(piece=>({id:piece.dataset.selected,quantity:1}));this.busy=true;const label=button.textContent;
    this.querySelectorAll('button').forEach(el=>{el.dataset.grDisabled=String(el.disabled);el.disabled=true;});button.textContent='Adding…';this.status('');
    try{
      const response=await fetch(`${this.dataset.root||'/'}cart/add.js`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items,sections:[...new Set([...document.querySelectorAll('cart-items-component[data-section-id]')].map(el=>el.dataset.sectionId))].slice(0,5).join(','),sections_url:location.pathname.startsWith('/')?location.pathname:(this.dataset.root||'/')})});
      const data=await response.json();if(!response.ok)throw new Error(data.description||data.message||'Unable to add these pieces. Please try again.');
      this.status(items.length===1?'Piece added to your bag.':'Your complete look has been added to your bag.');this.content.querySelector('.gr-cart-link').hidden=false;
      document.dispatchEvent(new CustomEvent('cart:update',{bubbles:true,detail:{resource:{},sourceId:this.id,data:{source:'product-form-component',itemCount:items.length,sections:data.sections}}}));
    }catch(error){this.status(error.message||'Unable to add. Please try again.');}
    finally{this.busy=false;button.textContent=label;this.querySelectorAll('[data-gr-disabled]').forEach(el=>{el.disabled=el.dataset.grDisabled==='true';delete el.dataset.grDisabled;});}
  }
});