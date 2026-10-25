(() => {
  const boot=()=>{
    const root=document.querySelector('[data-ge-product]');if(!root||root.dataset.geMounted)return;root.dataset.geMounted='true';
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gallery=root.querySelector('[data-ge-gallery]'),slides=[...root.querySelectorAll('[data-ge-slide]')],count=root.querySelector('[data-ge-gallery-count]');
    let current=0;
    const move=step=>{current=Math.max(0,Math.min(slides.length-1,current+step));gallery.scrollTo({left:slides[current].offsetLeft-gallery.offsetLeft,behavior:reduced?'instant':'smooth'});};
    root.querySelector('[data-ge-next]').addEventListener('click',()=>move(1));root.querySelector('[data-ge-previous]').addEventListener('click',()=>move(-1));
    gallery.addEventListener('scroll',()=>{current=Math.round(gallery.scrollLeft/(gallery.clientWidth+2));count.textContent=`${current+1} / ${slides.length}`;},{passive:true});
    gallery.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}});
    const zoom=root.querySelector('[data-ge-zoom-dialog]');let pointerX=0;
    gallery.addEventListener('pointerdown',e=>pointerX=e.clientX,{passive:true});
    root.querySelectorAll('[data-ge-zoom]').forEach(b=>b.addEventListener('click',e=>{if(e.detail!==0&&Math.abs(e.clientX-pointerX)>12)return;const image=b.querySelector('img');zoom.querySelector('img').src=image.currentSrc||image.src;zoom.showModal();}));
    const form=root.querySelector('#GEProductForm'),variant=form.querySelector('[data-ge-variant]'),add=form.querySelector('[data-ge-add]'),sticky=root.querySelector('[data-ge-sticky]'),stickyAdd=sticky.querySelector('button');
    form.querySelectorAll('[data-ge-option]').forEach(input=>input.addEventListener('change',()=>{variant.value=input.value;add.disabled=false;const preorder=input.dataset.preorder==='true';add.textContent=preorder?'Pre-order':'Add to bag';stickyAdd.textContent=add.textContent;root.querySelector('[data-ge-selected]').textContent=input.dataset.size;root.querySelector('[data-ge-price]').textContent=input.dataset.price;root.querySelector('[data-ge-preorder]').hidden=!preorder;const u=new URL(location.href);u.searchParams.set('variant',input.value);history.replaceState(null,'',u.href);}));
    const selected=new URLSearchParams(location.search).get('variant');if(selected){const option=[...form.querySelectorAll('[data-ge-option]')].find(i=>i.value===selected&&!i.disabled);if(option){option.checked=true;option.dispatchEvent(new Event('change'));}}
    stickyAdd.addEventListener('click',()=>{if(!variant.value){form.querySelector('.ge-sizes').scrollIntoView({block:'center',behavior:reduced?'instant':'smooth'});form.querySelector('[data-ge-option]:not(:disabled)')?.focus({preventScroll:true});}else form.requestSubmit(add);});
    new IntersectionObserver(entries=>{sticky.hidden=entries[0].isIntersecting;},{threshold:.2}).observe(add);
    const quick=root.querySelector('[data-ge-quick]'),content=quick.querySelector('[data-ge-quick-content]');
    root.querySelectorAll('[data-gc-quick]').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('[data-gc-card]');content.replaceChildren(card.querySelector('template').content.cloneNode(true));content.querySelectorAll('[data-gc-size]').forEach(b=>b.addEventListener('click',()=>{content.querySelectorAll('[data-gc-size]').forEach(s=>s.setAttribute('aria-pressed',String(s===b)));content.querySelector('[data-gc-variant]').value=b.dataset.gcSize;const submit=content.querySelector('[type=submit]');submit.disabled=false;submit.textContent=card.dataset.tags.includes('pre-order')?'Pre-order':'Add to bag';}));quick.showModal();}));
    quick.addEventListener('click',e=>{if(e.target.closest('button[type=submit]:not(:disabled)'))quick.close();});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();document.addEventListener('shopify:section:load',boot);
})();
