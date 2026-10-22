/* Pointer effects enhance the native link and customer form; no click interception. */
(() => {
  const mounted = new WeakSet();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const mount = () => {
    document.querySelectorAll('[data-guillo-sculpted]').forEach(button => {
      if (mounted.has(button)) return;
      mounted.add(button);
      let frame = 0;
      const reset = () => {
        cancelAnimationFrame(frame);
        button.style.setProperty('--sculpt-rx','0deg');
        button.style.setProperty('--sculpt-ry','0deg');
        button.style.removeProperty('--sculpt-x');
        button.style.removeProperty('--sculpt-y');
      };
      button.addEventListener('pointermove',event => {
        if (reduced.matches || !fine.matches || event.pointerType === 'touch') return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const box = button.getBoundingClientRect();
          const x = Math.max(0,Math.min(1,(event.clientX-box.left)/box.width));
          const y = Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));
          button.style.setProperty('--sculpt-rx',`${(0.5-y)*14}deg`);
          button.style.setProperty('--sculpt-ry',`${(x-0.5)*18}deg`);
          button.style.setProperty('--sculpt-x',`${30+x*40}%`);
          button.style.setProperty('--sculpt-y',`${25+y*30}%`);
        });
      },{passive:true});
      button.addEventListener('pointerleave',reset);
      button.addEventListener('blur',reset);
    });
    document.querySelectorAll('[data-glass-signup] .guillo-newsletter__inner').forEach(panel => {
      if (mounted.has(panel)) return;
      mounted.add(panel);
      let frame = 0, timer = 0;
      const illuminate = event => {
        if (reduced.matches) return;
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const box = panel.getBoundingClientRect();
          panel.style.setProperty('--glass-x',`${event.clientX-box.left}px`);
          panel.style.setProperty('--glass-y',`${event.clientY-box.top}px`);
          panel.style.setProperty('--glass-light','1');
        });
      };
      const dim = () => {
        cancelAnimationFrame(frame);
        panel.style.setProperty('--glass-light','.25');
      };
      panel.addEventListener('pointermove',illuminate,{passive:true});
      panel.addEventListener('pointerdown',illuminate,{passive:true});
      panel.addEventListener('pointerup',event => {
        if (event.pointerType !== 'mouse') timer = setTimeout(dim,1000);
      },{passive:true});
      panel.addEventListener('pointerleave',dim);
      panel.addEventListener('pointercancel',dim);
    });
  };
  document.addEventListener('shopify:section:load',mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
