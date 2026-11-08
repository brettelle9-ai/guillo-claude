const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Liquid} = require('liquidjs');
const {toLiquidHtmlAST} = require('@shopify/liquid-html-parser');

const root = path.resolve(__dirname, '..');
const globalObjects = {
  request: {origin: 'https://example.com'},
  shop: {name: 'Guillo Clothing', currency: 'AUD', refund_policy: {url: '/policies/refund-policy'}}
};
const engine = new Liquid({root: path.join(root, 'snippets'), extname: '.liquid', strictFilters: true, globals: globalObjects});
engine.registerTag('doc', {
  parse(token, tokens) {
    while (tokens.length && tokens.shift().name !== 'enddoc') {}
  }, render() { return ''; }
});
engine.registerFilter('json', value => JSON.stringify(value ?? null));
engine.registerFilter('image_url', image => image.url);

function product(overrides = {}) {
  return {
    id: 101, title: 'Test Chino', description: '<p>Actual product description.</p>',
    vendor: 'Guillo Clothing', type: 'Chinos', featured_image: {url: '//example.com/chino.jpg'},
    has_only_default_variant: false, options_with_values: [{name: 'Size'}],
    variants: [
      {id: 201, title: '32"', options: ['32"'], sku: 'CH-32', price: 13800, available: true, requires_shipping: true},
      {id: 202, title: '34"', options: ['34"'], sku: 'CH-34', price: 13800, available: false, requires_shipping: true}
    ], ...overrides
  };
}
async function render(p = product(), extra = {}) {
  p.selected_or_first_available_variant = p.variants.find(v => v.available) || p.variants[0];
  const context = {
    product: p, availability_mode: 'normal', canonical_url: 'https://example.com/products/chino?variant=201',
    request: {origin: 'https://example.com'}, cart: {currency: {iso_code: 'AUD'}},
    shop: {name: 'Guillo Clothing', currency: 'AUD', refund_policy: {url: '/policies/refund-policy'}},
    ...extra
  };
  const html = await engine.renderFile('guillo-product-schema', context, {globals: {shop: context.shop, request: context.request}});
  const match = html.match(/<script[^>]+>([\s\S]*?)<\/script>/);
  return {html, schema: match ? JSON.parse(match[1]) : null};
}

test('Shopify parser accepts modified Liquid and new snippets', () => {
  for (const file of ['snippets/guillo-product-schema.liquid', 'snippets/guillo-product-offer-schema.liquid', 'snippets/guillo-editorial-reviews.liquid', 'sections/guillo-editorial-product.liquid']) {
    assert.doesNotThrow(() => toLiquidHtmlAST(fs.readFileSync(path.join(root, file), 'utf8'), {mode: 'strict'}));
  }
});

test('variants retain their URLs, prices, SKUs, sizes and availability; descriptions reach every Product', async () => {
  const {schema} = await render();
  assert.equal(schema['@type'], 'ProductGroup');
  assert.equal(schema.productGroupID, '101');
  assert.deepEqual(schema.variesBy, ['https://schema.org/size']);
  assert.equal(schema.hasVariant.length, 2);
  for (const [index, variant] of schema.hasVariant.entries()) {
    assert.equal(variant.description, 'Actual product description.');
    assert.equal(variant.sku, product().variants[index].sku);
    assert.equal(variant.size, product().variants[index].title);
    assert.equal(variant.offers.price, 138);
    assert.equal(variant.offers.priceCurrency, 'AUD');
    assert.equal(variant.offers.url, `https://example.com/products/chino?variant=${201 + index}`);
    assert.equal(variant.offers.availability, `https://schema.org/${index ? 'OutOfStock' : 'InStock'}`);
    assert.deepEqual(variant.offers.hasMerchantReturnPolicy.applicableCountry, ['AU', 'NZ']);
    assert.equal(variant.offers.hasMerchantReturnPolicy.merchantReturnDays, 44);
    assert.equal(variant.offers.hasMerchantReturnPolicy.merchantReturnLink, 'https://example.com/policies/refund-policy');
    assert.ok(!variant.aggregateRating && !variant.review);
  }
  assert.ok(!schema.aggregateRating && !schema.review);
});

test('AU standard shipping threshold, cents and return region are exact', async () => {
  for (const [price, rate] of [[8400, 9.95], [10000, 9.95], [10001, 0], [13800, 0], [27900, 0]]) {
    const p = product(); p.variants[0].price = price;
    const {schema} = await render(p);
    const offer = schema.hasVariant[0].offers;
    assert.equal(offer.price, price / 100);
    assert.equal(offer.shippingDetails.shippingRate.value, rate);
    assert.equal(offer.shippingDetails.shippingRate.currency, offer.priceCurrency);
    assert.equal(offer.shippingDetails.shippingDestination.addressCountry, 'AU');
    assert.deepEqual(offer.shippingDetails.deliveryTime.transitTime, {'@type': 'QuantitativeValue', minValue: 2, maxValue: 4, unitCode: 'DAY'});
    assert.equal(offer.hasMerchantReturnPolicy.returnFees, 'https://schema.org/FreeReturn');
    assert.ok(!('returnMethod' in offer.hasMerchantReturnPolicy));
  }
});

test('preorders, interest, digital and unavailable variants have no normal shipping promise', async () => {
  const {schema} = await render(product(), {availability_mode: 'preorder'});
  assert.equal(schema.hasVariant[0].offers.availability, 'https://schema.org/PreOrder');
  assert.ok(!schema.hasVariant[0].offers.shippingDetails);
  assert.ok(!schema.hasVariant[1].offers.shippingDetails);
  assert.equal((await render(product(), {availability_mode: 'interest'})).schema, null);
  const p = product(); p.variants[0].requires_shipping = false;
  assert.ok(!(await render(p)).schema.hasVariant[0].offers.shippingDetails);
});

