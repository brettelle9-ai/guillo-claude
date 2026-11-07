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
    const key = 'guillo-size-advisor-v3-' + garment;
    const S = {step:1,h:180,w:80,imperial:false,route:'estimate',usual:null,shoulders:null,abdomen:null,seat:null,thighs:null,fit:null,chosen:null};
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved) {
        if (Number.isFinite(saved.h)) S.h = clamp(saved.h,145,210);
        if (Number.isFinite(saved.w)) S.w = clamp(saved.w,45,160);
        S.imperial = !!saved.imperial;
        ['shoulders','abdomen','seat','thighs','fit'].forEach(k => {if ([0,1,2].includes(saved[k])) S[k]=saved[k];});
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
    const headerProgress=document.createElement('span');
    headerProgress.className='gff__header-progress';
    headerProgress.setAttribute('role','status');
    root.querySelector('.gff__head').insertBefore(headerProgress,root.querySelector('[data-gff-close].gff__close'));
    let renderedStep=null;
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
      let base = (bottom || S.route==='usual') && S.usual != null ? S.usual : P.chart.findIndex(n=>n>=estimate-1.5);
      if(base<0)base=P.chart.length-1;
      const shift=S.fit===0 ? -1 : S.fit===2 ? 1 : 0;
      // Shape describes the cut; it must not silently change a known waist size.
      const wanted=base+shift;
      const idx=clamp(wanted,0,P.sizes.length-1);
      const gap=P.chart.length>1 ? P.chart[1]-P.chart[0] : 5;
      return {idx,limited:wanted!==idx || (!bottom && S.route==='estimate' && (estimate>P.chart.at(-1)+gap || estimate<P.chart[0]-gap))};
    }
    function icon(type,n=1) {
      let path='';
      if(type==='person')return '<svg viewBox="0 0 70 200" fill="none" aria-hidden="true"><path d="M35 7C24 7 24 25 30 29L29 34C26 37 18 37 16 44C13 55 12 72 12 87C12 92 17 93 19 88L22 61C23 78 21 88 23 99L24 181C24 186 31 187 32 181L35 117L38 181C39 187 46 186 46 181L47 99C49 88 47 78 48 61L51 88C53 93 58 92 58 87C58 72 57 55 54 44C52 37 44 37 41 34L40 29C46 25 46 7 35 7Z"/><path d="M29 34Q35 39 41 34M24 94Q35 98 46 94M35 98V117M27 47Q35 51 43 47" opacity=".5"/></svg>';
      if(type==='shoulders')path=`M${16-n*3} 17Q19 13 25 12L27 7Q32 11 37 7L39 12Q45 13 ${48+n*3} 17L${51+n*2} 30L45 33L42 25Q39 40 42 57H22Q25 40 22 25L19 33L${13-n*2} 30Z M25 12Q32 19 39 12`;
      if(type==='abdomen')path=`M23 7Q${26-n*5} 20 ${24-n*3} 33Q${23-n*4} 47 24 57M41 7Q${38+n*5} 20 ${40+n*3} 33Q${41+n*4} 47 40 57M30 8Q32 11 34 8M31 34H33`;
      if(type==='seat')path=`M23 8Q${21-n*3} 20 ${21-n*3} 34Q${20-n*2} 44 24 57M41 8Q${43+n*3} 20 ${43+n*3} 34Q${44+n*2} 44 40 57M32 17V35M32 35Q24 43 ${21-n*3} 34M32 35Q40 43 ${43+n*3} 34M23 8Q32 12 41 8`;
      if(type==='thighs')path=`M18 8Q32 12 46 8L${47+n*2} 24Q${48+n*2} 39 43 58H35L32 29L29 58H21Q${16-n*2} 39 ${17-n*2} 24Z M22 13Q32 17 42 13M32 17V29`;
      if(type==='fit')path=`M${22-n*4} 9L27 6Q32 12 37 6L${42+n*4} 9L${45+n*3} 57H${19-n*3}Z M27 6V15H37V6`;
      return `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="${path}"/></svg>`;
    }
    function intro(n,title,sub) {return `<div class="gff__intro"><span class="gff__stepno">${String(n).padStart(2,'0')} / 03</span><h2 tabindex="-1" data-gff-heading>${title}</h2><p class="gff__sub">${sub}</p></div>`;}
    function slider(k,label,min,max) {return `<div class="gff__slider"><div class="gff__slider-top"><label for="gff-${k}">${label}</label><span>${unit(k)}</span></div><div class="gff__number"><output for="gff-${k}" data-value="${k}">${value(k)}</output><small>${S.imperial && k==='h'?'':unit(k)}</small></div><div class="gff__slider-control"><button type="button" data-adjust="${k}" data-delta="-1" aria-label="Decrease ${label.toLowerCase()}">−</button><input id="gff-${k}" type="range" min="${min}" max="${max}" value="${S[k]}" data-range="${k}" aria-label="${label}" aria-valuetext="${value(k)} ${unit(k)}"><button type="button" data-adjust="${k}" data-delta="1" aria-label="Increase ${label.toLowerCase()}">+</button></div></div>`;}
    function usualWaist() { return '<p class="gff__question">Your usual waist size</p><div class="gff__usual">' + P.sizes.map((s,i)=>'<button type="button" data-usual="'+i+'" aria-pressed="'+(S.usual===i)+'">'+esc(s)+'</button>').join('') + '</div><p class="gff__sub">The waist size you wear comfortably now.</p>'; }
    function first() {
      if (bottom) return intro(1,'Your measurements','') + '<div class="gff__units"><button type="button" data-unit="0" aria-pressed="'+!S.imperial+'">cm / kg</button><button type="button" data-unit="1" aria-pressed="'+S.imperial+'">ft / lb</button></div><div class="gff__measurements"><div class="gff__person">'+icon('person')+'</div><div>'+slider('h','Height',145,210)+slider('w','Weight',45,160)+'</div></div>' + usualWaist();
      return intro(1,"Your measurements",'')+`<div class="gff__units"><button type="button" data-unit="0" aria-pressed="${!S.imperial}">cm / kg</button><button type="button" data-unit="1" aria-pressed="${S.imperial}">ft / lb</button></div>`+(S.route==='estimate'?`<div class="gff__measurements"><div class="gff__person">${icon('person')}</div><div>${slider('h','Height',145,210)}${slider('w','Weight',45,160)}</div></div><button class="gff__text" type="button" data-route="usual">I know my usual size</button>`:`<p class="gff__question">Your usual ${esc(garment)} size</p><div class="gff__usual">${P.sizes.map((s,i)=>`<button type="button" data-usual="${i}" aria-pressed="${S.usual===i}">${esc(s)}</button>`).join('')}</div><button class="gff__text" type="button" data-route="estimate">Use height and weight instead</button>`);}
    const groups = bottom
      ? [{key:'thighs',label:'Thighs',options:['Lean','Regular','Muscular']},{key:'seat',label:'Seat',options:['Flatter','Regular','Fuller']},{key:'abdomen',label:'Abdomen',options:['Flat','Regular','Rounded']}]
      : [{key:'shoulders',label:'Shoulders',options:['Narrow','Regular','Broad']},{key:'abdomen',label:'Abdomen',options:['Flat','Regular','Rounded']}];
    function second(){return intro(2,'Your shape.','Choose the closest match for each area.')+groups.map(g=>`<fieldset class="gff__shape"><legend>${g.label}</legend><div>${g.options.map((label,i)=>`<button type="button" data-shape="${g.key}" data-choice="${i}" aria-pressed="${S[g.key]===i}">${icon(g.key,i)}<span>${label}</span></button>`).join('')}</div></fieldset>`).join('');}
    const fitNames=['Close','As designed','Relaxed'], fitNotes=['Closer through the body.','The intended fit of this piece.','A little more room to move.'];
    function productCard(){return `<div class="gff__product-card">${P.image?`<img src="${esc(P.image)}" alt="" width="44" height="56">`:''}<div><span>${esc(P.name)}</span><small>${esc(P.price)}</small></div></div>`;}
    function third(){return productCard()+intro(3,'How do you like it to fit?','Choose how closely you like your clothes to sit.')+`<div class="gff__fits">${fitNames.map((label,i)=>`<button type="button" data-fit="${i}" aria-pressed="${S.fit===i}">${icon('fit',i)}<span><strong>${label}</strong><small>${fitNotes[i]}</small></span><i aria-hidden="true"></i></button>`).join('')}</div>`;}
    function result(){
      const r=recommendation(),i=S.chosen??r.idx,v=variantFor(i);
      return productCard()+`<div class="gff__result"><h2 class="gff__result-heading" tabindex="-1" data-gff-heading>${i===r.idx?'Your suggested size':'Your selected size'}</h2><div class="gff__circle"><svg class="gff__result-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="57"/></svg><span>${esc(P.sizes[i])}</span></div><p class="gff__result-summary">${fitNames[S.fit]} fit. ${bottom?'Based on your usual waist size.':S.route==='usual'?'Based on your usual size.':'Estimated from your measurements and shape.'}</p><div class="gff__size-rail">${P.sizes.map((s,j)=>`<button type="button" data-result-size="${j}" aria-pressed="${j===i}" aria-label="Size ${esc(s)}${j===r.idx?', recommended':''}"><span>${esc(s)}</span>${j===r.idx?'<small>Suggested</small>':''}</button>`).join('')}</div>${r.limited?'<p class="gff__caution">You may be outside this cut’s size range. Check the measurements before ordering.</p>':''}${v&&!v.available?'<p class="gff__stock">Currently unavailable. Select this size to request a restock notification.</p>':''}<details class="gff__measurement-details"><summary>Check measurements</summary><p class="gff__chart">${bottom?'Waist':'Chest'}: <strong>${measure(P.chart[i])}</strong>${P.leg&&P.inside?.[i]?`<br>Inside leg: <strong>${measure(P.inside[i])}</strong>`:''}</p><p class="gff__caution">Size guidance is approximate. Compare these measurements with the full size guide.</p></details><button class="gff__text" type="button" data-restart>Change my answers</button></div>`;
    }
    function ready(){return S.step===1?(bottom?S.usual!=null:(S.route==='estimate'||S.usual!=null)):S.step===2?groups.every(g=>S[g.key]!=null):S.fit!=null;}
    function render(focus=false){
      const previousStep=renderedStep;
      root.dataset.step=String(S.step);body.innerHTML=S.step===1?first():S.step===2?second():S.step===3?third():result();
      foot.hidden=false;back.hidden=S.step===1;back.innerHTML=S.step===4?'Edit answers':'←';back.setAttribute('aria-label',S.step===4?'Edit answers':'Previous step');
      next.disabled=!ready();const selectedVariant=S.step===4?variantFor(S.chosen??recommendation().idx):null;
      next.textContent=S.step===4?(selectedVariant&&!selectedVariant.available?'Select & notify me →':'Select & add to cart →'):S.step===3?'See my size →':'Continue →';
      headerProgress.textContent=S.step===4?'Your fit':S.step+' of 3';
      if(previousStep!==S.step) {
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const direction=previousStep && S.step<previousStep ? -1 : 1;
          [...body.children].forEach((item,i)=>item.animate(
            [{opacity:0,transform:'translateY('+direction*8+'px)'},{opacity:1,transform:'translateY(0)'}],
            {duration:360,delay:Math.min(i*28,112),easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}
          ));
        }
        renderedStep=S.step;
      }
      body.scrollTop=0;
      if(focus)body.querySelector('[data-gff-heading]')?.focus({preventScroll:true});
    }
    function select(i){
      const want=norm(P.sizes[i]);
      const input=[...document.querySelectorAll('form[action*="/cart/add"] input[type="radio"]')].find(el=>norm(el.dataset.size||el.value)===want&&!el.disabled);
      if(input){input.click();input.dispatchEvent(new Event('change',{bubbles:true}));return input;}
      return null;
    }
    function open(){lastFocus=document.activeElement;opened=true;previousOverflow=document.body.style.overflow;previousPadding=document.body.style.paddingRight;const gap=innerWidth-document.documentElement.clientWidth;if(gap)document.body.style.paddingRight=gap+'px';document.body.style.overflow='hidden';root.hidden=false;renderedStep=null;render();requestAnimationFrame(()=>{root.classList.add('is-open');panel.focus();});}
    function close(){opened=false;root.classList.remove('is-open');document.body.style.overflow=previousOverflow;document.body.style.paddingRight=previousPadding;setTimeout(()=>{if(!opened)root.hidden=true;},280);lastFocus?.focus();}
    function selectionMotion(selector) {
      if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const item=root.querySelector(selector);
      item?.animate([{transform:'scale(.975)'},{transform:'scale(1)'}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
      item?.querySelector('svg')?.animate([{opacity:.45,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
    }
    root.addEventListener('input',e=>{const k=e.target.dataset.range;if(!k)return;S[k]=Number(e.target.value);root.querySelector(`[data-value="${k}"]`).textContent=value(k);e.target.setAttribute('aria-valuetext',`${value(k)} ${unit(k)}`);});
    root.addEventListener('click',e=>{
      const t=e.target.closest('button,[data-gff-close]');if(!t)return;
      if(t.matches('[data-gff-close]'))return close();
      if(t.dataset.unit!=null){S.imperial=t.dataset.unit==='1';render();return;}
      if(t.dataset.adjust){const k=t.dataset.adjust;S[k]=clamp(S[k]+Number(t.dataset.delta),k==='h'?145:45,k==='h'?210:160);render();root.querySelector(`[data-adjust="${k}"][data-delta="${t.dataset.delta}"]`)?.focus();return;}
      if(t.dataset.route){S.route=t.dataset.route;render();return;}
      if(t.dataset.usual!=null){S.usual=Number(t.dataset.usual);render();selectionMotion('[data-usual="'+S.usual+'"]');return;}
      if(t.dataset.shape){S[t.dataset.shape]=Number(t.dataset.choice);render();selectionMotion('[data-shape="'+t.dataset.shape+'"][data-choice="'+t.dataset.choice+'"]');root.querySelector(`[data-shape="${t.dataset.shape}"][data-choice="${t.dataset.choice}"]`)?.focus();return;}
      if(t.dataset.fit!=null){S.fit=Number(t.dataset.fit);render();selectionMotion('[data-fit="'+S.fit+'"]');root.querySelector(`[data-fit="${t.dataset.fit}"]`)?.focus();return;}
      if(t.dataset.resultSize!=null){S.chosen=Number(t.dataset.resultSize);render();return;}
      if(t.hasAttribute('data-restart')){S.step=1;render(true);return;}
      if(t===back){S.step=Math.max(1,S.step-1);render(true);return;}
      if(t===next&&ready()){
        if(S.step===4){
          const input=select(S.chosen??recommendation().idx);
          if(!input){close();return;}
          const form=input.closest('form');
          const purchase=form?.querySelector('[data-ge-add],button[name="add"],button[type="submit"]');
          close();
          // Use the product's own purchase handler for cart, stock and preorder behaviour.
          if(purchase && !purchase.disabled){purchase.click();}
          else {input.focus({preventScroll:true});input.closest('fieldset')?.scrollIntoView({block:'center',behavior:'smooth'});}
          return;
        }
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
