/* Shared scroll reveals. Every section stays visible if scripting is unavailable. */
(() => {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let elements = [], raf = 0;
  const revealSignup = el => {
    el.classList.add('is-sweep-revealed');
    signupObserver?.unobserve(el);
  };
  const signupObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= .15) revealSignup(entry.target);
    });
  }, {threshold:[0,.15],rootMargin:'0px 0px -5% 0px'}) : null;
  const armSignups = () => {
    document.querySelectorAll('.guillo-newsletter').forEach(el => {
      if (el.classList.contains('is-sweep-ready')) return;
      if (media.matches || !signupObserver) {revealSignup(el);return;}
      signupObserver.observe(el);
      el.classList.add('is-sweep-ready');
      el.addEventListener('focusin',()=>revealSignup(el),{once:true});
    });
  };
  const collect = () => {
    elements = [...document.querySelectorAll('.g-card__media,.guillo-story__media,.guillo-cgrid__break-media,.guillo-anatomy__media')];
    elements.forEach(el => el.setAttribute('data-g-reveal',''));
    document.body.classList.add('g-modern-ready');
    armSignups();
    schedule();
  };
  const render = () => {
    raf = 0;
    if (media.matches) return;
    const vh = innerHeight;
    elements.forEach(el => {
      const box = el.getBoundingClientRect();
      if (box.bottom < -50 || box.top > vh+100) return;
      const reveal = Math.min(1,Math.max(0,(vh*.99-box.top)/(vh*.52)));
      el.style.setProperty('--g-reveal',reveal.toFixed(4));
    });
  };
  const schedule = () => {if (!raf) raf=requestAnimationFrame(render);};
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  media.addEventListener('change',()=>{
    if (media.matches) document.querySelectorAll('.guillo-newsletter').forEach(revealSignup);
    schedule();
  });
  document.addEventListener('shopify:section:load',collect);
  document.addEventListener('shopify:section:unload',collect);
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',collect,{once:true});else collect();
})();
