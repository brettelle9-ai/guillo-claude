/* A single, lightweight emblem reveal; the final logo remains still. */
(() => {
 const boot=()=>{
  if(!document.body.classList.contains('gh-home-preview'))return;
  const brand=document.querySelector('[data-gh-brand]');if(!brand||brand.dataset.mounted)return;brand.dataset.mounted='true';
  const country=document.querySelector('.gh-country');
  document.querySelector('.gc-header__search')?.addEventListener('submit',e=>{const input=e.currentTarget.querySelector('input[type=search]');if(!input.value.trim()){e.preventDefault();input.focus();}});
  country?.addEventListener('keydown',e=>{if(e.key==='Escape'){country.open=false;country.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',e=>{if(country?.open&&!country.contains(e.target))country.open=false;});
  const source=brand.querySelector('[data-gh-logo-source]')?.getAttribute('href');
  if(source){const artwork=new Image();artwork.src=source;artwork.decode().catch(()=>{}).then(()=>{brand.dataset.ready='true';});}else brand.dataset.ready='true';
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();document.addEventListener('shopify:section:load',boot);
})();
