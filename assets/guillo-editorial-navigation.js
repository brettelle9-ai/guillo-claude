(() => {
 const boot=()=>{
  const header=document.querySelector('[data-gc-header]');if(!header||header.dataset.navigationMounted)return;header.dataset.navigationMounted='true';
  const desktop=matchMedia('(min-width:1250px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const triggers=[...header.querySelectorAll('[data-gc-mega-trigger]')],panels=[...header.querySelectorAll('[data-gc-mega]')],shade=header.querySelector('[data-gc-mega-shade]');let closing;
  const close=()=>{clearTimeout(closing);panels.forEach(p=>p.hidden=true);triggers.forEach(t=>t.setAttribute('aria-expanded','false'));shade.hidden=true;header.closest('#header-group').classList.remove('gc-has-mega');};
  const open=trigger=>{if(!desktop.matches)return;clearTimeout(closing);const id=trigger.dataset.gcMegaTrigger;panels.forEach(p=>p.hidden=p.dataset.gcMega!==id);triggers.forEach(t=>t.setAttribute('aria-expanded',String(t===trigger)));shade.hidden=false;header.closest('#header-group').classList.add('gc-has-mega');};
  triggers.forEach(trigger=>{trigger.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')open(trigger);});trigger.addEventListener('focus',()=>open(trigger));trigger.addEventListener('click',()=>open(trigger));});
  header.addEventListener('pointerleave',()=>{closing=setTimeout(close,200);});header.addEventListener('pointerenter',()=>clearTimeout(closing));
  header.addEventListener('focusout',e=>{if(!header.contains(e.relatedTarget))close();});
  header.addEventListener('keydown',e=>{if(e.key==='Escape'){const active=triggers.find(t=>t.getAttribute('aria-expanded')==='true');close();active?.focus();close();}});
  shade.addEventListener('pointerenter',()=>{closing=setTimeout(close,150);});shade.addEventListener('click',close);desktop.addEventListener('change',close);
  header.querySelectorAll('[data-gc-type-search]').forEach(input=>{
   const terms=(input.dataset.searchTerms||'Fitted shirts\nLuxe Chinos\nNew Arrivals').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!terms.length)return;
   let word=0,length=0,deleting=false,timer;const prefix='Try searching for… ';
   const tick=()=>{clearTimeout(timer);if(reduced.matches){input.placeholder='Search Guillo';return;}if(document.hidden||input===document.activeElement||input.value){timer=setTimeout(tick,500);return;}
    input.placeholder=prefix+terms[word].slice(0,length);let delay=deleting?42:85;
    if(!deleting&&length===terms[word].length){deleting=true;delay=1700;}else if(deleting&&length===0){deleting=false;word=(word+1)%terms.length;delay=300;}else length+=deleting?-1:1;
    timer=setTimeout(tick,delay);
   };input.addEventListener('focus',()=>{clearTimeout(timer);input.placeholder='Search Guillo';});input.addEventListener('blur',tick);reduced.addEventListener('change',tick);tick();
  });
 };document.addEventListener('shopify:section:load',boot);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
