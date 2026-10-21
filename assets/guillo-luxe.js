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
    const hint=root.querySelector('[data-size-hint]');
    if(variant&&hint) {
      const isPreorder=!!mainForm.querySelector('input:checked[data-preorder="true"]');
      hint.textContent=isPreorder?'Pre-order':dispatchCopy();
    }
  };
  root.querySelectorAll('[data-atc]').forEach(button=>button.addEventListener('click',event=>{
    if(button.dataset.luxeSizeAction==='true'){event.preventDefault();event.stopImmediatePropagation();chooseSize();}
  },true));
  root.querySelectorAll('[data-luxe-choose-size]').forEach(button=>button.addEventListener('click',chooseSize));
  mainForm?.addEventListener('change',()=>queueMicrotask(updateBuy));
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

  updateBuy();
  const wardrobe = root.querySelector('[data-luxe-wardrobe]');
  if (!wardrobe) return;
  const track = wardrobe.querySelector('[data-wardrobe-track]');
  const cards = Array.from(wardrobe.querySelectorAll('[data-wardrobe-card]'));
  const prev = wardrobe.querySelector('[data-wardrobe-prev]');
  const next = wardrobe.querySelector('[data-wardrobe-next]');
  const progress = wardrobe.querySelector('[data-wardrobe-progress]');
  const status = wardrobe.querySelector('[data-wardrobe-status]');
  const cfg = JSON.parse(wardrobe.querySelector('[data-wardrobe-money]').textContent);
  const currency = new Intl.NumberFormat(cfg.locale || 'en', {style:'currency',currency:cfg.currency || 'AUD',maximumFractionDigits:2});
  const updateRail = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
    progress.style.width = `${Math.min(100,track.clientWidth / track.scrollWidth * 100)}%`;
    progress.style.left = `${track.scrollLeft / track.scrollWidth * 100}%`;
  };
  const move = direction => {
    const step = (cards[0]?.getBoundingClientRect().width || track.clientWidth) + parseFloat(getComputedStyle(track).columnGap || 0);
    track.scrollBy({left:direction * step,behavior:reduced.matches?'instant':'smooth'});
  };
  prev.addEventListener('click',() => move(-1));
  next.addEventListener('click',() => move(1));
  track.addEventListener('scroll',updateRail,{passive:true});
  track.addEventListener('keydown',event => {
    if (event.target !== track || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();move(event.key === 'ArrowLeft'?-1:1);
  });
  if ('ResizeObserver' in window) new ResizeObserver(updateRail).observe(track);
  updateRail();
  cards.forEach(card => {
    const sizes = Array.from(card.querySelectorAll('[data-wardrobe-size]'));
    const add = card.querySelector('[data-wardrobe-add]');
    let selected = null, busy = false;
    sizes.forEach(button => button.addEventListener('click',() => {
      if (busy) return;
      selected = button;
      sizes.forEach(size => size.setAttribute('aria-pressed',String(size === button)));
      card.classList.remove('is-size-prompt');
      card.querySelector('[data-wardrobe-price]').textContent = currency.format(Number(button.dataset.variantPrice) / 100);
      add.textContent = 'Add to bag ↗';status.textContent = '';
    }));
    add.addEventListener('click',async () => {
      if (busy) return;
      if (!selected) {
        card.classList.add('is-size-prompt');
        sizes.find(size => !size.disabled)?.focus({preventScroll:true});
        status.textContent = `Choose a size for ${card.dataset.wardrobeTitle}.`;
        return;
      }
      busy = true;add.disabled = true;add.textContent = 'Adding…';status.textContent = '';
      try {
        const response = await fetch((window.Shopify?.routes?.root || '/')+'cart/add.js',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items:[{id:Number(selected.dataset.variantId),quantity:1}]})});
        const result = await response.json();
        if (!response.ok) throw new Error(result.description || 'This size could not be added. Try another size.');
        status.textContent = `${card.dataset.wardrobeTitle} added to your bag.`;
        if (window.GuilloCart) {
          try {await window.GuilloCart.refresh();(window.GuilloCart.notifyAdded || window.GuilloCart.open)();}
          catch {status.textContent += ' Open your bag to continue.';}
        } else location.assign((window.Shopify?.routes?.root || '/')+'cart');
      } catch(error) {status.textContent = error.message || 'Could not add this shirt. Please try again.';}
      finally {busy = false;add.disabled = false;add.textContent = 'Add to bag ↗';}
    });
  });
})();
