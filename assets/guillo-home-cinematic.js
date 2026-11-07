/* Decorative smoke is drawn behind the exact supplied logo, never into it. */
(() => {
 const boot=()=>{
  if(!document.body.classList.contains('gh-home-preview'))return;
  const canvas=document.querySelector('[data-gh-brand-smoke]');if(!canvas||canvas.dataset.mounted)return;canvas.dataset.mounted='true';
  const desktop=matchMedia('(min-width:1024px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const toggle=document.querySelector('[data-gh-atmosphere-toggle]'),country=document.querySelector('.gh-country');
  let paused=false,raf=0,last=0,elapsed=0,previous=0;
  document.querySelector('.gc-header__search')?.addEventListener('submit',e=>{const input=e.currentTarget.querySelector('input[type=search]');if(!input.value.trim()){e.preventDefault();input.focus();}});
  country?.addEventListener('keydown',e=>{if(e.key==='Escape'){country.open=false;country.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',e=>{if(country?.open&&!country.contains(e.target))country.open=false;});
  // Do not allocate a graphics context on phones or for reduced-motion visitors.
  let gl=null,program=null,time=null;
  const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
  const fragment=`precision mediump float;
   varying vec2 uv;uniform float time;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
   float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+3.1;a*=.5;}return v;}
   void main(){
    vec2 p=vec2(uv.x,1.-uv.y);float t=time*.08;
    vec2 q=p*vec2(5.2,2.8);q.x-=t*.28;q.y+=t*.10;
    vec2 warp=vec2(fbm(q+t*.07),fbm(q+vec2(4.2,-t*.12)));
    float n=fbm(q+warp*2.5);float detail=fbm(q*1.9+warp*3.-t*.10);
    float ribbon=exp(-pow((p.y-(.52+.12*sin(p.x*8.+t)+.13*(n-.5)))*7.,2.));
    float veil=smoothstep(.30,.78,n)*ribbon;
    float wisps=pow(clamp(detail*.7+n*.5,0.,1.),3.5)*ribbon;
    float edge=pow(max(0.,1.-pow((p.x-.5)*2.,2.)),2.)*smoothstep(0.,.2,p.y)*(1.-smoothstep(.72,1.,p.y));
    float halo=exp(-length((p-vec2(.5,.5))*vec2(4.8,3.8))*2.2);
    float alpha=(veil*.32+wisps*.36+halo*.09)*edge;
    gl_FragColor=vec4(vec3(.82,.88,.97),alpha);
   }`;
  function init(){
   if(gl||!desktop.matches||reduced.matches)return;
   gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,powerPreference:'low-power'});if(!gl)return;
   function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;}
   const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);if(!vs||!fs){gl=null;return;}
   program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl=null;return;}
   gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);time=gl.getUniformLocation(program,'time');gl.viewport(0,0,canvas.width,canvas.height);canvas.dataset.smokeReady='true';
  }
  function active(){return desktop.matches&&!reduced.matches&&!paused&&!document.hidden&&!document.body.classList.contains('gh-scrolled')&&!document.getElementById('header-group')?.matches('.gc-has-mega,.gc-has-search');}
  function frame(now){raf=0;if(!active()){previous=0;return;}init();if(!gl)return;
   if(!previous)previous=now;elapsed+=Math.min(now-previous,100);previous=now;
   if(now-last>42){last=now;gl.uniform1f(time,elapsed/1000);gl.drawArrays(gl.TRIANGLES,0,6);}
   raf=requestAnimationFrame(frame);
  }
  function sync(){if(active()&&!raf)raf=requestAnimationFrame(frame);else if(!active()&&raf){cancelAnimationFrame(raf);raf=0;previous=0;}}
  toggle?.addEventListener('click',()=>{paused=!paused;document.body.classList.toggle('gh-atmosphere-paused',paused);toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'Play logo atmosphere':'Pause logo atmosphere');sync();});
  document.addEventListener('visibilitychange',sync);desktop.addEventListener('change',sync);reduced.addEventListener('change',sync);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  const header=document.getElementById('header-group');if(header)new MutationObserver(sync).observe(header,{attributes:true,attributeFilter:['class']});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);raf=0;gl=null;canvas.dataset.smokeReady='false';});
  sync();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();document.addEventListener('shopify:section:load',boot);
})();
