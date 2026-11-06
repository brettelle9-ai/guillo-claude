/* Guillo size advisor. Shared by editorial and original product pages.
   Height/weight advice is an estimate, not a measured fit probability. */
(() => {
  'use strict';
  const boot = () => {
    const data = document.querySelector('[data-gff-data]');
    const root = document.querySelector('[data-gff-root]');
    if (!data || !root || document.getElementById('GuilloFitHost')) return;
    let P;
    try { P = JSON.parse(data.textContent); } catch { return; }
    if (!P?.sizes?.length || !P.chart || P.chart.length !== P.sizes.length || P.chart.some((n,i) => !Number.isFinite(n) || (i && n <= P.chart[i-1]))) return;
    const bottom = P.kind === 'bottom', garment = bottom ? (P.leg ? 'chinos' : 'shorts') : (P.garment || 'shirt');
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const norm = s => String(s ?? '').replace(/[″′"'\s]/g,'').replace(/2xl/i,'xxl').toLowerCase();
    const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
    const key = 'guillo-size-advisor-v2-' + garment;
    const S = {step:1,h:180,w:80,imperial:false,route:'estimate',usual:null,shoulders:null,abdomen:null,seat:null,fit:null,chosen:null};
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved) {
        if (Number.isFinite(saved.h)) S.h = clamp(saved.h,145,210);
        if (Number.isFinite(saved.w)) S.w = clamp(saved.w,45,160);
        S.imperial = !!saved.imperial;
        ['shoulders','abdomen','seat','fit'].forEach(k => {if ([0,1,2].includes(saved[k])) S[k]=saved[k];});
        // Usual size is a label, never an array index from another product's chart.
        const i = P.sizes.findIndex(s => norm(s) === norm(saved.usual));
        if (i >= 0) S.usual = i;
        if (saved.route === 'usual' && i >= 0) S.route = 'usual';
      }
    } catch {}
    const remember = () => {try {localStorage.setItem(key,JSON.stringify({...S,usual:S.usual == null ? null : P.sizes[S.usual]}));} catch {}};
    const host = document.createElement('div'); host.id = 'GuilloFitHost';
    const shadow = host.attachShadow({mode:'open'});
    const css = document.querySelector('link[href*="guillo-fit-finder.css"]');
    if (css) { const link=document.createElement('link');link.rel='stylesheet';link.href=css.href;shadow.append(link); }
    shadow.append(root);document.body.append(host);
    const panel = root.querySelector('[data-gff-panel]'), body = root.querySelector('[data-gff-body]');
    const foot = root.querySelector('[data-gff-foot]'), next = root.querySelector('[data-gff-next]'), back = root.querySelector('[data-gff-back]');
    panel.setAttribute('aria-label','Find my size');
    root.querySelector('[data-gff-strip]').hidden = true;
    root.querySelector('.gff__mark').textContent = 'Size advisor';
    root.querySelector('.gff__product').hidden = true;
    let opened=false,lastFocus=null,previousOverflow='',previousPadding='';
    const variants = () => {try {return JSON.parse(document.querySelector('[data-variant-data]')?.textContent || '[]');} catch {return [];}};
    const variantFor = i => variants().find(v => (v.options || [v.option1]).some(o=>norm(o)===norm(P.sizes[i])));
    const measure = cm => S.imperial ? (cm/2.54).toFixed(1)+' in' : Math.round(cm)+' cm';
    const value = k => k === 'h' ? (S.imperial ? (()=>{const total=Math.round(S.h/2.54);return `${Math.floor(total/12)}′ ${total%12}″`;})() : S.h) : (S.imperial ? Math.round(S.w*2.20462) : S.w);
    const unit = k => S.imperial ? (k==='h'?'ft / in':'lb') : (k==='h'?'cm':'kg');
    function recommendation() {
      const bmi=S.w/(S.h/100)**2;
      let estimate=bottom ? 36+1.9*bmi : 52+1.9*bmi+.1*(S.h-178);
      // Shape refines the existing body estimate. The usual-size path preserves
      // the established whole-size fit rule, without double-counting shape.
      estimate += (S.abdomen-1)*2 + (bottom ? 0 : (S.shoulders-1)*2);
      let base = S.route==='usual' && S.usual != null ? S.usual : P.chart.findIndex(n=>n>=estimate-1.5);
      if(base<0)base=P.chart.length-1;
      const shift=S.fit===0 ? -1 : S.fit===2 ? 1 : 0;
      const seat=bottom && S.seat===2 && S.fit!==0 ? 1 : 0;
      const wanted=base+shift+seat;
      const idx=clamp(wanted,0,P.sizes.length-1);
      const gap=P.chart.length>1 ? P.chart[1]-P.chart[0] : 5;
      return {idx,limited:wanted!==idx || (S.route==='estimate' && (estimate>P.chart.at(-1)+gap || estimate<P.chart[0]-gap))};
    }
    function icon(type,n=1) {
      let path='';
      if(type==='person')return '<svg viewBox="0 0 70 200" fill="none" aria-hidden="true"><circle cx="35" cy="16" r="9"/><path d="M23 32Q35 27 47 32L51 88H43L41 185H34L31 106L29 185H22L21 88H14L18 42Q18 34 23 32ZM29 36V88M41 36V88M22 88H43M31 33V26M39 33V26"/></svg>';
      if(type==='shoulders')path=`M${14-n*3} 13L24 8Q32 15 40 8L${50+n*3} 13L47 57H17Z M24 8L26 18H38L40 8`;
      if(type==='abdomen')path=n===0?'M23 9Q27 31 24 57M41 9Q37 31 40 57M28 9H36':n===1?'M23 9Q23 31 22 57M41 9Q41 31 42 57M29 10Q27 35 29 57M35 10Q37 35 35 57':'M23 9Q13 33 23 57M41 9Q51 33 41 57M29 9Q24 33 29 57M35 9Q40 33 35 57';
      if(type==='seat')path=`M23 9Q${21-n*5} 32 20 43L24 57M41 9Q${43+n*5} 32 44 43L40 57M32 20V37M32 37Q${25-n*2} 45 20 43M32 37Q${39+n*2} 45 44 43`;
      if(type==='fit')path=`M${22-n*4} 9L27 6Q32 12 37 6L${42+n*4} 9L${45+n*3} 57H${19-n*3}Z M27 6V15H37V6`;
      return `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="${path}"/></svg>`;
    }
    function intro(n,title,sub) {return `<div class="gff__intro"><span class="gff__stepno">${String(n).padStart(2,'0')} / 03</span><h2 tabindex="-1" data-gff-heading>${title}</h2><p class="gff__sub">${sub}</p></div>`;}
    function slider(k,label,min,max) {return `<div class="gff__slider"><div class="gff__slider-top"><label for="gff-${k}">${label}</label><span>${unit(k)}</span></div><div class="gff__number"><output for="gff-${k}" data-value="${k}">${value(k)}</output><small>${S.imperial && k==='h'?'':unit(k)}</small></div><div class="gff__slider-control"><button type="button" data-adjust="${k}" data-delta="-1" aria-label="Decrease ${label.toLowerCase()}">−</button><input id="gff-${k}" type="range" min="${min}" max="${max}" value="${S[k]}" data-range="${k}" aria-label="${label}" aria-valuetext="${value(k)} ${unit(k)}"><button type="button" data-adjust="${k}" data-delta="1" aria-label="Increase ${label.toLowerCase()}">+</button></div></div>`;}
    function first() {return intro(1,"Let's find your fit.",'Two numbers to start. Drag to adjust.')+`<div class="gff__units"><button type="button" data-unit="0" aria-pressed="${!S.imperial}">cm / kg</button><button type="button" data-unit="1" aria-pressed="${S.imperial}">ft / lb</button></div>`+(S.route==='estimate'?`<div class="gff__measurements"><div class="gff__person">${icon('person')}</div><div>${slider('h','Height',145,210)}${slider('w','Weight',45,160)}</div></div><button class="gff__text" type="button" data-route="usual">I know my usual size</button>`:`<p class="gff__question">Your usual ${esc(garment)} size</p><div class="gff__usual">${P.sizes.map((s,i)=>`<button type="button" data-usual="${i}" aria-pressed="${S.usual===i}">${esc(s)}</button>`).join('')}</div><button class="gff__text" type="button" data-route="estimate">Use height and weight instead</button>`);}
    const groups = [{key:'shoulders',label:'Shoulders',options:['Narrow','Regular','Broad']},{key:'abdomen',label:'Abdomen',options:['Flat','Regular','Rounded']},{key:'seat',label:'Seat',options:['Flatter','Regular','Fuller']}];
    function second(){return intro(2,'Your shape.','Choose the closest match for each area.')+groups.map(g=>`<fieldset class="gff__shape"><legend>${g.label}</legend><div>${g.options.map((label,i)=>`<button type="button" data-shape="${g.key}" data-choice="${i}" aria-pressed="${S[g.key]===i}">${icon(g.key,i)}<span>${label}</span></button>`).join('')}</div></fieldset>`).join('');}
    const fitNames=['Close','As designed','Relaxed'], fitNotes=['Closer through the body.','The intended fit of this piece.','A little more room to move.'];
    function productCard(){return `<div class="gff__product-card">${P.image?`<img src="${esc(P.image)}" alt="" width="44" height="56">`:''}<div><span>${esc(P.name)}</span><small>${esc(P.price)}</small></div></div>`;}
    function third(){return productCard()+intro(3,'How do you like it to fit?','Choose how closely you like your clothes to sit.')+`<div class="gff__fits">${fitNames.map((label,i)=>`<button type="button" data-fit="${i}" aria-pressed="${S.fit===i}">${icon('fit',i)}<span><strong>${label}</strong><small>${fitNotes[i]}</small></span><i aria-hidden="true"></i></button>`).join('')}</div>`;}
    function result(){
      const r=recommendation(),i=S.chosen??r.idx,v=variantFor(i);
      return productCard()+`<div class="gff__result"><span class="gff__eyebrow">${i===r.idx?'Your suggested size':'Your selected size'}</span><div class="gff__circle"><span>${esc(P.sizes[i])}</span></div><h2 tabindex="-1" data-gff-heading>${fitNames[S.fit]} fit</h2><p>${S.route==='usual'?'Based on your usual size, shape and preferred fit.':'Estimated from your height, weight, shape and preferred fit.'}</p><div class="gff__size-rail">${P.sizes.map((s,j)=>`<button type="button" data-result-size="${j}" aria-pressed="${j===i}" aria-label="Size ${esc(s)}${j===r.idx?', recommended':''}"><span>${esc(s)}</span>${j===r.idx?'<small>Suggested</small>':''}</button>`).join('')}</div><p class="gff__chart">${bottom?'Waist':'Chest'} in size guide: <strong>${measure(P.chart[i])}</strong>${P.leg&&P.inside?.[i]?`<br>Inside leg: <strong>${measure(P.inside[i])}</strong>`:''}</p><p class="gff__caution">${r.limited?'You may be outside this cut’s size range. Compare your measurements with the size guide before ordering.':'This is a guide. Compare the measurements with your size guide before choosing.'}</p>${v&&!v.available?'<p class="gff__stock">This size is currently unavailable. Select it to request a restock notification.</p>':''}<button class="gff__text" type="button" data-restart>Change my answers</button></div>`;
    }
    function ready(){return S.step===1?(S.route==='estimate'||S.usual!=null):S.step===2?groups.every(g=>S[g.key]!=null):S.fit!=null;}
    function render(focus=false){
      root.dataset.step=String(S.step);body.innerHTML=S.step===1?first():S.step===2?second():S.step===3?third():result();
      foot.hidden=false;back.hidden=S.step===1;back.innerHTML=S.step===4?'Edit answers':'←';back.setAttribute('aria-label',S.step===4?'Edit answers':'Previous step');
      next.disabled=!ready();next.textContent=S.step===4?`Use size ${P.sizes[S.chosen??recommendation().idx]} →`:S.step===3?'See my size →':'Continue →';
      foot.querySelector('[data-gff-progress]')?.remove();
      const progress=document.createElement('div');progress.dataset.gffProgress='';progress.className='gff__progress';progress.setAttribute('aria-label',S.step===4?'Recommendation ready':`Step ${S.step} of 3`);progress.innerHTML=[1,2,3].map(n=>`<i class="${S.step>=n?'is-on':''}"></i>`).join('');foot.insertBefore(progress,next);
      body.scrollTop=0;
      if(focus)body.querySelector('[data-gff-heading]')?.focus({preventScroll:true});
    }
    function select(i){
      const want=norm(P.sizes[i]);
      const input=[...document.querySelectorAll('form[action*="/cart/add"] input[type="radio"]')].find(el=>norm(el.dataset.size||el.value)===want&&!el.disabled);
      if(input){input.click();input.dispatchEvent(new Event('change',{bubbles:true}));return input;}
      return null;
    }
    function open(){lastFocus=document.activeElement;opened=true;previousOverflow=document.body.style.overflow;previousPadding=document.body.style.paddingRight;const gap=innerWidth-document.documentElement.clientWidth;if(gap)document.body.style.paddingRight=gap+'px';document.body.style.overflow='hidden';root.hidden=false;render();requestAnimationFrame(()=>{root.classList.add('is-open');panel.focus();});}
    function close(){opened=false;root.classList.remove('is-open');document.body.style.overflow=previousOverflow;document.body.style.paddingRight=previousPadding;setTimeout(()=>{if(!opened)root.hidden=true;},250);lastFocus?.focus();}
    root.addEventListener('input',e=>{const k=e.target.dataset.range;if(!k)return;S[k]=Number(e.target.value);root.querySelector(`[data-value="${k}"]`).textContent=value(k);e.target.setAttribute('aria-valuetext',`${value(k)} ${unit(k)}`);});
    root.addEventListener('click',e=>{
      const t=e.target.closest('button,[data-gff-close]');if(!t)return;
      if(t.matches('[data-gff-close]'))return close();
      if(t.dataset.unit!=null){S.imperial=t.dataset.unit==='1';render();return;}
      if(t.dataset.adjust){const k=t.dataset.adjust;S[k]=clamp(S[k]+Number(t.dataset.delta),k==='h'?145:45,k==='h'?210:160);render();root.querySelector(`[data-adjust="${k}"][data-delta="${t.dataset.delta}"]`)?.focus();return;}
      if(t.dataset.route){S.route=t.dataset.route;render();return;}
      if(t.dataset.usual!=null){S.usual=Number(t.dataset.usual);render();return;}
      if(t.dataset.shape){S[t.dataset.shape]=Number(t.dataset.choice);render();root.querySelector(`[data-shape="${t.dataset.shape}"][data-choice="${t.dataset.choice}"]`)?.focus();return;}
      if(t.dataset.fit!=null){S.fit=Number(t.dataset.fit);render();root.querySelector(`[data-fit="${t.dataset.fit}"]`)?.focus();return;}
      if(t.dataset.resultSize!=null){S.chosen=Number(t.dataset.resultSize);render();return;}
      if(t.hasAttribute('data-restart')){S.step=1;render(true);return;}
      if(t===back){S.step=Math.max(1,S.step-1);render(true);return;}
      if(t===next&&ready()){
        if(S.step===4){const input=select(S.chosen??recommendation().idx);if(input){close();input.focus({preventScroll:true});input.closest('fieldset')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}else{next.textContent='Please choose this size on the page';close();}return;}
        S.step++;if(S.step===4){S.chosen=null;remember();}render(true);
      }
    });
    root.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();close();return;}
      if(e.key!=='Tab')return;
      const focusable=[...root.querySelectorAll('button:not(:disabled),input,[tabindex="0"]')].filter(el=>!el.hidden&&el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1),active=shadow.activeElement;
      if(e.shiftKey&&(active===first||active===panel)){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&(active===last||active===panel)){e.preventDefault();first?.focus();}
    });
    document.addEventListener('click',e=>{const trigger=e.target.closest?.('[data-gff-open]');if(!trigger)return;e.preventDefault();e.stopPropagation();document.querySelector('[data-gfys-close]')?.click();if(!opened)open();},true);
    document.querySelectorAll('[data-gff-link]').forEach(el=>el.hidden=false);
    window.GuilloFit={open,close};
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  document.addEventListener('shopify:section:load',boot);
})();
