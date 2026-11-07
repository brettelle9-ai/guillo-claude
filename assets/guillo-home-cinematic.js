/* Start the homepage entrance when its visible campaign media is ready. */
(() => {
 const boot=()=>{
  if(!document.body.classList.contains('gh-home-preview'))return;
  const brand=document.querySelector('[data-gh-brand]');if(!brand||brand.dataset.mounted)return;brand.dataset.mounted='true';
  const country=document.querySelector('.gh-country');
  document.querySelector('.gc-header__search')?.addEventListener('submit',e=>{const input=e.currentTarget.querySelector('input[type=search]');if(!input.value.trim()){e.preventDefault();input.focus();}});
  country?.addEventListener('keydown',e=>{if(e.key==='Escape'){country.open=false;country.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',e=>{if(country?.open&&!country.contains(e.target))country.open=false;});

  const hero=document.querySelector('.gh-hero'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(!hero||reduced.matches||!hero.animate||window.scrollY>80)return;
  const image=hero.querySelector('picture img'),video=hero.querySelector('video');
  const media=hero.querySelector(':scope>picture,:scope>.gh-hero__media');
  const wordmark=matchMedia('(min-width:1024px)').matches?brand:document.querySelector('.gc-header__logo>img');
  const nav=[...document.querySelectorAll('.gc-header__desktop-nav>a')];
  const headline=hero.querySelector('h1'),actions=matchMedia('(min-width:1024px)').matches?hero.querySelector('.gh-hero__desktop-actions'):hero.querySelector('.gh-hero__content>.gh-button');
  const easing='cubic-bezier(.16,1,.3,1)',animations=[];let started=false,cancelled=false,watchdog;
  const prepare=(el,frames,duration,delay=0)=>{if(!el)return;const a=el.animate(frames,{duration,delay,easing,fill:'both'});a.pause();a.currentTime=0;animations.push(a);a.finished.then(()=>a.cancel()).catch(()=>{});};
  prepare(media,[{transform:'scale(1.015)',opacity:1},{transform:'scale(1)',opacity:1}],1900);
  prepare(wordmark,[{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],1250,60);
  nav.forEach(el=>prepare(el,[{opacity:.65,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],1100,150));
  if(headline?.matches('[data-gh-handwriting]')){
   const strokes=[...headline.querySelectorAll('path')],lengths=strokes.map(p=>p.getTotalLength()),total=lengths.reduce((a,b)=>a+b,0);let elapsed=300;
   strokes.forEach((p,i)=>{const duration=lengths[i]/total*3400;prepare(p,[{strokeDasharray:'1',strokeDashoffset:1},{strokeDasharray:'1',strokeDashoffset:0}],duration,elapsed);animations[animations.length-1].effect.updateTiming({easing:'linear'});elapsed+=duration;});
  }else prepare(headline,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],1350,180);
  prepare(actions,[{opacity:.2,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],1300,300);
  const cancel=()=>{cancelled=true;clearTimeout(watchdog);animations.forEach(a=>a.cancel());hero.dataset.entrance='skipped';};
  const start=()=>{if(started||cancelled)return;if(document.hidden){document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();},{once:true});return;}started=true;clearTimeout(watchdog);
   const reveal=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(cancelled)return;hero.dataset.entrance='playing';animations.forEach(a=>a.play());Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(!cancelled)hero.dataset.entrance='complete';});}));reveal();
  };
  hero.dataset.entrance='waiting';
  if(image){if(image.complete){image.decode().catch(()=>{}).then(start);}else{image.addEventListener('load',()=>image.decode().catch(()=>{}).then(start),{once:true});image.addEventListener('error',start,{once:true});}}
  else if(video&&video.readyState<2){video.addEventListener('loadeddata',start,{once:true});video.addEventListener('error',start,{once:true});}else start();
  watchdog=setTimeout(start,1800);
  window.addEventListener('scroll',()=>{if(window.scrollY>80&&hero.dataset.entrance!=='complete')cancel();},{passive:true});
  window.addEventListener('pagehide',cancel,{once:true});reduced.addEventListener('change',e=>{if(e.matches)cancel();});

 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();document.addEventListener('shopify:section:load',boot);
})();
