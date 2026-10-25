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
    const variants=JSON.parse(root.querySelector('[data-variant-data]').textContent);
    const mode=root.dataset.availabilityMode||'normal',baseLabel=root.dataset.addLabel||'Add to Bag';
    const notify=root.querySelector('[data-ge-notify]');let notifyVariant=null;
    const showNotify=()=>{notifyVariant=variants.find(v=>String(v.id)===String(variant.value))||variants[0];notify.hidden=false;notify.querySelector('[data-ge-notify-size]').textContent=notifyVariant?.title==='Default Title'?'':notifyVariant?.title||'';notify.scrollIntoView({block:'nearest',behavior});notify.querySelector('input').focus({preventScroll:true});};
    const selectSize=()=>{const sizes=form.querySelector('.ge-sizes');if(sizes){sizes.scrollIntoView({block:'center',behavior});form.querySelector('[data-ge-option]')?.focus({preventScroll:true});root.querySelector('[data-ge-selected]').textContent='Please select a size';}else showNotify();};
    const updateState=chosen=>{variant.value=chosen.id;const state=mode==='interest'?'interest':chosen.available?'available':'unavailable';form.dataset.purchaseState=state;add.disabled=false;add.textContent=state==='interest'?'Register your interest':state==='unavailable'?'Notify me':baseLabel;stickyAdd.textContent=add.textContent;root.querySelector('[data-ge-price]').textContent=form.querySelector(`[data-ge-option][value="${chosen.id}"]`)?.dataset.price||root.querySelector('[data-ge-price]').textContent;};
    form.querySelectorAll('[data-ge-option]').forEach(input=>input.addEventListener('change',()=>{const chosen=variants.find(v=>String(v.id)===input.value);if(!chosen)return;updateState(chosen);root.querySelector('[data-ge-selected]').textContent=input.dataset.size;const u=new URL(location.href);u.searchParams.set('variant',input.value);history.replaceState(null,'',u.href);}));
    if(variants.length===1&&variants[0].title==='Default Title')updateState(variants[0]);
    const selected=new URLSearchParams(location.search).get('variant');if(selected){const option=[...form.querySelectorAll('[data-ge-option]')].find(i=>i.value===selected);if(option){option.checked=true;option.dispatchEvent(new Event('change'));}}
    const needsNotify=()=>mode==='interest'||form.dataset.purchaseState==='unavailable';
    add.addEventListener('click',e=>{if(!variant.value){e.preventDefault();selectSize();}else if(needsNotify()){e.preventDefault();showNotify();}});
    form.addEventListener('submit',e=>{if(!variant.value||needsNotify()){e.preventDefault();if(needsNotify())showNotify();else selectSize();}});
    const purchase=()=>{if(!variant.value)selectSize();else if(needsNotify())showNotify();else form.requestSubmit(add);};
    notify.querySelector('[data-ge-notify-close]').addEventListener('click',()=>notify.hidden=true);
    notify.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,button=f.querySelector('[type=submit]'),message=f.querySelector('[data-ge-notify-status]'),email=f.elements.email.value.trim();if(!f.reportValidity())return;button.disabled=true;message.textContent='Sending…';
      const profile={data:{type:'profile',attributes:{email}}},headers={'Content-Type':'application/json',revision:'2024-10-15'};
      try{
        const request=mode==='interest'?{url:'events',data:{type:'event',attributes:{profile,metric:{data:{type:'metric',attributes:{name:'Notify Me Request'}}},properties:{Product:notify.dataset.productTitle,Size:notifyVariant?.title,'Variant ID':String(notifyVariant?.id||''),'Product URL':notify.dataset.productUrl,Interest:true}}}}:{url:'back-in-stock-subscriptions',data:{type:'back-in-stock-subscription',attributes:{profile,channels:['EMAIL']},relationships:{variant:{data:{type:'catalog-variant',id:'$shopify:::$default:::'+notifyVariant.id}}}}};
        const response=await fetch('https://a.klaviyo.com/client/'+request.url+'/?company_id=YgJzQa',{method:'POST',headers,body:JSON.stringify({data:request.data})});if(!response.ok)throw Error('Request failed');
        if(mode==='interest'){const joined=await fetch('https://a.klaviyo.com/client/subscriptions/?company_id=YgJzQa',{method:'POST',headers,body:JSON.stringify({data:{type:'subscription',attributes:{custom_source:'Product interest',profile},relationships:{list:{data:{type:'list',id:'TARW9Y'}}}}})});if(!joined.ok)throw Error('Request failed');}
        message.textContent=mode==='interest'?'Thank you. Your interest has been registered.':'Thank you. We’ll email you when this size is available.';f.elements.email.value='';
      }catch{message.textContent='We couldn’t save that. Please try again.';}finally{button.disabled=false;}
    });
    stickyAdd.addEventListener('click',purchase);
    new IntersectionObserver(entries=>{sticky.hidden=entries[0].isIntersecting;},{threshold:.2}).observe(add);
    root.querySelector('[data-ge-more-reviews]')?.addEventListener('click',e=>{root.querySelectorAll('[data-ge-review-extra]').forEach((review,i)=>{if(i<5){review.hidden=false;review.removeAttribute('data-ge-review-extra');}});if(!root.querySelector('[data-ge-review-extra]'))e.currentTarget.hidden=true;});
    const panel=root.querySelector('[data-ge-info-dialog]'),panelTitles={details:'Details',fabric:'Fabric & Fit',care:'Care Instructions',delivery:'Delivery',sizeguide:'Size Guide'};
    root.querySelectorAll('[data-ge-panel]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.gePanel;panel.querySelector('[data-ge-panel-title]').textContent=panelTitles[key]+' · '+root.dataset.productName;panel.querySelector('[data-ge-panel-content]').replaceChildren(root.querySelector(`[data-ge-panel-template="${key}"]`).content.cloneNode(true));panel.querySelector('[data-ge-panel-content]').scrollTop=0;panel.showModal();}));
    panel.querySelector('[data-ge-panel-purchase]').addEventListener('click',()=>{panel.close();purchase();});
    root.querySelectorAll('.ge-related').forEach(section=>{const rail=section.querySelector('.ge-rail');section.querySelector('[data-ge-rail-previous]')?.addEventListener('click',()=>rail.scrollBy({left:-rail.clientWidth*.9,behavior}));section.querySelector('[data-ge-rail-next]')?.addEventListener('click',()=>rail.scrollBy({left:rail.clientWidth*.9,behavior}));});
    const quick=root.querySelector('[data-ge-quick]'),content=quick.querySelector('[data-ge-quick-content]');
    root.querySelectorAll('[data-gc-quick]').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('[data-gc-card]');content.replaceChildren(card.querySelector('template').content.cloneNode(true));content.querySelectorAll('[data-gc-size]').forEach(b=>b.addEventListener('click',()=>{content.querySelectorAll('[data-gc-size]').forEach(s=>s.setAttribute('aria-pressed',String(s===b)));content.querySelector('[data-gc-variant]').value=b.dataset.gcSize;const submit=content.querySelector('[type=submit]');submit.disabled=false;submit.textContent=card.dataset.handle!=='firenze-chevron-shirt'&&card.dataset.preorder==='true'?'Pre-order':'Add to Bag';}));quick.showModal();}));
    quick.addEventListener('click',e=>{if(e.target.closest('button[type=submit]:not(:disabled)'))quick.close();});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();document.addEventListener('shopify:section:load',boot);
})();
