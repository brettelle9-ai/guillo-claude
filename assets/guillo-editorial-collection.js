/* Separate collection preview: native dialogs, real variants and local catalogue filters. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const start = () => {
    const root = document.querySelector('[data-gc-collection], [data-ge-product]');
    if (!root || root.dataset.mounted) return;
    root.dataset.mounted = 'true';
    const headerGroup = document.getElementById('header-group');
    const header = document.querySelector('[data-gc-header]');
    const syncHeader = () => document.body.style.setProperty('--gc-sticky-offset', `${headerGroup?.getBoundingClientRect().height || 96}px`);
    new ResizeObserver(syncHeader).observe(headerGroup || header);
    syncHeader();
    const dialogs = document.querySelectorAll('.gc-dialog');
    const show = dialog => {
      if(dialog.open)return;dialog.showModal();
      if(dialog.matches('.gc-menu')&&!reduced.matches)dialog.animate([{transform:'translateX(-100%)'},{transform:'translateX(0)'}],{duration:620,easing:'cubic-bezier(.22,.78,.23,1)'});
    };
    const closeDialog = dialog => {
      if(!dialog.open||dialog.dataset.closing)return;
      if(!dialog.matches('.gc-menu')||reduced.matches){dialog.close();return;}
      dialog.dataset.closing='true';dialog.animate([{transform:'translateX(0)'},{transform:'translateX(-100%)'}],{duration:420,easing:'cubic-bezier(.4,0,.7,.2)'}).finished.catch(()=>{}).then(()=>{dialog.close();delete dialog.dataset.closing;});
    };
    dialogs.forEach(dialog => {
      dialog.querySelectorAll('[data-gc-close]').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
      if(dialog.matches('.gc-menu'))dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog(dialog);});
      dialog.addEventListener('click', e => {if (e.target === dialog) {const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeDialog(dialog);}});
    });
    const menu = document.querySelector('[data-gc-menu]');
    const menuTitle = menu.querySelector('[data-gc-menu-title]');
    const back = menu.querySelector('[data-gc-menu-back]');
    let stack = ['root'];
    const setPanel = (id, backwards=false) => {
      const panel = menu.querySelector(`[data-gc-menu-panel="${id}"]`);
      if (!panel) return;
      menu.querySelectorAll('[data-gc-menu-panel]').forEach(p => p.hidden=p!==panel);
      menuTitle.textContent = panel.dataset.panelTitle;
      back.hidden = id === 'root';
      const body = menu.querySelector('.gc-menu__body');body.scrollTop=0;
      if (!reduced.matches) panel.animate([{opacity:.4,transform:`translateX(${backwards?-60:60}px)`},{opacity:1,transform:'translateX(0)'}],{duration:450,easing:'cubic-bezier(.22,1,.36,1)'});
    };
    document.querySelectorAll('[data-gc-menu-open],[data-gc-menu-start]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.gcMenuStart||'root';stack=id==='root'?['root']:['root',id];setPanel(id);show(menu);document.querySelector('[data-gc-menu-open]')?.setAttribute('aria-expanded','true');
    }));
    menu.querySelectorAll('[data-gc-menu-go]').forEach(button=>button.addEventListener('click',()=>{stack.push(button.dataset.gcMenuGo);setPanel(stack.at(-1));}));
    back.addEventListener('click',()=>{if(stack.length>1)stack.pop();setPanel(stack.at(-1),true);});
    menu.addEventListener('close',()=>document.querySelector('[data-gc-menu-open]')?.setAttribute('aria-expanded','false'));
    // Keep the duplicated shirts view when a menu link returns to this collection.
    menu.querySelectorAll('a').forEach(a=>{const u=new URL(a.href,location.origin);if(u.pathname==='/collections/shirts'){u.searchParams.set('view','shirts-editorial');a.href=u.href;}});
    const grid=root.querySelector('[data-gc-grid]');
    if (!grid) return;
    let cards=[...grid.querySelectorAll('[data-gc-card]')];
    const filters=document.querySelector('[data-gc-filters]');
    const form=filters.querySelector('[data-gc-filter-form]');
    const quick=document.querySelector('[data-gc-quick-dialog]');
    const quickContent=quick.querySelector('[data-gc-quick-content]');
    const count=root.querySelector('[data-gc-count]');
    const progress=root.querySelector('[data-gc-progress]');
    const active=root.querySelector('[data-gc-active-filters]');
    const params=new URLSearchParams(location.search);
    const state={size:params.getAll('gc_size'),colour:params.getAll('gc_colour'),style:params.getAll('gc_style'),available:params.get('gc_available')==='true',min:params.get('gc_min')||'',max:params.get('gc_max')||''};
    const readForm = () => {const d=new FormData(form);return {size:d.getAll('size'),colour:d.getAll('colour'),style:d.getAll('style'),available:d.get('available')==='true',min:d.get('min')||'',max:d.get('max')||''};};
    const writeForm = () => {['size','colour','style'].forEach(key=>form.querySelectorAll(`input[name="${key}"]`).forEach(input=>input.checked=state[key].includes(input.value)));form.elements.available.checked=state.available;form.elements.min.value=state.min;form.elements.max.value=state.max;};
    const matching = (card,s) => {
      const d=card.dataset;
      const sizes=(s.available?d.availableSizes:d.sizes).split('|').filter(Boolean);
      const tags=d.tags.split('|');
      return (!s.available||d.available==='true')&&(!s.size.length||s.size.some(size=>sizes.includes(size)))&&(!s.colour.length||s.colour.includes(d.colour))&&(!s.style.length||s.style.some(style=>tags.includes(style)))&&(s.min===''||Number(d.price)>=Number(s.min)*100)&&(s.max===''||Number(d.price)<=Number(s.max)*100);
    };
    const persist = (navigate=false,sort=null) => {
      const u=new URL(location.href);['size','colour','style','available','min','max'].forEach(key=>{u.searchParams.delete('gc_'+key);const value=state[key];if(Array.isArray(value))value.forEach(v=>u.searchParams.append('gc_'+key,v));else if(value!==''&&value!==false)u.searchParams.set('gc_'+key,String(value));});
      u.searchParams.set('view','shirts-editorial');if(sort)u.searchParams.set('sort_by',sort);
      if(navigate)location.assign(u.href);else history.replaceState(null,'',u.href);
    };
    const apply = () => {
      let visible=0;cards.forEach(card=>{card.hidden=!matching(card,state);if(!card.hidden)visible++;});
      count.textContent=`${visible} ${visible===1?'piece':'pieces'}`;progress.textContent=`Showing ${visible} ${visible===1?'piece':'pieces'}`;root.querySelector('[data-gc-empty]').hidden=visible!==0;
      active.replaceChildren();const chips=[];
      ['size','colour','style'].forEach(key=>state[key].forEach(value=>chips.push({key,value,label:value.replaceAll('-',' ')})));
      if(state.available)chips.push({key:'available',label:'In stock'});
      if(state.min!=='')chips.push({key:'min',label:`From ${state.min}`});if(state.max!=='')chips.push({key:'max',label:`Up to ${state.max}`});
      chips.forEach(chip=>{const b=document.createElement('button');b.type='button';b.textContent=chip.label+' ×';b.setAttribute('aria-label','Remove '+chip.label+' filter');b.addEventListener('click',()=>{if(Array.isArray(state[chip.key]))state[chip.key]=state[chip.key].filter(v=>v!==chip.value);else state[chip.key]=chip.key==='available'?false:'';writeForm();apply();persist();});active.append(b);});
      active.hidden=!chips.length;root.querySelector('[data-gc-active-count]').textContent=chips.length?`(${chips.length})`:'';
    };
    const previewCount=()=>{const draft=readForm();filters.querySelector('[data-gc-result-count]').textContent=`(${cards.filter(card=>matching(card,draft)).length})`;};
    document.querySelectorAll('[data-gc-filter-open]').forEach(button=>button.addEventListener('click',()=>{writeForm();previewCount();show(filters);const group=filters.querySelector(`[data-gc-filter-group="${button.dataset.gcFilterOpen}"]`);if(group){group.open=true;group.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});}}));
    form.addEventListener('input',previewCount);
    form.addEventListener('submit',e=>{e.preventDefault();Object.assign(state,readForm());const sort=form.elements.sort_by.value;const current=new URLSearchParams(location.search).get('sort_by')||root.querySelector('[data-gc-sort]').value;apply();filters.close();persist(sort!==current,sort);});
    const clear=()=>{Object.assign(state,{size:[],colour:[],style:[],available:false,min:'',max:''});writeForm();apply();previewCount();persist();};
    document.querySelectorAll('[data-gc-clear]').forEach(b=>b.addEventListener('click',clear));
    root.querySelector('[data-gc-sort]').addEventListener('change',e=>persist(true,e.target.value));
    root.querySelectorAll('[data-gc-density]').forEach(button=>button.addEventListener('click',()=>{grid.dataset.density=button.dataset.gcDensity;root.querySelectorAll('[data-gc-density]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));try{sessionStorage.setItem('guillo-editorial-density',button.dataset.gcDensity);}catch{}}));
    try{const density=sessionStorage.getItem('guillo-editorial-density');if(['1','2','3'].includes(density))root.querySelector(`[data-gc-density="${density}"]`).click();}catch{}
    const bindCards = newCards => newCards.forEach(card=>{
      card.querySelector('[data-gc-quick]').addEventListener('click',()=>{
        quickContent.replaceChildren(card.querySelector('template').content.cloneNode(true));
        quickContent.querySelectorAll('[data-gc-size]').forEach(button=>button.addEventListener('click',()=>{
          quickContent.querySelectorAll('[data-gc-size]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
          quickContent.querySelector('[data-gc-variant]').value=button.dataset.gcSize;
          const add=quickContent.querySelector('[type="submit"]');add.disabled=false;add.textContent=card.dataset.handle!=='firenze-chevron-shirt'&&card.dataset.tags.split('|').includes('pre-order')?'Pre-order':'Add to bag';
        }));
        show(quick);
      });
      const media=card.querySelector('[data-gc-media]');let startX=0;
      media.addEventListener('pointerdown',e=>startX=e.clientX,{passive:true});
      media.addEventListener('click',e=>{if(Math.abs(e.clientX-startX)>10)e.preventDefault();});
    });
    // Close the native size dialog before the existing cart drawer handles the form.
    quick.addEventListener('click',e=>{if(e.target.closest('button[type="submit"]:not(:disabled)'))quick.close();});
    bindCards(cards);writeForm();apply();
    const more=root.querySelector('[data-gc-load-more]');
    if(more)more.addEventListener('click',async e=>{
      e.preventDefault();more.setAttribute('aria-busy','true');
      try{const response=await fetch(more.href);if(!response.ok)throw Error('Load failed');const doc=new DOMParser().parseFromString(await response.text(),'text/html');const newCards=[...doc.querySelectorAll('[data-gc-card]')];newCards.forEach(c=>grid.append(c));cards.push(...newCards);bindCards(newCards);apply();const next=doc.querySelector('[data-gc-load-more]');if(next)more.href=next.href;else more.remove();}
      catch{location.assign(more.href);}finally{more.removeAttribute('aria-busy');}
    });
  };
  document.addEventListener('shopify:section:load',start);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