test('foreign currency never receives AUD charges or unverified overseas free-return claims', async () => {
  for (const currency of ['NZD', 'GBP', 'SGD', 'USD', 'EUR']) {
    const {schema} = await render(product(), {cart: {currency: {iso_code: currency}}});
    const offer = schema.hasVariant[0].offers;
    assert.equal(offer.priceCurrency, currency);
    assert.ok(!offer.shippingDetails);
    assert.deepEqual(offer.hasMerchantReturnPolicy.applicableCountry, ['AU', 'NZ']);
  }
});

test('single-default-variant product and hostile text produce valid, safe JSON', async () => {
  const p = product({has_only_default_variant: true, title: 'Bag "black" </script><script>alert(1)</script>', description: '<p>A bag with "quotes" & fabric.</p>'});
  const {html, schema} = await render(p);
  assert.equal(schema['@type'], 'Product');
  assert.equal(schema.name, p.title);
  assert.equal(schema.description, 'A bag with "quotes" & fabric.');
  assert.equal(schema.offers.price, 138);
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.ok(!schema.hasVariant);
});

// Execute the real storefront controller, with a small DOM/feed adapter.
// These synthetic review fixtures are never sent to the storefront.
function review(overrides = {}) {
  return {id: 1, product: {shopify_id: 101}, status: 'Published', is_store: false,
    rating: 5, author: 'Test Reviewer', content: 'Test review text', created_at: '2026-01-01T12:00:00Z', ...overrides};
}
async function loadReviews(pages, {fail = false, products = [{id: '101', name: 'Chino'}], productId = '101', initialSchema = {'@type': 'ProductGroup', hasVariant: []}} = {}) {
  class Element {
    constructor() { this.dataset = {}; this.textContent = ''; this.hidden = false; }
    append() {} setAttribute() {} addEventListener() {} replaceChildren() {}
  }
  const script = new Element(); script.dataset.productId = productId; script.textContent = JSON.stringify(initialSchema);
  const list = new Element(), status = new Element(), more = new Element(), score = new Element(), productScore = new Element();
  const section = new Element(); section.dataset.reviewFamily = 'luxe-chinos';
  section.querySelector = selector => ({
    '[data-shirt-review-products]': {textContent: JSON.stringify(products)},
    '[data-shirt-review-list]': list, '[data-shirt-status]': status,
    '[data-shirt-more]': more, '[data-review-sort]': new Element(), '[data-shirt-score]': score,
    '[data-product-review-score]': productScore
  }[selector]);
  const document = {
    querySelector: selector => selector === '[data-ge-shirt-reviews]' ? section : null,
    getElementById: () => script, querySelectorAll: () => [], createElement: () => new Element()
  };
  let requests = 0;
  const fetch = async url => {
    requests++;
    if (fail) return {ok: false};
    const offset = Number(url.searchParams.get('offset'));
    const page = pages[offset / 100] || [];
    return {ok: true, json: async () => ({reviews: page, has_more: offset / 100 + 1 < pages.length})};
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/guillo-shirt-reviews.js'), 'utf8'), {
    document, fetch, matchMedia: () => ({matches: false}), URL, URLSearchParams, Date, Map, Set
  });
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
  return {schema: JSON.parse(script.textContent), text: script.textContent, status, requests, productScore};
}

test('published exact-product reviews replace collection totals, deduplicate and paginate', async () => {
  const {schema, requests, productScore} = await loadReviews([
    [review(), review({id: 2, rating: 1, product: {shopify_id: 999}}), review({id: 3, status: 'Unpublished'}), review({id: 4, is_store: true})],
    [review(), review({id: 5, rating: 3, status: 'Featured'})]
  ]);
  assert.equal(requests, 2);
  assert.equal(schema.aggregateRating.ratingValue, 4);
  assert.equal(schema.aggregateRating.ratingCount, 2);
  assert.equal(schema.aggregateRating.reviewCount, 2);
  assert.equal(schema.review.length, 2);
  assert.equal(schema.review[0].datePublished, '2026-01-01');
  assert.equal(productScore.textContent, 'This item: 4 / 5 · 2 published ratings');
  assert.equal(productScore.hidden, false);
});

test('no reviews, malformed ratings, other products and network failures never create ratings', async () => {
  for (const pages of [[[]], [[review({product: {shopify_id: 999}})]], [[review({rating: 'invalid'}), review({id: 2, rating: 6})]]]) {
    const {schema} = await loadReviews(pages);
    assert.ok(!schema.aggregateRating && !schema.review);
  }
  const failed = await loadReviews([], {fail: true});
  assert.ok(!failed.schema.aggregateRating && !failed.schema.review);
  assert.match(failed.status.textContent, /temporarily unavailable/);
});

test('ratings without written reviews do not invent an author or review body', async () => {
  const {schema} = await loadReviews([[review({author: '', content: ''})]]);
  assert.equal(schema.aggregateRating.ratingCount, 1);
  assert.ok(!schema.review && !schema.aggregateRating.reviewCount);
});

test('review data cannot terminate the JSON-LD script', async () => {
  const content = '</script><script>alert("test")</script>';
  const {schema, text} = await loadReviews([[review({content})]]);
  assert.equal(schema.review[0].reviewBody, content);
  assert.ok(!text.includes('<'));
});

module.exports = {render, loadReviews};
