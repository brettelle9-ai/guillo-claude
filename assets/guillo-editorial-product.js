(() => {
  const boot=()=>{
    const root=document.querySelector('[data-ge-product]');if(!root||root.dataset.geMounted)return;root.dataset.geMounted='true';
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,behavior=reduced?'instant':'smooth';
    const gallery=root.querySelector('[data-ge-gallery]'),slides=[...root.querySelectorAll('[data-ge-slide]')],count=root.querySelector('[data-ge-gallery-count]');
    let current=0;
    const move=step=>{current=Math.max(0,Math.min(slides.length-1,current+step));gallery.scrollTo({left:slides[current].offsetLeft-slides[0].offsetLeft,behavior});};
    const videoShortcut=root.querySelector('[data-ge-video-shortcut]');
    videoShortcut?.addEventListener('click',()=>{
      const index=Number(videoShortcut.dataset.geVideoShortcut),slide=slides[index];if(!slide)return;
      current=index;gallery.scrollTo({left:slide.offsetLeft-slides[0].offsetLeft,behavior:'instant'});
      const video=slide.querySelector('video');if(video){video.muted=true;video.play().catch(()=>{});}else slide.querySelector('iframe')?.focus();
    });
    const videoObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)entry.target.querySelector('video')?.pause();}),{root:gallery,threshold:.55});
    root.querySelectorAll('[data-ge-video-slide]').forEach(slide=>videoObserver.observe(slide));
    root.querySelector('[data-ge-next]').addEventListener('click',()=>move(1));root.querySelector('[data-ge-previous]').addEventListener('click',()=>move(-1));
    gallery.addEventListener('scroll',()=>{const step=slides[1]?slides[1].offsetLeft-slides[0].offsetLeft:gallery.clientWidth;current=Math.min(slides.length-1,Math.round(gallery.scrollLeft/step));count.textContent=`${current+1} / ${slides.length}`;},{passive:true});
    gallery.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}});
    const zoom=root.querySelector('[data-ge-zoom-dialog]');let pointerX=0;
    gallery.addEventListener('pointerdown',e=>pointerX=e.clientX,{passive:true});
    root.querySelectorAll('[data-ge-zoom]').forEach(b=>b.addEventListener('click',e=>{if(e.detail!==0&&Math.abs(e.clientX-pointerX)>12)return;const image=b.querySelector('img');zoom.querySelector('img').src=image.currentSrc||image.src;zoom.showModal();}));
    const form=root.querySelector('#GEProductForm'),variant=form.querySelector('[data-ge-variant]'),add=form.querySelector('[data-ge-add]'),sticky=root.querySelector('[data-ge-sticky]'),stickyAdd=sticky.querySelector('button');
    const selectSize=()=>{form.querySelector('.ge-sizes').scrollIntoView({block:'center',behavior});form.querySelector('[data-ge-option]:not(:disabled)')?.focus({preventScroll:true});root.querySelector('[data-ge-selected]').textContent='Please select a size';};
    form.querySelectorAll('[data-ge-option]').forEach(input=>input.addEventListener('change',()=>{variant.value=input.value;add.disabled=false;add.textContent='Add to Bag';root.querySelector('[data-ge-selected]').textContent=input.dataset.size;root.querySelector('[data-ge-price]').textContent=input.dataset.price;const u=new URL(location.href);u.searchParams.set('variant',input.value);history.replaceState(null,'',u.href);}));
    add.addEventListener('click',e=>{if(!variant.value){e.preventDefault();selectSize();}});
    const selected=new URLSearchParams(location.search).get('variant');if(selected){const option=[...form.querySelectorAll('[data-ge-option]')].find(i=>i.value===selected&&!i.disabled);if(option){option.checked=true;option.dispatchEvent(new Event('change'));}}
    const purchase=()=>{if(!variant.value)selectSize();else form.requestSubmit(add);};
    stickyAdd.addEventListener('click',purchase);
    new IntersectionObserver(entries=>{sticky.hidden=entries[0].isIntersecting;},{threshold:.2}).observe(add);
    root.querySelector('[data-ge-more-reviews]')?.addEventListener('click',e=>{root.querySelectorAll('[data-ge-review-extra]').forEach((review,i)=>{if(i<5){review.hidden=false;review.removeAttribute('data-ge-review-extra');}});if(!root.querySelector('[data-ge-review-extra]'))e.currentTarget.hidden=true;});
    const panel=root.querySelector('[data-ge-info-dialog]'),panelTitles={details:'Details',fabric:'Fabric & Fit',care:'Care Instructions',delivery:'Delivery',sizeguide:'Size Guide'};
    root.querySelectorAll('[data-ge-panel]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.gePanel;panel.querySelector('[data-ge-panel-title]').textContent=panelTitles[key]+' — '+root.dataset.productName;panel.querySelector('[data-ge-panel-content]').replaceChildren(root.querySelector(`[data-ge-panel-template="${key}"]`).content.cloneNode(true));panel.querySelector('[data-ge-panel-content]').scrollTop=0;panel.showModal();}));
    panel.querySelector('[data-ge-panel-purchase]').addEventListener('click',()=>{panel.close();purchase();});
    root.querySelectorAll('.ge-related').forEach(section=>{const rail=section.querySelector('.ge-rail');section.querySelector('[data-ge-rail-previous]')?.addEventListener('click',()=>rail.scrollBy({left:-rail.clientWidth*.9,behavior}));section.querySelector('[data-ge-rail-next]')?.addEventListener('click',()=>rail.scrollBy({left:rail.clientWidth*.9,behavior}));});
    const quick=root.querySelector('[data-ge-quick]'),content=quick.querySelector('[data-ge-quick-content]');
    root.querySelectorAll('[data-gc-quick]').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('[data-gc-card]');content.replaceChildren(card.querySelector('template').content.cloneNode(true));content.querySelectorAll('[data-gc-size]').forEach(b=>b.addEventListener('click',()=>{content.querySelectorAll('[data-gc-size]').forEach(s=>s.setAttribute('aria-pressed',String(s===b)));content.querySelector('[data-gc-variant]').value=b.dataset.gcSize;const submit=content.querySelector('[type=submit]');submit.disabled=false;submit.textContent=card.dataset.handle!=='firenze-chevron-shirt'&&card.dataset.tags.includes('pre-order')?'Pre-order':'Add to Bag';}));quick.showModal();}));
    quick.addEventListener('click',e=>{if(e.target.closest('button[type=submit]:not(:disabled)'))quick.close();});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();document.addEventListener('shopify:section:load',boot);
})();
