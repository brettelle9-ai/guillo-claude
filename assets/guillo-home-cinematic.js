/* Immediate original logo; only lightweight search and country controls require JavaScript. */
(() => {
 const boot=()=>{
  if(!document.body.classList.contains('gh-home-preview'))return;
  const brand=document.querySelector('[data-gh-brand]');if(!brand||brand.dataset.mounted)return;brand.dataset.mounted='true';
  const country=document.querySelector('.gh-country');
  document.querySelector('.gc-header__search')?.addEventListener('submit',e=>{const input=e.currentTarget.querySelector('input[type=search]');if(!input.value.trim()){e.preventDefault();input.focus();}});
  country?.addEventListener('keydown',e=>{if(e.key==='Escape'){country.open=false;country.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',e=>{if(country?.open&&!country.contains(e.target))country.open=false;});

 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();document.addEventListener('shopify:section:load',boot);
})();
