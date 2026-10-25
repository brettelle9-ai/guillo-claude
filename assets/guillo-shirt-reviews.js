/* Read published reviews from the same public storefront feed as Klaviyo's widget. */
(() => {
  const section = document.querySelector('[data-ge-shirt-reviews]');
  if (!section) return;
  const products = JSON.parse(section.querySelector('[data-shirt-review-products]').textContent);
  const list = section.querySelector('[data-shirt-review-list]');
  const status = section.querySelector('[data-shirt-status]');
  const more = section.querySelector('[data-shirt-more]');
  const node = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  let reviews = [], shown = 0;
  function render() {
    reviews.slice(shown, shown + 5).forEach(review => {
      const card = node('article', null, 'ge-review');
      const author = node('div');
      author.append(node('strong', review.author || 'Customer'));
      if (review.verified) author.append(node('span', 'Verified purchase'));
      const date = node('time', new Date(review.created_at).toLocaleDateString('en-AU', {day:'numeric', month:'long', year:'numeric'}));
      date.dateTime = review.created_at;
      author.append(date);
      const body = node('div');
      const stars = node('p', '★'.repeat(Math.round(review.rating)) + '☆'.repeat(5 - Math.round(review.rating)), 'ge-review-stars');
      stars.setAttribute('aria-label', `${review.rating} out of five`);
      body.append(stars, node('small', review.product?.name || review.shirtName));
      if (review.title) body.append(node('h3', review.title));
      body.append(node('p', review.content));
      if (review.public_reply_content) body.append(node('blockquote', `Guillo replied: ${review.public_reply_content}`));
      card.append(author, body);
      list.append(card);
    });
    shown = Math.min(shown + 5, reviews.length);
    more.hidden = shown >= reviews.length;
  }
  more.addEventListener('click', render);
  async function loadProduct(product) {
    const collected = [];
    for (let offset = 0; ; offset += 100) {
      const url = new URL(`https://fast.a.klaviyo.com/reviews/api/client_reviews/${encodeURIComponent(product.id)}/`);
      url.search = new URLSearchParams({company_id:'YgJzQa', limit:'100', offset:String(offset), type:'reviews'});
      const response = await fetch(url);
      if (!response.ok) throw new Error('Reviews unavailable');
      const data = await response.json();
      if (!Array.isArray(data.reviews)) throw new Error('Invalid reviews response');
      collected.push(...data.reviews.filter(r => ['Published', 'Featured'].includes(r.status) && !r.is_store).map(r => ({...r, shirtName:product.name})));
      if (!data.has_more || !data.reviews.length) return collected;
    }
  }
  (async () => {
    try {
      const results = [];
      // Four requests at a time keeps the storefront feed light.
      for (let i = 0; i < products.length; i += 4) results.push(...await Promise.all(products.slice(i, i + 4).map(loadProduct)));
      reviews = [...new Map(results.flat().map(r => [r.id, r])).values()].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      status.hidden = true;
      if (!reviews.length) { status.hidden = false; status.textContent = 'No reviews yet.'; return; }
      const rating = (reviews.reduce((sum,r) => sum + Number(r.rating), 0) / reviews.length).toFixed(1);
      section.querySelector('[data-shirt-score]').textContent = `${rating} / 5 · ${reviews.length} reviews`;
      document.querySelectorAll('[data-shirt-rating]').forEach(el => {
        el.textContent = `${rating} ★★★★★ (${reviews.length})`;
        el.setAttribute('aria-label', `${rating} out of five from ${reviews.length} customer reviews`);
        el.hidden = false;
      });
      section.dataset.reviewSource = 'klaviyo';
      render();
    } catch (error) {
      status.textContent = 'Customer reviews are temporarily unavailable. Please refresh to try again.';
    }
  })();
})();
