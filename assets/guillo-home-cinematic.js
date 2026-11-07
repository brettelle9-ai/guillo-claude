/* Prepared mist textures animate on the compositor; no per-frame script or startup noise generation. */
(() => {
 const boot=()=>{
  if(!document.body.classList.contains('gh-home-preview'))return;
  const atmosphere=document.querySelector('.gh-header-atmosphere');if(!atmosphere||atmosphere.dataset.mounted)return;atmosphere.dataset.mounted='true';
  const toggle=document.querySelector('[data-gh-atmosphere-toggle]'),country=document.querySelector('.gh-country');
  document.querySelector('.gc-header__search')?.addEventListener('submit',e=>{const input=e.currentTarget.querySelector('input[type=search]');if(!input.value.trim()){e.preventDefault();input.focus();}});
  country?.addEventListener('keydown',e=>{if(e.key==='Escape'){country.open=false;country.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',e=>{if(country?.open&&!country.contains(e.target))country.open=false;});
  const images=[...atmosphere.querySelectorAll('img')];
  Promise.all(images.map(image=>image.decode().catch(()=>{}))).then(()=>{atmosphere.dataset.ready='true';});
  toggle?.addEventListener('click',()=>{const paused=document.body.classList.toggle('gh-atmosphere-paused');toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'Play logo atmosphere':'Pause logo atmosphere');});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();document.addEventListener('shopify:section:load',boot);
})();
