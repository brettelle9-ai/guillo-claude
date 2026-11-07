/* Layered volumetric mist, rendered locally without a video download or WebGL dependency. */
(() => {
 const boot=()=>{
  if(!document.body.classList.contains('gh-home-preview'))return;
  const atmosphere=document.querySelector('.gh-header-atmosphere');if(!atmosphere||atmosphere.dataset.mounted)return;atmosphere.dataset.mounted='true';
  const toggle=document.querySelector('[data-gh-atmosphere-toggle]'),country=document.querySelector('.gh-country');
  document.querySelector('.gc-header__search')?.addEventListener('submit',e=>{const input=e.currentTarget.querySelector('input[type=search]');if(!input.value.trim()){e.preventDefault();input.focus();}});
  country?.addEventListener('keydown',e=>{if(e.key==='Escape'){country.open=false;country.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',e=>{if(country?.open&&!country.contains(e.target))country.open=false;});
  const desktop=matchMedia('(min-width:1024px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)'),canvas=atmosphere.querySelector('canvas'),ctx=canvas?.getContext('2d',{alpha:true});
  const host=document.getElementById('header-group');let textures=[],raf=0,previous=0,lastDraw=0,elapsed=0,paused=false;
  // A smooth deterministic noise field gives the mist internal detail at every scale.
  const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
  const mix=(a,b,t)=>a+(b-a)*t;
  function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);return mix(mix(hash(ix,iy),hash(ix+1,iy),u),mix(hash(ix,iy+1),hash(ix+1,iy+1),u),v);}
  function fbm(x,y){let sum=0,amp=.5;for(let i=0;i<5;i++){sum+=amp*noise(x,y);const a=x;x=a*1.81-y*.72+13.6;y=a*.72+y*1.81+7.4;amp*=.5;}return sum;}
  function texture(seed){const tile=document.createElement('canvas');tile.width=960;tile.height=192;const c=tile.getContext('2d'),data=c.createImageData(tile.width,tile.height);
   for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++){const u=x/tile.width,v=y/tile.height,px=u*7.5+seed,py=v*2.8;
    const warp=fbm(px*.8+4,py*.8+seed),field=fbm(px+warp*2.5,py+fbm(px+9,py+3)*1.8);
    const density=Math.pow(Math.max(0,(field-.29)/.56),2.3),height=Math.exp(-Math.pow((v-.4)*2.5,2))*(1-Math.pow(v,1.2));
    const edge=Math.pow(Math.sin(Math.PI*u),.6),i=(y*tile.width+x)*4;
    data.data[i]=213;data.data[i+1]=220;data.data[i+2]=229;data.data[i+3]=Math.min(115,density*height*edge*130);
   }c.putImageData(data,0,0);return tile;
  }
  function setup(){if(!ctx||!desktop.matches)return;if(!textures.length)textures=[texture(2.7),texture(26.3)];const w=Math.min(1920,Math.ceil(atmosphere.clientWidth));if(canvas.width!==w){canvas.width=w;canvas.height=160;}canvas.dataset.ready='true';}
  function render(){if(!ctx||!textures.length)return;const w=canvas.width,h=canvas.height,t=elapsed/1000;ctx.clearRect(0,0,w,h);
   // Broad stationary backlight catches the moving layers, avoiding flashing or pulsing.
   const light=ctx.createRadialGradient(w*.5,27,2,w*.5,27,w*.32);light.addColorStop(0,'rgba(226,234,244,.15)');light.addColorStop(.3,'rgba(172,190,215,.055)');light.addColorStop(1,'rgba(172,190,215,0)');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
   ctx.globalCompositeOperation='screen';ctx.globalAlpha=.77;const drift=Math.sin(t/65)*w*.035;ctx.drawImage(textures[0],-w*.18+drift,-20,w*1.36,150);
   ctx.globalAlpha=.43;ctx.drawImage(textures[1],-w*.26-Math.sin(t/89)*w*.045,-5,w*1.5,132);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
   // A gentle vertical falloff keeps the navigation clear.
   ctx.globalCompositeOperation='destination-in';const fade=ctx.createLinearGradient(0,0,0,h);fade.addColorStop(0,'rgba(0,0,0,.95)');fade.addColorStop(.55,'rgba(0,0,0,.65)');fade.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=fade;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
  }
  function active(){return desktop.matches&&!reduced.matches&&!paused&&!document.hidden&&!document.body.classList.contains('gh-scrolled')&&!host?.matches('.gc-has-mega,.gc-has-search');}
  function frame(now){raf=0;if(!active()){previous=0;return;}setup();if(!ctx)return;if(previous)elapsed+=Math.min(100,now-previous);previous=now;if(now-lastDraw>50){render();lastDraw=now;}raf=requestAnimationFrame(frame);}
  function sync(){if(desktop.matches){setup();if(!raf)render();}if(active()&&!raf)raf=requestAnimationFrame(frame);else if(!active()&&raf){cancelAnimationFrame(raf);raf=0;previous=0;}}
  toggle?.addEventListener('click',()=>{paused=!paused;document.body.classList.toggle('gh-atmosphere-paused',paused);toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'Play logo atmosphere':'Pause logo atmosphere');sync();});
  document.addEventListener('visibilitychange',sync);desktop.addEventListener('change',sync);reduced.addEventListener('change',sync);window.addEventListener('resize',sync,{passive:true});
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});if(host)new MutationObserver(sync).observe(host,{attributes:true,attributeFilter:['class']});sync();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();document.addEventListener('shopify:section:load',boot);
})();
