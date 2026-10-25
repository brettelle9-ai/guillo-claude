(() => {
 const root=document.querySelector('[data-gh-home]');if(!root)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const syncHeader=()=>document.body.classList.toggle('gh-scrolled',window.scrollY>45);
 addEventListener('scroll',syncHeader,{passive:true});syncHeader();
 const quick=document.querySelector('[data-gh-quick]'),content=quick.querySelector('[data-gh-quick-content]');
 root.querySelectorAll('[data-gc-quick]').forEach(button=>button.addEventListener('click',()=>{
   const card=button.closest('[data-gc-card]');content.replaceChildren(card.querySelector('template').content.cloneNode(true));
   content.querySelectorAll('[data-gc-size]').forEach(size=>size.addEventListener('click',()=>{
     content.querySelectorAll('[data-gc-size]').forEach(other=>other.setAttribute('aria-pressed',String(other===size)));
     content.querySelector('[data-gc-variant]').value=size.dataset.gcSize;
     const add=content.querySelector('[type=submit]');add.disabled=false;add.textContent='Add to bag';
   }));quick.showModal();
 }));
 quick.addEventListener('click',e=>{if(e.target.closest('button[type=submit]:not(:disabled)'))quick.close();});
 const looks=document.querySelector('[data-gh-look-dialog]');
 root.querySelectorAll('[data-gh-look]').forEach(button=>button.addEventListener('click',()=>{
   looks.querySelector('[data-gh-look-content]').replaceChildren(button.closest('.gh-look').querySelector('template').content.cloneNode(true));looks.showModal();
 }));
 const rail=root.querySelector('[data-gh-rail]');
 root.querySelector('[data-gh-rail-prev]').addEventListener('click',()=>rail.scrollBy({left:-rail.clientWidth*.9,behavior:reduced.matches?'instant':'smooth'}));
 root.querySelector('[data-gh-rail-next]').addEventListener('click',()=>rail.scrollBy({left:rail.clientWidth*.9,behavior:reduced.matches?'instant':'smooth'}));
 const track=root.querySelector('[data-gh-campaign-track]'),slides=[...track.children],dots=[...root.querySelectorAll('[data-gh-slide]')],pause=root.querySelector('[data-gh-pause]');
 let current=0,paused=reduced.matches,visible=false,timer;
 function go(index){track.scrollTo({left:track.clientWidth*index,behavior:reduced.matches?'instant':'smooth'});}
 function schedule(){clearTimeout(timer);if(!paused&&visible&&!document.hidden)timer=setTimeout(()=>go((current+1)%slides.length),9000);}
 function sync(){current=Math.round(track.scrollLeft/track.clientWidth);dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===current)));slides.forEach((slide,i)=>slide.querySelectorAll('video').forEach(video=>{
   if(i===current&&visible&&!reduced.matches&&!document.hidden){video.muted=true;video.play().catch(()=>{});}else video.pause();
 }));schedule();}
 track.addEventListener('scroll',()=>{clearTimeout(timer);},{passive:true});
 track.addEventListener('scrollend',sync);
 dots.forEach((dot,i)=>dot.addEventListener('click',()=>{paused=true;pause.setAttribute('aria-label','Play campaign slideshow');pause.textContent='▷';go(i);}));
 pause.addEventListener('click',()=>{paused=!paused;pause.setAttribute('aria-label',paused?'Play campaign slideshow':'Pause campaign slideshow');pause.textContent=paused?'▷':'Ⅱ';schedule();});
 track.addEventListener('pointerdown',()=>{paused=true;pause.textContent='▷';pause.setAttribute('aria-label','Play campaign slideshow');});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.25}).observe(track);
 document.addEventListener('visibilitychange',sync);
 reduced.addEventListener('change',()=>{paused=reduced.matches;sync();});
})();
