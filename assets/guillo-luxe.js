/* Luxe-only enhancement. Native product form, colour links and size guide remain authoritative. */
(() => {
  'use strict';
  const root = document.querySelector('.guillo-pdp--stone');
  if (!root || root.dataset.luxeReady) return;
  root.dataset.luxeReady = 'true';
  const mainForm = root.querySelector('#GuilloProductForm');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const galleryMore = root.querySelector('[data-luxe-gallery-more]');
  galleryMore?.addEventListener('click', () => {
    const gallery = root.querySelector('[data-gallery]');
    const open = gallery.classList.toggle('is-expanded');
    galleryMore.setAttribute('aria-expanded', String(open));
    galleryMore.textContent = open ? 'Show fewer photographs −' : 'View all photographs +';
  });
  root.querySelector('[data-luxe-size-guide]')?.addEventListener('click', () => root.querySelector('[data-open-size-guide]')?.click());

  // Native dialog provides focus containment and Escape without a second modal framework.
  let lightbox;
  let pointerStart;
  root.addEventListener('pointerdown', event => { pointerStart = {x:event.clientX,y:event.clientY}; });
  root.querySelectorAll('[data-luxe-zoom]').forEach(button => {
    button.addEventListener('click', event => {
      if (pointerStart && (Math.abs(event.clientX-pointerStart.x)>12 || Math.abs(event.clientY-pointerStart.y)>12) && event.detail) return;
      if (!lightbox) {
        lightbox = document.createElement('dialog');
        lightbox.className = 'luxe-lightbox';
        lightbox.setAttribute('aria-label', 'Product photograph');
        const image = document.createElement('img');
        const close = document.createElement('button');
        close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label','Close photograph');
        close.addEventListener('click',()=>lightbox.close());
        lightbox.append(image,close); document.body.append(lightbox);
      }
      const image = lightbox.querySelector('img');
      image.src = button.dataset.luxeZoom;
      image.alt = button.querySelector('img').alt;
      lightbox.showModal();
    });
  });

  const revealElements = root.querySelectorAll('[data-luxe-reveal]');
  if ('IntersectionObserver' in window && !reduced.matches) {
    root.classList.add('luxe-reveal-ready');
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {entry.target.classList.add('is-visible');reveal.unobserve(entry.target);}
    }), {threshold:.12});
    revealElements.forEach(element=>reveal.observe(element));
    reduced.addEventListener('change',()=>{if(reduced.matches)revealElements.forEach(element=>element.classList.add('is-visible'));});
  }

  const film = root.querySelector('[data-luxe-film]');
  const filmToggle = root.querySelector('[data-luxe-film-toggle]');
  if (film && filmToggle) {
    let onScreen = false, userPaused = false, explicitlyPlaying = false;
    const label = () => {filmToggle.textContent=film.paused?'Play film':'Pause film';filmToggle.setAttribute('aria-label',film.paused?'Play the Luxe Chino film':'Pause the Luxe Chino film');};
    const play = () => {
      if (!film.getAttribute('src')) film.src=film.dataset.src;
      film.play().then(label).catch(label);
    };
    const updateFilm = () => {
      if (onScreen && !document.hidden && !userPaused && (explicitlyPlaying || (!reduced.matches && !navigator.connection?.saveData))) play();
      else {film.pause();label();}
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(entries=>{
      onScreen=entries[0].isIntersecting && entries[0].intersectionRatio>=.65;
      updateFilm();
    },{threshold:[0,.65]}).observe(film);
    filmToggle.addEventListener('click',()=>{
      if (film.paused) {userPaused=false;explicitlyPlaying=true;play();}
      else {userPaused=true;explicitlyPlaying=false;film.pause();label();}
    });
    document.addEventListener('visibilitychange',updateFilm);
    reduced.addEventListener('change',()=>{explicitlyPlaying=false;updateFilm();});
    film.addEventListener('play',label);film.addEventListener('pause',label);
  }

  const look = root.querySelector('[data-luxe-look]');
  if (!look || !mainForm) return;
  const form=look.querySelector('form');
  const base=look.querySelector('[data-luxe-base]');
  const add=look.querySelector('[data-luxe-look-add]');
  const status=look.querySelector('[data-luxe-look-status]');
  const pieces=[...look.querySelectorAll('[data-luxe-piece]')];
  const cfg=JSON.parse(look.querySelector('[data-luxe-money]').textContent);
  const currency=new Intl.NumberFormat(cfg.locale||'en',{style:'currency',currency:cfg.currency||'AUD',maximumFractionDigits:2});
  const money=cents=>currency.format(cents/100);
  let busy=false;
  const selected = () => [{select:base,included:true},...pieces.map(piece=>({select:piece.querySelector('select'),included:piece.querySelector('input').checked}))].filter(piece=>piece.included);
  const update = () => {
    const chosen=selected();
    const ready=chosen.every(piece=>!!piece.select.value&&!piece.select.selectedOptions[0].disabled);
    let total=chosen.reduce((sum,piece)=>sum+Number(piece.select.selectedOptions[0]?.dataset.luxePrice|| (piece.select===base?cfg.basePrice:piece.select.closest('[data-luxe-piece]').dataset.luxePrice)),0);
    const discounted=chosen.length>=3;
    const original=look.querySelector('[data-luxe-original]');
    original.hidden=!discounted;
    original.textContent=money(total);
    look.querySelector('[data-luxe-total]').textContent=money(discounted?Math.round(total*.8):total);
    look.querySelector('[data-luxe-look-hint]').textContent=!ready?'Choose a size for each selected piece.':discounted?'20% wardrobe offer included. Final total confirmed in your bag.':`${chosen.length} ${chosen.length===1?'piece':'pieces'} selected. Add 3+ pieces for the wardrobe offer.`;
    add.disabled=busy||!ready;
    add.textContent=busy?'Adding…':`Add ${chosen.length===1?'chino':'selected pieces'} to bag`;
    const sticky=root.querySelector('[data-luxe-sticky-size]');
    if(sticky) {
      const size=mainForm.querySelector('[data-option-value-label]')?.textContent;
      const colour=root.querySelector('.guillo-pdp__style')?.textContent.trim()||'';
      sticky.textContent=` · ${colour} · ${size&&size!=='Select'?size:'Choose size'}`;
    }
  };
  pieces.forEach(piece=>piece.querySelector('input').addEventListener('change',()=>{
    piece.querySelector('select').disabled=!piece.querySelector('input').checked;
    status.textContent='';update();
  }));
  form.addEventListener('change',()=>{status.textContent='';update();});
  mainForm.addEventListener('change',()=>queueMicrotask(()=>{
    const checked=mainForm.querySelector('[data-option-index] input:checked');
    const id=mainForm.querySelector('[name="id"]')?.value;
    if(checked&&[...base.options].some(option=>option.value===id&&!option.disabled)) base.value=id;
    update();
  }));
  base.addEventListener('change',()=>{
    const text=base.selectedOptions[0]?.textContent;
    const norm=value=>value.replace(/[″′"'\s]/g,'').toLowerCase();
    const radio=[...mainForm.querySelectorAll('[data-option-index] input[type=radio]')].find(input=>norm(input.value)===norm(text||''));
    if(radio&&!radio.disabled) {radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(add.disabled||busy) return;
    busy=true;status.textContent='';update();
    const items=selected().map(piece=>({id:Number(piece.select.value),quantity:1}));
    try {
      const response=await fetch((window.Shopify?.routes?.root||'/')+'cart/add.js',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.description||'That selection could not be added. Please check the sizes and try again.');
      status.textContent='Added to your bag.';
      // Cart refresh failing must never suggest retrying an already successful add.
      if(window.GuilloCart) {
        try {await window.GuilloCart.refresh();(window.GuilloCart.notifyAdded||window.GuilloCart.open)();}
        catch {status.textContent='Added to your bag. Open your bag to continue.';}
      } else location.assign((window.Shopify?.routes?.root||'/')+'cart');
    } catch(error) {status.textContent=error.message||'Could not add those pieces. Please try again.';}
    finally {busy=false;update();}
  });
  update();
})();
