(() => {
 const boot=()=>{
  const header=document.querySelector('[data-gc-header]');if(!header||header.dataset.navigationMounted)return;header.dataset.navigationMounted='true';
  const host=header.closest('#header-group'),menu=document.querySelector('[data-gc-menu]');
  const desktop=matchMedia('(min-width:1250px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const triggers=[...header.querySelectorAll('[data-gc-mega-trigger]')],panels=[...header.querySelectorAll('[data-gc-mega]')],shade=header.querySelector('[data-gc-mega-shade]');
  const search=header.querySelector('[data-gc-search-panel]'),input=header.querySelector('[data-gc-search-input]'),discovery=search.querySelector('[data-gc-search-discovery]'),results=search.querySelector('[data-gc-search-results]'),heading=search.querySelector('[data-gc-search-heading]'),terms=search.querySelector('[data-gc-search-terms]'),status=search.querySelector('[data-gc-search-status]'),all=search.querySelector('[data-gc-search-all]');
  let closing,debounce,controller,requestNumber=0,suppressSearchFocus=false;
  const searchURL=q=>{const url=new URL(search.dataset.searchUrl,location.origin);url.searchParams.set('type','product');url.searchParams.set('q',q);return url.pathname+url.search;};
  const closeMega=()=>{clearTimeout(closing);panels.forEach(p=>p.hidden=true);triggers.forEach(t=>t.setAttribute('aria-expanded','false'));host.classList.remove('gc-has-mega');if(search.hidden)shade.hidden=true;};
  const closeSearch=(returnFocus=false)=>{search.hidden=true;input.setAttribute('aria-expanded','false');host.classList.remove('gc-has-search');document.body.classList.remove('gc-search-open');clearTimeout(debounce);controller?.abort();requestNumber++;if(!host.classList.contains('gc-has-mega'))shade.hidden=true;if(returnFocus){suppressSearchFocus=true;input.focus({preventScroll:true});suppressSearchFocus=false;}};
  const openSearch=()=>{if(menu?.open)menu.close();closeMega();search.hidden=false;shade.hidden=false;host.classList.add('gc-has-search');document.body.classList.add('gc-search-open');input.setAttribute('aria-expanded','true');};
  const openMega=trigger=>{if(!desktop.matches)return;closeSearch();clearTimeout(closing);const id=trigger.dataset.gcMegaTrigger;panels.forEach(p=>p.hidden=p.dataset.gcMega!==id);triggers.forEach(t=>t.setAttribute('aria-expanded',String(t===trigger)));shade.hidden=false;host.classList.add('gc-has-mega');};
  triggers.forEach(trigger=>{trigger.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')openMega(trigger);});trigger.addEventListener('focus',()=>openMega(trigger));trigger.addEventListener('click',()=>openMega(trigger));});
  header.querySelectorAll('.gc-header__desktop-nav>a').forEach(link=>link.addEventListener('pointerenter',closeMega));
  header.addEventListener('pointerleave',()=>{closing=setTimeout(closeMega,220);});header.addEventListener('pointerenter',()=>clearTimeout(closing));
  header.addEventListener('focusout',e=>{if(!header.contains(e.relatedTarget)&&!search.contains(e.relatedTarget)){closeMega();closeSearch();}});
  header.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!search.hidden){closeSearch(true);return;}const active=triggers.find(t=>t.getAttribute('aria-expanded')==='true');closeMega();active?.focus();closeMega();}});
  shade.addEventListener('pointerenter',()=>{closing=setTimeout(closeMega,150);});shade.addEventListener('click',()=>{closeMega();closeSearch();});desktop.addEventListener('change',()=>{closeMega();closeSearch();});
  document.querySelector('[data-gc-menu-open]')?.addEventListener('click',()=>{closeSearch();closeMega();});
  input.addEventListener('focus',()=>{if(suppressSearchFocus)return;openSearch();if(input.value.trim())queueSearch();});
  input.addEventListener('click',openSearch);
  search.querySelector('[data-gc-search-close]').addEventListener('click',()=>closeSearch(true));
  // Focusing the menu search moves the same query into the full-width search surface.
  menu?.querySelector('[data-gc-menu-search]')?.addEventListener('focus',e=>{const value=e.currentTarget.value;menu.close();requestAnimationFrame(()=>{input.value=value;input.focus({preventScroll:true});});});
  const resetResults=()=>{discovery.hidden=false;results.hidden=true;results.replaceChildren();terms.hidden=false;heading.textContent='Popular Searches';status.textContent='';all.hidden=true;};
  const safeURL=value=>{try{const url=new URL(value,location.origin);return url.origin===location.origin?url.pathname+url.search:null;}catch{return null;}};
  async function suggest(query,number){
   controller?.abort();controller=new AbortController();
   if(!query){resetResults();return;}
   heading.textContent='Suggestions';terms.hidden=true;discovery.hidden=true;results.hidden=false;results.replaceChildren();status.textContent='Searching…';
   all.href=searchURL(query);all.textContent=`View all results for “${query}”`;all.hidden=false;
   try{
    const url=new URL(search.dataset.suggestUrl+'.json',location.origin);url.searchParams.set('q',query);url.searchParams.set('resources[type]','product,collection,query');url.searchParams.set('resources[limit]','6');url.searchParams.set('resources[limit_scope]','each');url.searchParams.set('resources[options][unavailable_products]','last');
    const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Search unavailable');const data=await response.json();if(number!==requestNumber||search.hidden)return;
    const found=data.resources?.results||{},products=(found.products||[]).filter(p=>p.handle!=='pos-test-product'&&!p.url?.includes('pos-test-product'));
    const suggestions=[...(found.queries||[]),...(found.collections||[])].slice(0,6);terms.replaceChildren();
    suggestions.forEach(item=>{const text=item.text||item.title,href=item.url?safeURL(item.url):searchURL(text);if(!text||!href)return;const a=document.createElement('a');a.textContent=text;a.href=href;terms.append(a);});terms.hidden=!terms.childElementCount;
    products.forEach(product=>{const href=safeURL(product.url);if(!href)return;const a=document.createElement('a');a.className='gc-search-tile';a.href=href;const source=product.featured_image?.url||product.image;if(source){const image=document.createElement('img');image.src=source;image.alt=product.title;image.loading='lazy';a.append(image);}const label=document.createElement('span');label.textContent=product.title;a.append(label);results.append(a);});
    status.classList.toggle('gc-visually-hidden',products.length>0);status.textContent=products.length?`${products.length} product suggestions.`:'No product suggestions. Try another search or view all results.';
   }catch(error){if(error.name==='AbortError'||number!==requestNumber)return;status.classList.remove('gc-visually-hidden');status.textContent='Suggestions are unavailable. You can still view all search results.';}
  }
  function queueSearch(){openSearch();clearTimeout(debounce);const query=input.value.trim(),number=++requestNumber;controller?.abort();if(!query){resetResults();return;}debounce=setTimeout(()=>suggest(query,number),200);}
  input.addEventListener('input',queueSearch);
  // Keep curated links intact when clearing a typed query.
  const defaultTerms=terms.cloneNode(true);
  input.addEventListener('input',()=>{if(!input.value.trim()){terms.replaceChildren(...[...defaultTerms.childNodes].map(n=>n.cloneNode(true)));status.classList.add('gc-visually-hidden');}});
  document.querySelectorAll('[data-gc-type-search]').forEach(field=>{
   const words=(field.dataset.searchTerms||'Shirts\nSlim fit\nLuxe chinos\nKnit polos\nNew arrivals').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!words.length)return;
   let word=0,length=0,deleting=false,timer;const prefix='Try searching for... ';
   const tick=()=>{clearTimeout(timer);if(reduced.matches){field.placeholder=prefix+words[0];return;}if(document.hidden||field.value){timer=setTimeout(tick,500);return;}
    field.placeholder=prefix+words[word].slice(0,length);let delay=deleting?45:95;
    if(!deleting&&length===words[word].length){deleting=true;delay=1800;}else if(deleting&&length===0){deleting=false;word=(word+1)%words.length;delay=300;}else length+=deleting?-1:1;
    timer=setTimeout(tick,delay);
   };reduced.addEventListener('change',tick);tick();
  });
 };
 document.addEventListener('shopify:section:load',boot);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
