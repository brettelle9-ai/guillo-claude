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
  if(!hero||reduced.matches||!hero.animate||window.scrollY>80||hero.querySelector('h1')?.dataset.motionSkipped){const h=hero?.querySelector('h1');if(h)h.style.visibility='visible';return;}
  const image=hero.querySelector('picture img'),video=hero.querySelector('video');
  const media=hero.querySelector(':scope>picture,:scope>.gh-hero__media');
  const headline=hero.querySelector('h1'),actions=matchMedia('(min-width:1024px)').matches?hero.querySelector('.gh-hero__desktop-actions'):hero.querySelector('.gh-hero__content>.gh-button');
  const easing='cubic-bezier(.16,1,.3,1)',animations=[];let started=false,cancelled=false,watchdog;
  const prepare=(el,frames,duration,delay=0)=>{if(!el)return;const a=el.animate(frames,{duration,delay,easing,fill:'both'});a.pause();a.currentTime=0;animations.push(a);a.finished.then(()=>a.cancel()).catch(()=>{});};
  const letters=[...headline.querySelectorAll('.gh-headline-letter')];
  letters.forEach((letter,i)=>prepare(letter,[{opacity:0,transform:'translateY(4px)',filter:'blur(3px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0px)'}],1800,150+i*46));
  headline.dataset.motionReady='true';
  const cancel=()=>{headline.style.visibility='visible';headline.dataset.motionReady='true';cancelled=true;clearTimeout(watchdog);animations.forEach(a=>a.cancel());hero.dataset.entrance='skipped';};
  const start=async()=>{if(started||cancelled)return;if(document.hidden){document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();},{once:true});return;}started=true;clearTimeout(watchdog);
   if(document.fonts)await Promise.race([document.fonts.load('400 48px "Bodoni Moda"').catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1200))]);
   if(document.fonts&&!document.fonts.check('400 48px "Bodoni Moda"'))headline.style.fontFamily='Georgia,serif';
   const reveal=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(cancelled)return;hero.dataset.entrance='playing';headline.style.visibility='visible';animations.forEach(a=>a.play());Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(!cancelled)hero.dataset.entrance='complete';});}));reveal();
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
