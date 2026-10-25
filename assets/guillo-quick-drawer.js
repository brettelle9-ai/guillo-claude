/* One native quick-add drawer across the homepage, collections and recommendations. */
(() => {
 const boot=()=>{
  const dialog=document.querySelector('[data-gq-drawer]');if(!dialog||dialog.dataset.mounted)return;dialog.dataset.mounted='true';
  const content=dialog.querySelector('[data-gq-content]'),reduced=matchMedia('(prefers-reduced-motion:reduce)'),cache=new Map();let opener,request=0,closing=false;
  const animate=(frames,options)=>reduced.matches?Promise.resolve():dialog.animate(frames,options).finished.catch(()=>{});
  const close=async()=>{if(!dialog.open||closing)return;closing=true;request++;await animate([{transform:'translateX(0)'},{transform:'translateX(100%)'}],{duration:380,easing:'cubic-bezier(.4,0,.8,.2)'});dialog.close();closing=false;opener?.focus({preventScroll:true});};
  dialog.querySelector('[data-gq-close]').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right)close();}});
  const mount=(body,previousSize)=>{content.replaceChildren(body);const price=body.querySelector('[data-gq-price]'),variant=body.querySelector('[data-gq-variant]'),add=body.querySelector('[type=submit]');
   body.querySelectorAll('[data-gq-size]').forEach(button=>button.addEventListener('click',()=>{body.querySelectorAll('[data-gq-size]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));variant.value=button.dataset.gqSize;add.disabled=false;add.textContent=body.dataset.gqPreorder==='true'?'Pre-order':'Add to Bag';price.textContent=button.dataset.price;}));
   if(previousSize){const size=[...body.querySelectorAll('[data-gq-size]')].find(b=>b.dataset.sizeLabel===previousSize&&!b.disabled);size?.click();}
   body.querySelectorAll('[data-gq-sibling]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();load(link.dataset.gqSibling,null,body.querySelector('[aria-pressed=true][data-gq-size]')?.dataset.sizeLabel);}));
  };
  async function load(handle,card,previousSize){
   const number=++request;if(!dialog.open){dialog.showModal();animate([{transform:'translateX(100%)'},{transform:'translateX(0)'}],{duration:540,easing:'cubic-bezier(.22,.78,.23,1)'});}
   content.setAttribute('aria-busy','true');
   try{
    let body;const template=card?.querySelector('template[data-gc-quick-template]');
    if(template&&card.dataset.handle===handle){body=template.content.querySelector('[data-gq-product]').cloneNode(true);cache.set(handle,body.cloneNode(true));}
    else if(cache.has(handle))body=cache.get(handle).cloneNode(true);
    else{
     if(!content.children.length){const loading=document.createElement('p');loading.className='gq-loading';loading.textContent='Loading…';content.append(loading);}
     const url=new URL('/products/'+encodeURIComponent(handle),location.origin);url.searchParams.set('view','guillo-quick');const response=await fetch(url);if(!response.ok)throw Error('Unavailable');const doc=new DOMParser().parseFromString(await response.text(),'text/html');body=doc.querySelector('[data-gq-product]');if(!body)throw Error('Unavailable');cache.set(handle,body.cloneNode(true));
    }
    if(number!==request||!dialog.open)return;mount(body,previousSize);
   }catch{if(number!==request)return;const message=document.createElement('p');message.className='gq-loading';message.textContent='We couldn’t load this colour. ';const link=document.createElement('a');link.href='/products/'+encodeURIComponent(handle);link.textContent='Open the product';message.append(link);content.append(message);}
   finally{if(number===request)content.removeAttribute('aria-busy');}
  }
  document.addEventListener('click',e=>{
   const trigger=e.target.closest('[data-gc-quick],[data-gc-quick-handle]');if(!trigger)return;
   e.preventDefault();e.stopImmediatePropagation();opener=trigger;const card=trigger.closest('[data-gc-card]');load(trigger.dataset.gcQuickHandle||card.dataset.handle,card);
  },true);
  // Close before the existing cart drawer receives the native product form.
  dialog.addEventListener('click',e=>{const submit=e.target.closest('button[type=submit]:not(:disabled)');if(submit&&submit.form?.querySelector('[data-gq-variant]')?.value)close();});
 };
 document.addEventListener('shopify:section:load',boot);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
