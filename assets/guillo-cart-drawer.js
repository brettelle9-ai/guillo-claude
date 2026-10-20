/* ==========================================================================
   GUILLO — Custom Cart Drawer (vanilla JS, no dependencies)
   --------------------------------------------------------------------------
   Uses Shopify's AJAX Cart API:
     GET  /cart.js            -> read cart
     POST /cart/add.js        -> add line / quick-add upsell
     POST /cart/change.js     -> change qty / remove (qty 0)
   Money is formatted with Intl.NumberFormat using the cart's *presentment*
   currency, so it always reflects the active Shopify Market. Nothing hardcoded.
   ========================================================================== */
(function () {
  'use strict';

  // Boot exactly once, even if this script is ever included twice (a
  // duplicated drawer section used to double-bind every click handler,
  // doubling quantity changes and quick-adds).
  if (window.__guilloCartBooted) return;
  window.__guilloCartBooted = true;

  /* ---- Config from the section ---------------------------------------- */
  var cfgEl = document.getElementById('GuilloCartConfig');
  if (!cfgEl) return;
  var CFG = {};
  try { CFG = JSON.parse(cfgEl.textContent); } catch (e) { CFG = {}; }

  var drawer  = document.getElementById('GuilloCartDrawer');
  var overlay = document.getElementById('GuilloCartOverlay');
  if (!drawer || !overlay) return;

  /* ---- Isolate the drawer in a shadow root -------------------------------
     Horizon styles the page with body:has(...) rules, so any element added or
     removed anywhere under <body> makes the browser restyle the whole
     document. Measured on the product page: ~150ms for every change inside
     the drawer (each quantity tap, each re-render), far worse on a phone.
     :has() cannot see into a shadow tree, so once the drawer lives in one the
     same change costs ~8ms. Nothing else about the drawer changes: same
     markup, same stylesheet, same variables, inherited fonts and tokens. */
  (function isolate() {
    if (!document.body.attachShadow) return;
    if (window.Shopify && window.Shopify.designMode) return; // the editor swaps sections in place
    var cssLink = document.querySelector('link[href*="guillo-cart-drawer.css"]');
    if (!cssLink) return;
    var host = document.createElement('div');
    host.id = 'GuilloCartHost';
    host.style.display = 'none'; // until its stylesheet is in, so nothing flashes unstyled
    var root = host.attachShadow({ mode: 'open' });
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssLink.href;
    var show = function () { host.style.display = ''; };
    link.addEventListener('load', show);
    link.addEventListener('error', show);
    root.appendChild(link);
    var vars = document.getElementById('GuilloCartVars');
    if (vars) root.appendChild(vars.cloneNode(true));
    root.appendChild(overlay);
    root.appendChild(drawer);
    document.body.appendChild(host);
    window.setTimeout(show, 1500);
  })();

  /* ---- Element references --------------------------------------------- */
  var els = {
    items:        drawer.querySelector('[data-gcart-items]'),
    empty:        drawer.querySelector('[data-gcart-empty]'),
    count:        drawer.querySelectorAll('[data-gcart-count]'),
    body:         drawer.querySelector('[data-gcart-body]'),
    footer:       drawer.querySelector('[data-gcart-footer]'),
    subtotal:     drawer.querySelector('[data-gcart-subtotal]'),
    shipping:     drawer.querySelector('[data-gcart-shipping]'),
    discountRow:  drawer.querySelector('[data-gcart-discount-row]'),
    promo:        drawer.querySelector('[data-gcart-promo]'),
    promoToggle:  drawer.querySelector('[data-gcart-promo-toggle]'),
    promoPanel:   drawer.querySelector('[data-gcart-promo-panel]'),
    promoInput:   drawer.querySelector('[data-gcart-promo-input]'),
    promoApply:   drawer.querySelector('[data-gcart-promo-apply]'),
    promoApplied: drawer.querySelector('[data-gcart-promo-applied]'),
    promoCode:    drawer.querySelector('[data-gcart-promo-code]'),
    promoRemove:  drawer.querySelector('[data-gcart-promo-remove]'),
    promoMsg:     drawer.querySelector('[data-gcart-promo-msg]'),
    discountLabel:drawer.querySelector('[data-gcart-discount-label]'),
    discountValue:drawer.querySelector('[data-gcart-discount-value]'),
    totalRow:     drawer.querySelector('[data-gcart-total-row]'),
    totalLabel:   drawer.querySelector('[data-gcart-total-label]'),
    total:        drawer.querySelector('[data-gcart-total]'),
    payment:      drawer.querySelector('[data-gcart-payment]'),
    badge:        drawer.querySelector('[data-gcart-badge]'),
    checkout:     drawer.querySelector('[data-gcart-checkout]'),
    // wardrobe
    wardrobe:     drawer.querySelector('[data-gcart-wardrobe]'),
    wardrobeMsg:  drawer.querySelector('[data-gcart-wardrobe-msg]'),
    unlockedLabel:drawer.querySelector('[data-gcart-unlocked-label]'),
    progressFill: drawer.querySelector('[data-gcart-progress-fill]'),
    nodes:        drawer.querySelectorAll('[data-gcart-node]'),
    // upsells
    upsellCards:  drawer.querySelectorAll('[data-gcart-upsell-card]')
  };

  /* ---- Helpers -------------------------------------------------------- */
  var locale = (document.documentElement.lang || 'en');
  var lastCart = null; // cached cart so the drawer opens instantly
  var lastItemsSig = null; // what the item list currently shows

  // Pre-order variants (id -> ships-by string), rendered by the section from
  // variant custom.preorder metafields. Empty when no product runs pre-orders.
  var PREORDER = {};
  var PREORDER_ATTR = 'Pre-order';
  (function () {
    var el = document.getElementById('GuilloCartPreorder');
    if (!el) return;
    try {
      (JSON.parse(el.textContent).items || []).filter(Boolean).forEach(function (x) { PREORDER[x.id] = x.shipsBy; });
    } catch (e) { PREORDER = {}; }
  })();

  // Format a price (cents, presentment currency) using the active currency.
  function money(cents, currency) {
    var decimals = (typeof CFG.moneyDecimals === 'number') ? CFG.moneyDecimals : 2;
    var amount = (cents || 0) / 100;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(amount);
    } catch (e) {
      // Fallback if the currency code is unknown to the browser
      return amount.toFixed(decimals) + ' ' + (currency || '');
    }
  }

  function fill(tpl, map) {
    var out = String(tpl || '');
    for (var k in map) {
      if (!map.hasOwnProperty(k)) continue;
      var val = (map[k] === undefined || map[k] === null) ? '' : map[k];
      out = out.split('{' + k + '}').join(val);
    }
    return out;
  }

  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); });
  }

  function getCart() {
    return fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); });
  }

  /* ---- Quiet add confirmation ------------------------------------------
     When CFG.quietAdd is on, adding to cart no longer opens the drawer.
     Instead: aria-live toast with a "View bag" link, a bump on the header
     cart icon, and (form adds) an "Added" state on the button plus a small
     ghost image that arcs to the cart icon. The drawer still opens normally
     from the cart icon or the toast link. */
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CHECK_SVG = '<svg viewBox="0 0 12 10" width="12" height="10" aria-hidden="true" focusable="false"><path d="M1 5.2 4.2 8.4 11 1.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  var toastEl = null, toastTimer = null;

  function visibleCartIcon() {
    var els = document.querySelectorAll(
      '.gheader__btn[href$="/cart"], a[href$="/cart"], .navlink--cart, #cart-icon-bubble, .header__icon--cart, .site-header__cart'
    );
    for (var i = 0; i < els.length; i++) {
      if (els[i].offsetParent && !drawer.contains(els[i])) return els[i];
    }
    return null;
  }

  function bumpIcon() {
    if (reducedMotion) return;
    var icon = visibleCartIcon();
    if (!icon) return;
    icon.classList.remove('gcart-bump');
    void icon.offsetWidth;
    icon.classList.add('gcart-bump');
    icon.addEventListener('animationend', function h() {
      icon.classList.remove('gcart-bump');
      icon.removeEventListener('animationend', h);
    });
  }

  function showToast() {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'gcart-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      toastEl.innerHTML = CHECK_SVG + '<span data-gcart-toast-text></span><a href="/cart" data-gcart-toast-view></a>';
      toastEl.querySelector('[data-gcart-toast-view]').addEventListener('click', function (e) {
        e.preventDefault();
        hideToast();
        openDrawer();
      });
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector('[data-gcart-toast-text]').textContent = CFG.toastText || 'Added to bag';
    toastEl.querySelector('[data-gcart-toast-view]').textContent = CFG.toastLinkText || 'View bag';
    toastEl.classList.add('is-in');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 2400);
  }

  function hideToast() {
    if (toastEl) toastEl.classList.remove('is-in');
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  function flyToCart(imgUrl, fromEl) {
    if (!imgUrl || !fromEl || reducedMotion) return false;
    var icon = visibleCartIcon();
    if (!icon || !fromEl.getBoundingClientRect) return false;
    var f = fromEl.getBoundingClientRect(), t = icon.getBoundingClientRect();
    if (!f.width || !t.width) return false;
    var el = document.createElement('span');
    el.className = 'gcart-fly';
    el.innerHTML = '<img src="' + imgUrl + (imgUrl.indexOf('?') === -1 ? '?width=120' : '&width=120') + '" alt="">';
    el.style.left = (f.left + f.width / 2 - 21) + 'px';
    el.style.top = (f.top + f.height / 2 - 21) + 'px';
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.transform = 'translate(' + (t.left + t.width / 2 - (f.left + f.width / 2)) + 'px, ' +
          (t.top + t.height / 2 - (f.top + f.height / 2)) + 'px) scale(0.22)';
        el.style.opacity = '0.25';
      });
    });
    setTimeout(function () { el.remove(); bumpIcon(); }, 600);
    return true;
  }

  function btnAdded(btn) {
    if (!btn) return;
    btn.classList.add('gcart-btn-rel');
    var o = document.createElement('span');
    o.className = 'gcart-btn-added';
    o.setAttribute('aria-hidden', 'true');
    o.innerHTML = CHECK_SVG + '<span>' + escapeHtml(CFG.toastText || 'Added to bag') + '</span>';
    btn.appendChild(o);
    setTimeout(function () { o.remove(); }, 2000);
  }

  // Central confirmation: toast always; fly when we have an image + source,
  // otherwise just bump the icon straight away.
  function confirmQuiet(opts) {
    opts = opts || {};
    showToast();
    if (!flyToCart(opts.img, opts.fromEl)) bumpIcon();
  }

  /* ---- Open / close --------------------------------------------------- */
  // The page behind is held still without touching <body>. A class on body
  // (the old "gcart-open" scroll lock) restyled and re-laid-out the whole
  // page: measured at ~120ms on the product page before the drawer could even
  // start to move, several times that on a phone. The overlay covers the page,
  // so blocking scroll on the overlay and on the drawer's fixed parts is enough.
  function holdPage(on) {
    var chat = document.querySelector('shopify-chat');
    if (chat) chat.style.display = on ? 'none' : '';
  }
  function blockScroll(e) {
    if (e.target.closest && e.target.closest('.gcart-body, .gcart-upsell__scroll, .gcart-sheet__body')) return;
    if (e.cancelable) e.preventDefault();
  }
  overlay.addEventListener('touchmove', blockScroll, { passive: false });
  overlay.addEventListener('wheel', blockScroll, { passive: false });
  drawer.addEventListener('touchmove', blockScroll, { passive: false });
  drawer.addEventListener('wheel', blockScroll, { passive: false });

  var wantOpen = false;
  function openDrawer(noRefresh) {
    wantOpen = true;
    holdPage(true);
    overlay.hidden = false;
    // Start the slide on the next frame instead of forcing a synchronous layout.
    window.requestAnimationFrame(function () {
      if (!wantOpen) return; // closed again before the frame arrived
      overlay.classList.add('is-open');
      drawer.classList.add('is-open');
    });
    drawer.setAttribute('aria-hidden', 'false');
    // Open instantly: if we already have a cart, show it now and sync quietly
    // in the background; only show the loading state on a true cold start.
    // A caller that is mid-add passes noRefresh and refreshes once the add lands.
    if (noRefresh !== true) refresh(lastCart !== null);
  }

  function closeDrawer() {
    wantOpen = false;
    overlay.classList.remove('is-open');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    holdPage(false);
    window.setTimeout(function () { if (!wantOpen) overlay.hidden = true; }, 350);
  }

  /* ---- Render --------------------------------------------------------- */
  function render(cart) {
    // Never render an error payload (e.g. a 422 from /cart/change.js when
    // stock runs out) — it has no item_count and paints "(undefined)".
    if (!cart || typeof cart.item_count !== 'number') { refresh(true); return; }
    lastCart = cart;
    var currency = cart.currency;
    var count = cart.item_count;

    // Header count
    els.count.forEach(function (el) { el.textContent = count; });
    updateSiteCart(cart);

    // Empty vs filled
    var isEmpty = count === 0;
    els.empty.hidden = !isEmpty;
    els.items.hidden = isEmpty;
    if (els.footer) els.footer.style.display = isEmpty ? 'none' : '';

    // Line items. Rebuilding the list re-decodes every image, so skip it when
    // nothing a shopper can see has changed (the common case on a quiet sync).
    var sig = currency + '|' + cart.items.map(function (it) {
      return it.key + ':' + it.quantity + ':' + it.final_line_price + ':' + it.original_line_price;
    }).join(',');
    if (sig !== lastItemsSig) {
      els.items.innerHTML = cart.items.map(itemHTML.bind(null, currency)).join('');
      lastItemsSig = sig;
    }

    // Totals / wardrobe / upsells
    syncPreorderNote(cart);
    renderTotals(cart);
    renderWardrobe(cart);
    renderUpsells(cart);
  }

  function itemHTML(currency, item) {
    var imgSrc = item.image ? (item.image.indexOf('?') === -1
      ? item.image + '?width=320' : item.image + '&width=320') : '';
    // These images are written into the DOM at the moment the drawer opens, and
    // the drawer only exists once it is open. loading="lazy" let the browser
    // defer the fetch past that moment, so the first item sat blank for one to
    // two seconds on a cold cache (naturalWidth 0) before appearing. Nothing
    // here is below the fold, so the image is fetched eagerly and at high
    // priority. Width stays at 320: the slot renders at 78 CSS px, so this
    // still covers a 3x screen without pulling a full size file.
    // No width/height attributes on purpose. These images are deliberately
    // shown at their own shape (see .gcart-item__media img, height: auto), so
    // asserting one ratio here would reserve the wrong box and make the row
    // jump when the real image lands.
    var img = item.image
      ? '<img src="' + imgSrc + '" alt="' + escapeHtml(item.product_title) +
        '" loading="eager" fetchpriority="high" decoding="async">'
      : '';
    var lineSave = (item.original_line_price || 0) - (item.final_line_price || 0);
    var hasCompare = lineSave > 0;
    var priceHTML = hasCompare
      ? '<s>' + money(item.original_line_price, currency) + '</s>' + money(item.final_line_price, currency)
      : money(item.final_line_price, currency);
    // Dollar saving per line, from the real cart discount (no percentages).
    var saveHTML = hasCompare
      ? '<p class="gcart-item__save">' +
          escapeHtml(CFG.itemSavePrefix || 'You save') + ' ' + money(lineSave, currency) + '</p>'
      : '';

    // "Size: 32" rather than a bare "32": the option name comes from the
    // cart line itself, so it reads Colour or Length where that is the option.
    var opts = (item.options_with_values || []).filter(function (o) {
      return o && o.value && o.value !== 'Default Title';
    }).map(function (o) { return escapeHtml(o.name) + ': ' + escapeHtml(o.value); });
    var variant = opts.length
      ? '<p class="gcart-item__variant">' + opts.join(' &middot; ') + '</p>'
      : ((item.variant_title && item.variant_title !== 'Default Title')
          ? '<p class="gcart-item__variant">' + escapeHtml(item.variant_title) + '</p>' : '');
    // Just the dot and the word. The ships-by date lives behind the info mark,
    // on hover and on focus so it is reachable by tap and by keyboard too.
    var preBy = PREORDER[item.variant_id];
    var preNote = preBy
      ? '<p class="gcart-item__preorder">Pre-order' +
          '<button type="button" class="gcart-item__preinfo"' +
            ' data-tip="Ships by ' + escapeHtml(preBy) + '"' +
            ' aria-label="Ships by ' + escapeHtml(preBy) + '">' +
            // Drawn rather than typed: a text "i" inside a bordered box never
            // centres cleanly at 10px and renders differently per font.
            '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false">' +
              '<circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" stroke-width="0.9"/>' +
              '<circle cx="6" cy="3.5" r="0.72" fill="currentColor"/>' +
              '<path d="M6 5.5v3.2" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>' +
            '</svg>' +
          '</button>' +
        '</p>'
      : '';

    return '' +
      '<div class="gcart-item" data-key="' + item.key + '">' +
        '<a class="gcart-item__media" href="' + item.url + '" tabindex="-1">' + img + '</a>' +
        '<div class="gcart-item__info">' +
          '<div class="gcart-item__head">' +
            '<h3 class="gcart-item__title"><a href="' + item.url + '">' + escapeHtml(item.product_title) + '</a></h3>' +
            '<span class="gcart-item__price">' + priceHTML + '</span>' +
          '</div>' +
          variant +
          saveHTML +
          preNote +
          '<div class="gcart-item__actions">' +
            '<div class="gcart-qty">' +
              '<button type="button" class="gcart-qty__btn" data-gcart-minus aria-label="Decrease quantity">&minus;</button>' +
              '<span class="gcart-qty__value">' + item.quantity + '</span>' +
              '<button type="button" class="gcart-qty__btn" data-gcart-plus aria-label="Increase quantity">+</button>' +
            '</div>' +
            '<button type="button" class="gcart-remove" data-gcart-remove>Remove</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---- Shipping truth --------------------------------------------------
     CFG.freeShippingThreshold and CFG.shippingRate are set per market in the
     section and must mirror Settings > Shipping for the matching zone. They
     are in major units (120 = £120). Shopify evaluates its price-based rate
     conditions on the cart total after discounts, so we compare against
     cart.total_price. With neither value set we say nothing we can't back up.
     Returns { free, label, remaining } with remaining in cents. */
  function shippingState(cart) {
    var threshold = Number(CFG.freeShippingThreshold) || 0;
    var rate = Number(CFG.shippingRate) || 0;
    var subtotal = cart.total_price;

    if (threshold && subtotal >= Math.round(threshold * 100)) {
      return { free: true, label: CFG.freeShippingText || 'Free', remaining: 0 };
    }
    var remaining = threshold ? Math.max(0, Math.round(threshold * 100) - subtotal) : 0;
    if (rate) {
      return { free: false, label: money(Math.round(rate * 100), cart.currency), remaining: remaining };
    }
    if (threshold) {
      return { free: false, label: CFG.shippingAtCheckoutText || 'Calculated at checkout', remaining: remaining };
    }
    // Nothing configured for this market: never claim free, never invent a rate.
    return { free: false, label: CFG.shippingAtCheckoutText || 'Calculated at checkout', remaining: 0 };
  }

  /* ---- Pre-order note on the order ------------------------------------
     Writes a cart attribute listing any pre-order lines, so the information
     survives checkout and lands on the order in Shopify admin and in the
     confirmation email. Done as a cart attribute rather than a line-item
     property because this theme has roughly twenty different add-to-cart
     paths (AI blocks, pair builder, outfit builder, assistant, quick-adds);
     patching all of them, or wrapping fetch globally, would risk breaking
     add-to-cart. This runs in one place instead, on every cart render.
     Guarded so it only writes when the value actually changes - no loop. */
  var preSyncing = false;
  function syncPreorderNote(cart) {
    if (preSyncing) return;
    var names = [];
    (cart.items || []).forEach(function (it) {
      var by = PREORDER[it.variant_id];
      if (!by) return;
      var label = it.product_title;
      if (it.variant_title && it.variant_title !== 'Default Title') label += ' ' + it.variant_title;
      names.push(label + ' - ships ' + by);
    });
    var want = names.join('; ');
    var have = (cart.attributes && cart.attributes[PREORDER_ATTR]) || '';
    if (want === have) return;
    preSyncing = true;
    var body = {}; body[PREORDER_ATTR] = want;
    postJSON('/cart/update.js', { attributes: body })
      .then(function () { preSyncing = false; })
      .catch(function () { preSyncing = false; });
  }

  /* ---- Discount code ---------------------------------------------------
     /cart/update.js with a `discount` value puts the code on the cart itself
     (not just checkout), so cart.total_discount — which the totals above
     already read — picks it up with no extra work. An empty value clears it.
     A code Shopify will not honour comes back in cart.discount_codes with
     applicable:false, which is how a bad code is detected. */
  function promoMessage(text, isError) {
    if (!els.promoMsg) return;
    els.promoMsg.textContent = text || '';
    els.promoMsg.hidden = !text;
    els.promoMsg.classList.toggle('is-error', !!isError);
  }

  function appliedCode(cart) {
    var codes = (cart && cart.discount_codes) || [];
    for (var i = 0; i < codes.length; i++) {
      if (codes[i] && codes[i].applicable) return codes[i].code;
    }
    return '';
  }

  function renderPromo(cart) {
    if (!els.promo) return;
    var code = appliedCode(cart);
    if (code) {
      els.promoApplied.hidden = false;
      els.promoCode.textContent = code;
      els.promoToggle.hidden = true;
      els.promoPanel.hidden = true;
      els.promoToggle.setAttribute('aria-expanded', 'false');
      promoMessage('');
    } else {
      els.promoApplied.hidden = true;
      els.promoToggle.hidden = false;
    }
  }

  function setPromoBusy(busy) {
    if (els.promoApply) els.promoApply.disabled = !!busy;
    if (els.promoInput) els.promoInput.disabled = !!busy;
  }

  function applyPromo() {
    if (!els.promoInput) return;
    var code = (els.promoInput.value || '').trim();
    if (!code) { promoMessage('Enter a code first.', true); els.promoInput.focus(); return; }
    setPromoBusy(true);
    promoMessage('');
    postJSON('/cart/update.js', { discount: code })
      .then(function (cart) {
        setPromoBusy(false);
        if (appliedCode(cart)) {
          els.promoInput.value = '';
          render(cart);
          return;
        }
        // Not honoured: take it back off so the bag is not left carrying a
        // code that does nothing, and say so.
        promoMessage('That code cannot be used on this bag.', true);
        return postJSON('/cart/update.js', { discount: '' }).then(render);
      })
      .catch(function () {
        setPromoBusy(false);
        promoMessage('Could not apply that code. Try again.', true);
      });
  }

  function removePromo() {
    setPromoBusy(true);
    postJSON('/cart/update.js', { discount: '' })
      .then(function (cart) { setPromoBusy(false); promoMessage(''); render(cart); })
      .catch(function () { setPromoBusy(false); });
  }

  if (els.promoToggle) {
    els.promoToggle.addEventListener('click', function () {
      var open = els.promoPanel.hidden;
      els.promoPanel.hidden = !open;
      els.promoToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && els.promoInput) els.promoInput.focus();
    });
  }
  if (els.promoApply) els.promoApply.addEventListener('click', applyPromo);
  if (els.promoRemove) els.promoRemove.addEventListener('click', removePromo);
  if (els.promoInput) {
    els.promoInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
    });
  }

  function renderTotals(cart) {
    var currency = cart.currency;
    var count = cart.item_count;

    // Real savings from Shopify's applied automatic discounts (no estimates).
    var totalSave = cart.total_discount || 0;
    var original = cart.original_total_price || cart.items_subtotal_price;

    els.subtotal.textContent = money(original, currency);

    // Shipping row. This used to print "Free" unconditionally, which was only
    // true in markets whose free-shipping bar a typical cart already cleared.
    // Now it reads the per-market threshold/rate from the section.
    if (els.shipping) {
      var ship = shippingState(cart);
      els.shipping.textContent = ship.label;
      els.shipping.classList.toggle('gcart-row__value--free', ship.free);
    }

    var showSaved = CFG.showDiscountEstimate !== false && totalSave > 0;
    if (showSaved) {
      els.subtotal.classList.add('is-struck');
      els.discountRow.hidden = false;
      els.discountLabel.textContent = CFG.savedLabel || 'Total saved';
      els.discountValue.textContent = '-' + money(totalSave, currency);
      els.totalRow.hidden = false;
      els.totalLabel.textContent = CFG.totalLabel || 'Total';
      els.total.textContent = money(cart.total_price, currency);
    } else {
      els.subtotal.classList.remove('is-struck');
      els.discountRow.hidden = true;
      els.totalRow.hidden = true;
    }
    renderPromo(cart);

    // The percentage badge is retired; savings read as dollars in the totals.
    if (els.badge) els.badge.hidden = true;

    // Payment / installments line ({installments} × {payment})
    if (els.payment && CFG.showPayment) {
      var base = cart.total_price;
      var n = CFG.paymentInstallments || 4;
      var per = money(Math.round(base / n), currency);
      els.payment.innerHTML = fill(escapeHtml(CFG.paymentText), {
        installments: n,
        payment: '<b>' + per + '</b>'
      });
    }

    if (els.checkout) els.checkout.classList.toggle('is-disabled', count === 0);
  }

  /* ---- Bundle ladder nudge -------------------------------------------- */
  // Garment map rendered by the section from the Chinos/Shirts collections.
  var GARMENTS = {};
  (function () {
    var el = document.getElementById('GuilloCartGarments');
    if (!el) return;
    try { GARMENTS = JSON.parse(el.textContent); } catch (e) { GARMENTS = {}; }
  })();

  // One line based on cart contents. Returns { text, loud } or null.
  // Priority: free-delivery nudge > 3+ nudge. No pair pricing anywhere.
  function nudgeLine(cart) {
    var count = cart.item_count;
    if (count >= (CFG.threshold || 3)) return null; // unlocked message handles 3+

    // Free delivery is the most actionable thing a stalled cart can act on, so
    // it outranks the bundle lines. Reads the same shippingState() the Shipping
    // row uses, so the two can never disagree. Only fires in markets that have
    // a threshold configured.
    var ship = shippingState(cart);
    if (!ship.free && ship.remaining > 0 && CFG.shippingNudgeText) {
      return {
        text: fill(CFG.shippingNudgeText, { amount: money(ship.remaining, cart.currency) }),
        loud: true
      };
    }

    // Pair discounts retired 2026-09-21. One line only, towards the 3+ offer.
    if (count === 2) return { text: 'A third piece takes 20% off everything.', loud: false };
    return null;
  }

  function renderWardrobe(cart) {
    if (!els.wardrobe) return;
    var count = cart.item_count;
    var threshold = CFG.threshold || 3;
    var pct = CFG.discountPercent || 0;
    var unlocked = count >= threshold;
    var nudge = nudgeLine(cart);

    // Message: the cart-specific nudge wins; otherwise the configured text.
    // Only the loud (hero) pairs get the prominent styling.
    els.wardrobeMsg.classList.toggle('is-nudge', !unlocked && !!(nudge && nudge.loud));
    if (unlocked) {
      els.wardrobeMsg.textContent = fill(CFG.unlockedMessage, { percent: pct });
      if (els.unlockedLabel) {
        els.unlockedLabel.hidden = false;
        els.unlockedLabel.textContent = fill(CFG.unlockedLabel, { percent: pct });
      }
    } else {
      var remaining = threshold - count;
      var piece = remaining === 1 ? CFG.pieceSingular : CFG.piecePlural;
      els.wardrobeMsg.textContent = (nudge && nudge.text) || fill(CFG.buildingMessage, {
        remaining: remaining, piece: (piece || '').toLowerCase(), percent: pct
      });
      if (els.unlockedLabel) els.unlockedLabel.hidden = true;
    }

    // Nodes
    els.nodes.forEach(function (node) {
      var idx = parseInt(node.getAttribute('data-gcart-node'), 10);
      node.classList.toggle('is-complete', count >= idx);
    });

    // The lock sits at the midpoint: each piece moves the bar a step towards
    // it, and reaching it fills the whole bar.
    var pos = unlocked ? 1 : (count / Math.max(1, threshold)) * 0.5;
    els.wardrobe.classList.toggle('is-unlocked', unlocked);
    if (els.progressFill) els.progressFill.style.width = (pos * 100) + '%';
  }

  function renderUpsells(cart) {
    if (!CFG.hideUpsellInCart || !els.upsellCards.length) return;
    var ids = cart.items.map(function (i) { return String(i.product_id); });
    els.upsellCards.forEach(function (card) {
      var pid = card.getAttribute('data-product-id');
      card.hidden = ids.indexOf(pid) !== -1;
    });
  }

  /* ---- Keep the theme header's cart status correct -------------------- */
  // We took over the cart, so the theme no longer refreshes its own header
  // count/price. Update them ourselves so nothing shows "undefined".
  function updateSiteCart(cart) {
    var count = cart.item_count;

    // Generic count bubbles + Pipeline's bracketed count span.
    var countEls = document.querySelectorAll(
      '.cart-count-bubble span, #cart-icon-bubble [data-cart-count], ' +
      '.site-header__cart-count span, .cart-link__bubble, [data-cart-count], [data-header-cart-count]'
    );
    countEls.forEach(function (el) {
      if (drawer.contains(el)) return; // never touch our own (N) in the drawer
      if (el.hasAttribute('data-header-cart-count')) {
        el.textContent = '(' + count + ')';
        el.setAttribute('data-header-cart-count', count);
      } else {
        el.textContent = count;
      }
    });

    // Pipeline header price (was rendering "undefined" once we took over).
    document.querySelectorAll('[data-header-cart-price]').forEach(function (el) {
      if (drawer.contains(el)) return;
      el.textContent = money(cart.total_price, cart.currency);
      el.setAttribute('data-header-cart-price', cart.total_price);
    });

    // Empty/full flag the theme uses for styling.
    document.querySelectorAll('[data-header-cart-full]').forEach(function (el) {
      el.setAttribute('data-header-cart-full', count > 0);
    });

    document.dispatchEvent(new CustomEvent('guillo:cart:updated', { detail: { count: count } }));
  }

  /* ---- Data actions --------------------------------------------------- */
  // quiet = true skips the dimmed loading state (used when we already have a
  // rendered cart on screen and are just syncing in the background).
  // /cart/add.js answers with the line it just made. Drop that into the cart
  // we already hold and draw it straight away, so the shopper sees their item
  // one round trip sooner; the totals stay veiled until the real cart arrives
  // (discounts are only known then).
  function showAdded(item) {
    if (!lastCart || !item || !item.key) return false;
    var c = JSON.parse(JSON.stringify(lastCart));
    var found = false;
    c.items = c.items.map(function (it) {
      if (it.key === item.key) { found = true; return item; }
      return it;
    });
    if (!found) c.items.unshift(item);
    c.item_count = c.items.reduce(function (n, it) { return n + (it.quantity || 0); }, 0);
    c.total_price = c.items.reduce(function (n, it) { return n + (it.final_line_price || 0); }, 0);
    c.items_subtotal_price = c.total_price;
    c.original_total_price = c.items.reduce(function (n, it) { return n + (it.original_line_price || 0); }, 0);
    drawer.classList.add('is-settling');
    render(c);
    drawer.classList.remove('is-loading');
    return true;
  }
  function settle() {
    return refresh(true).then(function (cart) { drawer.classList.remove('is-settling'); return cart; });
  }

  function refresh(quiet) {
    if (!quiet) drawer.classList.add('is-loading');
    return getCart().then(function (cart) {
      render(cart);
      drawer.classList.remove('is-loading');
      return cart;
    }).catch(function () {
      drawer.classList.remove('is-loading');
    });
  }

  // Optimistic: the number (or the row) changes on the tap itself. Rapid taps
  // are folded into one request per line, and only the newest reply is drawn.
  var qtyTimers = {};
  var qtySeq = 0;
  function changeQty(key, qty) {
    var lines = els.items.querySelectorAll('.gcart-item');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].getAttribute('data-key') !== key) continue;
      if (qty <= 0) {
        lines[i].classList.add('is-leaving');
      } else {
        lines[i].querySelector('.gcart-qty__value').textContent = qty;
      }
    }
    window.clearTimeout(qtyTimers[key]);
    qtyTimers[key] = window.setTimeout(function () {
      var mine = ++qtySeq;
      postJSON('/cart/change.js', { id: key, quantity: Math.max(0, qty) })
        .then(function (cart) { if (mine === qtySeq) { lastItemsSig = null; render(cart); } })
        .catch(function () { lastItemsSig = null; refresh(true); });
    }, qty <= 0 ? 0 : 160);
  }

  function quickAdd(variantId, btn) {
    if (btn) btn.classList.add('is-loading');
    return postJSON('/cart/add.js', { items: [{ id: variantId, quantity: 1 }] })
      .then(function () {
        if (btn) btn.classList.remove('is-loading');
        openDrawer(); // openDrawer triggers a single background refresh
      })
      .catch(function () { if (btn) btn.classList.remove('is-loading'); });
  }

  /* ---- Event delegation inside the drawer ----------------------------- */
  drawer.addEventListener('click', function (e) {
    var t = e.target;

    if (t.closest('[data-gcart-close]')) { closeDrawer(); return; }

    // Checkout is a real link; only block it when the cart is empty.
    var checkout = t.closest('[data-gcart-checkout]');
    if (checkout) {
      if (checkout.classList.contains('is-disabled')) e.preventDefault();
      return; // otherwise let the anchor navigate natively
    }

    var quick = t.closest('[data-gcart-quickadd]');
    if (quick) {
      e.preventDefault();
      // If the card has a size/variant selector, add the chosen variant
      var card = quick.closest('[data-gcart-upsell-card]');
      var select = card ? card.querySelector('[data-gcart-variant-select]') : null;
      var variantId = (select && select.value) ? select.value : quick.getAttribute('data-variant-id');
      quickAdd(variantId, quick);
      return;
    }

    var line = t.closest('.gcart-item');
    if (!line) return;
    var key = line.getAttribute('data-key');
    var qty = parseInt(line.querySelector('.gcart-qty__value').textContent, 10) || 1;

    if (t.closest('[data-gcart-plus]'))   { changeQty(key, qty + 1); }
    else if (t.closest('[data-gcart-minus]')) { changeQty(key, qty - 1); } // qty 0 removes
    else if (t.closest('[data-gcart-remove]')) { changeQty(key, 0); }
  });

  overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
  });

  /* ---- Hook the site's cart icon(s) ----------------------------------- */
  // Includes Pipeline's cart link (.navlink--cart / data-drawer-toggle="drawer-cart").
  var TRIGGER_SELECTOR = window.GUILLO_CART_TRIGGER || [
    'a[href="/cart"]', 'a[href$="/cart"]', 'a[href*="/cart?"]',
    '[data-drawer-toggle="drawer-cart"]', '[data-cart-drawer-toggle]',
    '.navlink--cart', '#cart-icon-bubble', '.cart-link',
    '.site-header__cart', '.header__icon--cart'
  ].join(',');

  // Stop the theme's built-in cart drawer/pop from opening: remove the toggle
  // attribute Pipeline keys off, so only our drawer responds to the cart button.
  function neutralizeThemeCart() {
    document.querySelectorAll('[data-drawer-toggle="drawer-cart"]').forEach(function (el) {
      el.removeAttribute('data-drawer-toggle');
    });
  }
  neutralizeThemeCart();
  document.addEventListener('shopify:section:load', neutralizeThemeCart); // re-apply after editor reloads

  // Bind on window (capture) so we run before the theme's document-level handlers.
  window.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest(TRIGGER_SELECTOR);
    if (!trigger) return;
    if (drawer.contains(trigger)) return; // ignore clicks inside our drawer
    e.preventDefault();
    e.stopPropagation();
    openDrawer();
  }, true);

  /* ---- Take over product add-to-cart forms ---------------------------- */
  if (CFG.openOnAdd) {
    window.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form.matches || !form.matches('form[action*="/cart/add"]')) return;
      e.preventDefault();
      e.stopImmediatePropagation(); // prevent the theme's own AJAX/redirect

      var btn = form.querySelector('[type="submit"], button:not([type])');
      if (btn) btn.classList.add('is-loading');
      // Do not wait for the network to start moving: open now, fill in after.
      if (!CFG.quietAdd) { openDrawer(true); drawer.classList.add('is-loading'); }

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (r) { return r.json(); })
        .then(function (item) {
          if (btn) btn.classList.remove('is-loading');
          var failed = !item || !item.key; // /cart/add.js errors have no line key
          if (CFG.quietAdd && !failed) {
            refresh(true).then(function () {
              confirmQuiet({ img: item.image, fromEl: btn });
              btnAdded(btn);
            });
          } else if (!failed && showAdded(item)) {
            settle();
          } else {
            refresh(false);
          }
        })
        .catch(function () { if (btn) btn.classList.remove('is-loading'); refresh(false); });
    }, true);
  }

  /* ---- Options sheet for Complete the look ------------------------------
     A card carries its family as JSON (colours = the Guillo Product Group's
     products, each with its own sizes). Tap the card, pick, add. */
  var sheet = drawer.querySelector('[data-gcart-sheet]');
  var sh = sheet ? {
    panel:   sheet.querySelector('.gcart-sheet__panel'),
    title:   sheet.querySelector('[data-gcart-sheet-title]'),
    img:     sheet.querySelector('[data-gcart-sheet-img]'),
    price:   sheet.querySelector('[data-gcart-sheet-price]'),
    cWrap:   sheet.querySelector('[data-gcart-sheet-colours-wrap]'),
    colours: sheet.querySelector('[data-gcart-sheet-colours]'),
    sizeLbl: sheet.querySelector('[data-gcart-sheet-size-label]'),
    sizes:   sheet.querySelector('[data-gcart-sheet-sizes]'),
    add:     sheet.querySelector('[data-gcart-sheet-add]')
  } : null;
  var shFamily = null, shColour = 0, shVariant = null, shReturnTo = null;

  function optButton(label, on, disabled, attr, val) {
    return '<button type="button" class="gcart-sheet__opt' + (on ? ' is-on' : '') + '"' +
      ' role="radio" aria-checked="' + (on ? 'true' : 'false') + '"' +
      (disabled ? ' disabled' : '') + ' ' + attr + '="' + val + '">' + escapeHtml(label) + '</button>';
  }

  function renderSheet() {
    if (!sh || !shFamily) return;
    var colour = shFamily.colours[shColour] || shFamily.colours[0];
    sh.title.textContent = shFamily.title + (shFamily.colours.length > 1 ? ' in ' + colour.name : '');
    if (colour.image) { sh.img.src = colour.image; sh.img.alt = shFamily.title; } else { sh.img.removeAttribute('src'); }
    sh.cWrap.hidden = shFamily.colours.length < 2;
    sh.colours.innerHTML = shFamily.colours.map(function (c, i) {
      return optButton(c.name, i === shColour, !c.available, 'data-gcart-sheet-colour', i);
    }).join('');
    // Default size: keep the one already chosen if this colour has it, else the first in stock.
    var variants = colour.variants || [];
    var chosen = null;
    variants.forEach(function (v) { if (shVariant && v.title === shVariant.title && v.available) chosen = v; });
    if (!chosen) variants.some(function (v) { if (v.available) { chosen = v; return true; } return false; });
    shVariant = chosen;
    sh.sizeLbl.textContent = shFamily.sizeLabel || 'Size';
    sh.sizes.innerHTML = variants.map(function (v) {
      return optButton(v.title, chosen && v.id === chosen.id, !v.available, 'data-gcart-sheet-size', v.id);
    }).join('');
    sh.price.textContent = chosen ? chosen.price : (variants[0] ? variants[0].price : '');
    sh.add.disabled = !chosen;
    sh.add.textContent = chosen ? 'Add to bag' : 'Sold out';
  }

  function openSheet(card) {
    if (!sh) return;
    var data = card.querySelector('[data-gcart-family]');
    try { shFamily = JSON.parse(data.textContent); } catch (e) { shFamily = null; }
    if (!shFamily || !shFamily.colours || !shFamily.colours.length) return;
    shColour = 0; shVariant = null;
    shFamily.colours.some(function (c, i) { if (c.available) { shColour = i; return true; } return false; });
    renderSheet();
    var scope = drawer.getRootNode ? drawer.getRootNode() : document;
    shReturnTo = (scope && scope.activeElement) || document.activeElement;
    sheet.hidden = false;
    void sheet.offsetWidth;
    sheet.classList.add('is-open');
    sh.panel.focus();
  }

  function closeSheet() {
    if (!sh || sheet.hidden) return;
    sheet.classList.remove('is-open');
    window.setTimeout(function () { sheet.hidden = true; }, 320);
    if (shReturnTo && shReturnTo.focus) shReturnTo.focus();
  }

  drawer.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var pick = t.closest('[data-gcart-pick]');
    if (pick) { e.preventDefault(); openSheet(pick.closest('[data-gcart-upsell-card]')); return; }
    if (t.closest('[data-gcart-sheet-close]')) { e.preventDefault(); closeSheet(); return; }
    var cBtn = t.closest('[data-gcart-sheet-colour]');
    if (cBtn) { shColour = parseInt(cBtn.getAttribute('data-gcart-sheet-colour'), 10) || 0; renderSheet(); return; }
    var sBtn = t.closest('[data-gcart-sheet-size]');
    if (sBtn) {
      var id = parseInt(sBtn.getAttribute('data-gcart-sheet-size'), 10);
      var colour = shFamily.colours[shColour];
      (colour.variants || []).forEach(function (v) { if (v.id === id) shVariant = v; });
      renderSheet(); return;
    }
    if (t.closest('[data-gcart-sheet-add]') && shVariant) {
      var addId = shVariant.id;
      closeSheet();
      drawer.classList.add('is-loading');
      postJSON('/cart/add.js', { items: [{ id: addId, quantity: 1 }] })
        .then(function (res) {
          var item = res && res.items && res.items[0];
          if (showAdded(item)) return settle();
          return refresh(false);
        })
        .catch(function () { refresh(false); });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheet && !sheet.hidden) { e.stopPropagation(); closeSheet(); }
  }, true);

  /* ---- Public API (optional manual control) --------------------------- */
  window.GuilloCart = {
    open: openDrawer,
    close: closeDrawer,
    refresh: refresh,
    // Post-add confirmation honouring the quiet_add setting. Callers that
    // used to open the drawer after their own add should call this instead.
    notifyAdded: function (opts) {
      if (CFG.quietAdd) { confirmQuiet(opts || {}); } else { openDrawer(); }
    },
    add: function (variantId, qty) {
      return postJSON('/cart/add.js', { items: [{ id: variantId, quantity: qty || 1 }] })
        .then(function (res) {
          return refresh(true).then(function () {
            window.GuilloCart.notifyAdded({});
            return res;
          });
        });
    }
  };

  /* ---- The bag is always the drawer ------------------------------------
     Two ways a shopper used to land on the theme's plain /cart page: a tap on
     the bag before this script had loaded (layout/theme.liquid now holds that
     tap and flags it here), or a direct visit to /cart. Both open the drawer
     instead; closing it on /cart goes back to where they came from. */
  var onCartPage = /\/cart\/?$/.test(window.location.pathname);
  if (window.__guilloCartPending || onCartPage) {
    window.__guilloCartPending = false;
    openDrawer();
  }
  if (onCartPage) {
    drawer.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'transform' || drawer.classList.contains('is-open')) return;
      if (window.history.length > 1) window.history.back(); else window.location.href = '/';
    });
  }

  /* ---- Small escaper -------------------------------------------------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Prime on load: fully render the (hidden) drawer so the first open is
  // instant and the header count is correct. Runs once, off the critical path.
  function prime() {
    getCart().then(function (cart) { render(cart); }).catch(function () {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prime);
  } else {
    prime();
  }
})();
