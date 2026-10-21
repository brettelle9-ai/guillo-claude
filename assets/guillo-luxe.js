/* Luxe-only enhancement. Native product form, colour links and size guide remain authoritative. */
(() => {
  'use strict';
  const root = document.querySelector('.guillo-pdp--stone');
  if (!root || root.dataset.luxeReady) return;
  root.dataset.luxeReady = 'true';
  const mainForm = root.querySelector('#GuilloProductForm');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
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
  let updateFilm = () => {};
  if (film) {
    let onScreen = false;
    updateFilm = () => {
      const selected = !film.closest('[data-luxe-detail-view]')?.hidden;
      if (onScreen && selected && !document.hidden && !reduced.matches && !navigator.connection?.saveData) {
        if (!film.getAttribute('src')) film.src = film.dataset.src;
        film.play().catch(() => {});
      } else film.pause();
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      onScreen = entries[0].isIntersecting && entries[0].intersectionRatio >= .65;
      updateFilm();
    }, {threshold:[0,.65]}).observe(film);
    document.addEventListener('visibilitychange', updateFilm);
    reduced.addEventListener('change', updateFilm);
  }

  // Quiet crossfade between five real customer quotes; the layout never jumps.
  const voices = root.querySelector('[data-luxe-quotes]');
  if (voices) {
    const slides = Array.from(voices.querySelectorAll('[data-luxe-quote]'));
    const dots = Array.from(voices.querySelectorAll('[data-luxe-quote-dot]'));
    const pause = voices.querySelector('[data-luxe-quotes-pause]');
    let index = 0, timer, visible = false, hovering = false, focused = false, paused = reduced.matches;
    const stop = () => {clearTimeout(timer);timer = undefined;};
    const schedule = () => {
      stop();
      if (slides.length > 1 && visible && !paused && !hovering && !focused && !document.hidden) timer = setTimeout(() => {show(index + 1);schedule();}, 7000);
    };
    const show = next => {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide,i) => {slide.classList.toggle('is-current',i === index);slide.setAttribute('aria-hidden',String(i !== index));});
      dots.forEach((dot,i) => dot.setAttribute('aria-pressed',String(i === index)));
    };
    const labelPause = () => {
      if (!pause) return;
      pause.setAttribute('aria-label',paused?'Play rotating reviews':'Pause rotating reviews');
      pause.querySelector('span').textContent = paused?'▷':'Ⅱ';
    };
    dots.forEach((dot,i) => dot.addEventListener('click',() => {show(i);schedule();}));
    pause?.addEventListener('click',() => {paused = !paused;labelPause();schedule();});
    voices.addEventListener('mouseenter',() => {hovering = true;stop();});
    voices.addEventListener('mouseleave',() => {hovering = false;schedule();});
    voices.addEventListener('focusin',() => {focused = true;stop();});
    voices.addEventListener('focusout',event => {if (!voices.contains(event.relatedTarget)) {focused = false;schedule();}});
    document.addEventListener('visibilitychange',schedule);
    reduced.addEventListener('change',() => {paused = reduced.matches;labelPause();schedule();});
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {visible = entries[0].isIntersecting;schedule();},{threshold:0}).observe(voices);
    else {visible = true;schedule();}
    labelPause();
  }

  // An active size action guides the shopper; it never chooses a variant for them.
  const sizeWrap=mainForm?.querySelector('[data-option-index]');
  const variants=JSON.parse(root.querySelector('[data-variant-data]').textContent);
  let fitData={};
  try {fitData=JSON.parse(root.querySelector('[data-gff-data]')?.textContent||'{}');} catch {}
  const norm=value=>String(value||'').replace(/[″′"'\s]/g,'').toLowerCase();
  const mainVariant=()=>{
    if(!mainForm?.querySelector('[data-option-index] input:checked'))return null;
    const id=Number(mainForm.querySelector('[name="id"]')?.value);
    return variants.find(variant=>variant.id===id&&variant.available)||null;
  };
  const chooseSize=()=>{
    if(!sizeWrap)return;
    sizeWrap.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});
    sizeWrap.querySelector('input[type=radio]:not(:disabled)')?.focus({preventScroll:true});
    sizeWrap.classList.add('is-size-prompt');
    setTimeout(()=>sizeWrap.classList.remove('is-size-prompt'),1800);
  };
  function dispatchCopy(date=new Date()) {
    const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',weekday:'short',hour:'numeric',hourCycle:'h23'}).formatToParts(date);
    const day=parts.find(part=>part.type==='weekday').value;
    const hour=Number(parts.find(part=>part.type==='hour').value);
    return !['Sat','Sun'].includes(day)&&hour<16?'In stock · dispatches today':'In stock · dispatches next business day';
  }
  const updateBuy=()=>{
    const variant=mainVariant();
    root.querySelectorAll('[data-atc]').forEach(button=>{
      if(button.dataset.notifyAll==='true')return;
      if(!variant){button.disabled=false;button.type='button';button.dataset.luxeSizeAction='true';button.querySelector('[data-atc-label]').textContent='Choose your size';}
      else {button.type='submit';delete button.dataset.luxeSizeAction;}
    });
    const size=mainForm?.querySelector('[data-option-value-label]')?.textContent;
    const colour=root.querySelector('.guillo-pdp__style')?.textContent.trim()||'';
    const sticky=root.querySelector('[data-luxe-sticky-size]');
    if(sticky)sticky.textContent=` · ${colour} · ${variant?size:'Choose size'}`;
    const measure = root.querySelector('[data-luxe-inseam]');
    if (measure) {
      const idx = (fitData.sizes || []).findIndex(label => norm(label) === norm(size));
      const inseam = fitData.inside?.[idx];
      const lengths = (fitData.inside || []).map(Number).filter(value => value > 0);
      if (variant && inseam) measure.textContent = `${inseam} cm inside leg in size ${size} · compare with a pair you own.`;
      else if (lengths.length) {
        const low = Math.min(...lengths), high = Math.max(...lengths);
        measure.textContent = `${low === high ? low : low + '–' + high} cm inside leg, depending on size.`;
      }
    }
    const hint=root.querySelector('[data-size-hint]');
    if(variant&&hint) {
      const isPreorder=!!mainForm.querySelector('input:checked[data-preorder="true"]');
      const idx=(fitData.sizes||[]).findIndex(label=>norm(label)===norm(size));
      const inseam=fitData.inside?.[idx];
      hint.textContent=(isPreorder?'Pre-order':dispatchCopy())+(inseam?` · ${inseam} cm inside leg`:'');
    }
  };
  root.querySelectorAll('[data-atc]').forEach(button=>button.addEventListener('click',event=>{
    if(button.dataset.luxeSizeAction==='true'){event.preventDefault();event.stopImmediatePropagation();chooseSize();}
  },true));
  root.querySelectorAll('[data-luxe-choose-size]').forEach(button=>button.addEventListener('click',chooseSize));
  mainForm?.addEventListener('change',()=>queueMicrotask(()=>{updateBuy();updateLook?.();}));
  const details=root.querySelector('[data-luxe-details]');
  const sizeStoryVisual = () => {
    const media = details?.querySelector('[data-luxe-detail-view]:not([hidden]) :is(video,img)');
    if (!media) return;
    const width = media.videoWidth || media.naturalWidth || Number(media.getAttribute('width'));
    const height = media.videoHeight || media.naturalHeight || Number(media.getAttribute('height'));
    if (width && height) details.querySelector('.luxe-story__visual').style.setProperty('--luxe-media-ratio', String(width / height));
  };
  details?.querySelectorAll('img,video').forEach(media => {
    media.addEventListener(media.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', sizeStoryVisual);
  });
  sizeStoryVisual();
  details?.querySelectorAll('[data-luxe-detail]').forEach(button=>button.addEventListener('click',()=>{
    const mode=button.dataset.luxeDetail;
    details.querySelectorAll('[data-luxe-detail]').forEach(control=>control.setAttribute('aria-pressed',String(control===button)));
    details.querySelectorAll('[data-luxe-detail-view]').forEach(view=>view.hidden=view.dataset.luxeDetailView!==mode);
    sizeStoryVisual();
    updateFilm();
  }));

  const look=root.querySelector('[data-luxe-look]');
  let updateLook;
  if(!look||!mainForm){updateBuy();return;}
  const form=look.querySelector('form'),add=look.querySelector('[data-luxe-look-add]'),status=look.querySelector('[data-luxe-look-status]');
  const cfg=JSON.parse(look.querySelector('[data-luxe-money]').textContent);
  const currency=new Intl.NumberFormat(cfg.locale||'en',{style:'currency',currency:cfg.currency||'AUD',maximumFractionDigits:2});
  const money=cents=>currency.format(cents/100);
  const picks={shirt:null,polo:null,belt:null};
  let mode='shirt',busy=false;
  const selected=()=>{
    const variant=mainVariant();
    return [...(variant?[{id:variant.id,price:Number(variant.price_cents||cfg.basePrice)}]:[]),picks[mode],picks.belt].filter(Boolean);
  };
  updateLook=()=>{
    const variant=mainVariant(),chosen=selected();
    const count=chosen.length;
    let total=chosen.reduce((sum,piece)=>sum+piece.price,0);
    if(!variant)total+=cfg.basePrice;
    const discounted=!!variant&&count>=3;
    const original=look.querySelector('[data-luxe-original]');
    original.hidden=!discounted;original.textContent=money(total);
    look.querySelector('[data-luxe-total]').textContent=money(discounted?Math.round(total*.8):total);
    look.querySelector('[data-luxe-base-label]').textContent=variant?`Size ${mainForm.querySelector('[data-option-value-label]').textContent}`:'Choose your size';
    look.querySelector('[data-luxe-choose-size]').textContent=variant?'Change size':'Choose size';
    look.querySelector('[data-luxe-look-hint]').textContent=!variant?'Choose your chino size to complete the selection.':discounted?'20% wardrobe offer included. Final total confirmed in your bag.':`${count} ${count===1?'piece':'pieces'} selected · 3+ pieces unlock 20% off.`;
    add.disabled=busy;
    add.textContent=busy?'Adding…':!variant?'Choose chino size':`Add ${count===1?'chino':count+' pieces'} to bag`;
    look.querySelectorAll('[data-luxe-pick]').forEach(button=>{
      const pick=picks[button.dataset.luxePick];
      const active=pick?.id===Number(button.dataset.luxeVariantId);
      button.setAttribute('aria-pressed',String(active));
      if(button.dataset.luxePick==='belt')button.textContent=active?'Included':'Add belt';
    });
    look.querySelectorAll('[data-luxe-remove]').forEach(button=>button.hidden=!picks[button.dataset.luxeRemove]);
  };
  look.querySelectorAll('[data-luxe-mode]').forEach(button=>button.addEventListener('click',()=>{
    mode=button.dataset.luxeMode;
    look.querySelectorAll('[data-luxe-mode]').forEach(control=>control.setAttribute('aria-pressed',String(control===button)));
    look.querySelectorAll('[data-luxe-piece]').forEach(piece=>piece.hidden=!['belt',mode].includes(piece.dataset.luxePiece));
    look.querySelectorAll('[data-luxe-look-scene]').forEach(scene=>{const active=scene.dataset.luxeLookScene===mode;scene.classList.toggle('is-current',active);scene.setAttribute('aria-hidden',String(!active));});
    look.querySelector('[data-luxe-look-caption]').textContent=mode==='shirt'?'With a shirt.':'With a polo.';
    look.querySelector('[data-luxe-look-intro]').textContent=mode==='shirt'?'A pinstripe shirt, tucked in. A defined waist. The details do the talking.':'A navy polo, a clean silhouette. A different expression of the same wardrobe.';
    status.textContent='';updateLook();
  }));
  look.querySelectorAll('[data-luxe-pick]').forEach(button=>button.addEventListener('click',()=>{
    const key=button.dataset.luxePick,id=Number(button.dataset.luxeVariantId);
    picks[key]=picks[key]?.id===id?null:{id,price:Number(button.dataset.luxePrice)};
    status.textContent='';updateLook();
  }));
  look.querySelectorAll('[data-luxe-remove]').forEach(button=>button.addEventListener('click',()=>{picks[button.dataset.luxeRemove]=null;status.textContent='';updateLook();}));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy)return;
    if(!mainVariant()){chooseSize();return;}
    busy=true;status.textContent='';updateLook();
    const items=selected().map(piece=>({id:piece.id,quantity:1}));
    try {
      const response=await fetch((window.Shopify?.routes?.root||'/')+'cart/add.js',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.description||'That selection could not be added. Check the sizes and try again.');
      status.textContent='Added to your bag.';
      if(window.GuilloCart){try{await window.GuilloCart.refresh();(window.GuilloCart.notifyAdded||window.GuilloCart.open)();}catch{status.textContent='Added to your bag. Open your bag to continue.';}}
      else location.assign((window.Shopify?.routes?.root||'/')+'cart');
    } catch(error){status.textContent=error.message||'Could not add those pieces. Please try again.';}
    finally{busy=false;updateLook();}
  });
  updateBuy();updateLook();
})();
