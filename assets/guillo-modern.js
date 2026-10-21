/* Shared scroll reveals. Every section stays visible if scripting is unavailable. */
(() => {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let elements = [], raf = 0;
  const collect = () => {
    elements = [...document.querySelectorAll('.g-card__media,.guillo-story__media,.guillo-cgrid__break-media,.guillo-anatomy__media')];
    elements.forEach(el => el.setAttribute('data-g-reveal',''));
    document.body.classList.add('g-modern-ready');
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
  media.addEventListener('change',schedule);
  document.addEventListener('shopify:section:load',collect);
  document.addEventListener('shopify:section:unload',collect);
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',collect,{once:true});else collect();
})();
