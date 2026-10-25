/* Card ratings: the product-line figure, counted exactly as guillo-shirt-reviews.js counts it on the product page. */
(() => {
  const pending = root => [...root.querySelectorAll('[data-gc-card] [data-gc-rating]:not([data-gc-rating-done])')];
  const slots = pending(document);
  const source = document.getElementById('GCReviewLines');
  if (!source) return;
  const members = new Map();
  try {
    JSON.parse(source.textContent).forEach(([line, id]) => {
      if (!members.has(line)) members.set(line, []);
      members.get(line).push(String(id));
    });
  } catch (error) { slots.forEach(slot => slot.remove()); return; }

  const feeds = new Map();
  function loadProduct(id) {
    if (feeds.has(id)) return feeds.get(id);
    const job = (async () => {
      const key = `gcr:${id}`;
      try { const cached = sessionStorage.getItem(key); if (cached) return JSON.parse(cached); } catch (error) {}
      const collected = [];
      for (let offset = 0; ; offset += 100) {
        const url = new URL(`https://fast.a.klaviyo.com/reviews/api/client_reviews/${encodeURIComponent(id)}/`);
        url.search = new URLSearchParams({company_id:'YgJzQa', limit:'100', offset:String(offset), type:'reviews'});
        const response = await fetch(url);
        if (!response.ok) throw new Error('Reviews unavailable');
        const data = await response.json();
        if (!Array.isArray(data.reviews)) throw new Error('Invalid reviews response');
        collected.push(...data.reviews.filter(r => ['Published', 'Featured'].includes(r.status) && !r.is_store).map(r => ({
          id: r.id, rating: Number(r.rating),
          product: String(r.product?.shopify_id || r.product?.external_id || ''),
          handle: r.product?.shopify_handle || r.product?.handle || ''
        })));
        if (!data.has_more || !data.reviews.length) break;
      }
      try { sessionStorage.setItem(key, JSON.stringify(collected)); } catch (error) {}
      return collected;
    })();
    feeds.set(id, job);
    return job;
  }

  async function lineFigure(line) {
    const ids = members.get(line) || [];
    const inLine = new Set(ids);
    // Same membership rule as the product page, including historic Luxe colour names.
    const belongs = r => inLine.has(r.product) || (line === 'luxe-chinos' && /(?:luxe|slim)-chino/.test(r.handle) && !r.handle.includes('signore'));
    const results = [];
    // Four requests at a time keeps the storefront feed light.
    for (let i = 0; i < ids.length; i += 4) results.push(...await Promise.all(ids.slice(i, i + 4).map(loadProduct)));
    const reviews = [...new Map(results.flat().filter(belongs).map(r => [r.id, r])).values()];
    if (!reviews.length) return null;
    return {count: reviews.length, rating: (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)};
  }

  const figures = new Map();
  let queue = Promise.resolve();
  function fill(list) {
   const byLine = new Map();
   list.forEach(slot => {
    slot.setAttribute('data-gc-rating-done', '');
    const line = slot.closest('[data-gc-card]').dataset.reviewLine;
    if (!line || !members.has(line)) { slot.remove(); return; }
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push(slot);
   });
   // Lines run one after another so requests never exceed four at a time.
   queue = queue.then(async () => {
   for (const [line, lineSlots] of byLine) {
    if (!figures.has(line)) figures.set(line, lineFigure(line).catch(() => null));
    const figure = await figures.get(line);
    lineSlots.forEach(slot => {
      if (!figure) { slot.remove(); return; }
      slot.textContent = `${figure.rating} `;
      const stars = document.createElement('span');
      stars.setAttribute('aria-hidden', 'true');
      stars.textContent = '★★★★★';
      slot.append(stars);
      slot.setAttribute('aria-label', `Rated ${figure.rating} out of five from ${figure.count} reviews`);
      slot.style.visibility = '';
    });
   }
   });
  }
  if (slots.length) fill(slots);
  // Cards added later (collection "Load more") get the same treatment.
  new MutationObserver(() => { const added = pending(document); if (added.length) fill(added); })
    .observe(document.body, {childList: true, subtree: true});
})();
