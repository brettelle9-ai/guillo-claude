/* ==========================================================================
   GUILLO FIT — size recommendation modal
   --------------------------------------------------------------------------
   Two steps, then a recommended size with fit notes and add to bag.

   The recommendation is arithmetic, not a model: body estimate from height
   and weight, adjusted for build, thigh and preferred fit, matched against
   the product's real size chart. Every number it shows comes either from the
   shopper's answers or from the chart in the size guide.

   The modal lives in a shadow root. Horizon styles the page with body:has()
   rules, so adding or removing anything under <body> restyles the whole
   document (~150ms). This modal redraws on every drag of the height slider,
   which would be unusable. Inside a shadow tree :has() cannot see it, so a
   redraw costs a few milliseconds. Same approach as the cart drawer.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__guilloFitBooted) return;
  window.__guilloFitBooted = true;

  var dataEl = document.querySelector('[data-gff-data]');
  var root = document.querySelector('[data-gff-root]');
  if (!dataEl || !root) return;

  var P;
  try { P = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!P || !P.sizes || P.sizes.length < 3) return;

  var BOTTOM = P.kind === 'bottom';
  var RANGES = { h: [152, 205], w: [50, 135] };
  var STORE_KEY = 'guillo-fit-shirts';

  // The sizes a man can say he wears. Guillo cuts even waists, but most men
  // are a 29, 31 or 33 in their own heads, so those are offered too and the
  // between-sizes rule decides what to do with them.
  var NUM = P.sizes.map(function (s) { return parseFloat(String(s).replace(/[^0-9.]/g, '')); });
  var NUMERIC = NUM.every(function (n) { return !isNaN(n); });
  var USUAL = [];
  P.sizes.forEach(function (label, i) {
    USUAL.push({ label: label, value: NUM[i], exact: i });
    if (NUMERIC && i < P.sizes.length - 1 && NUM[i + 1] - NUM[i] > 1) {
      var mid = (NUM[i] + NUM[i + 1]) / 2;
      var midLabel = String(mid).replace(/\.0$/, '') + (String(label).replace(/[0-9.]/g, '') || '');
      USUAL.push({ label: midLabel, value: mid, exact: null, low: i, high: i + 1 });
    }
  });

  // Fuller glutes take one size up; the rest of the answer shapes the notes.
  // "Glutes" because that is what the men who buy these call them.
  var GLUTES = [
    { id: 'flat', label: 'Flatter', desc: 'Straight through the back' },
    { id: 'average', label: 'Average', desc: 'Most men' },
    { id: 'full', label: 'Fuller', desc: 'Squat, run, or built that way' }
  ];
  // Will's rule: true to size. Wanting them tighter or looser moves one whole
  // size, it does not nudge a centimetre figure.
  var FITS = [
    { id: 'close', label: 'Tighter', desc: 'One size down' },
    { id: 'cut', label: 'As cut', desc: 'Your usual size' },
    { id: 'easy', label: 'Looser', desc: 'One size up' }
  ];

  var S = {
    step: 1, imperial: false, h: 180, w: 80,
    // known = a measurement the shopper has actually taken. When it is set the
    // body estimate is skipped entirely, which is the single biggest gain in
    // accuracy available here: height and weight only ever approximate a waist.
    // One question does the sizing: the size he wears now and how it fits.
    // 'estimate' (height and weight) is the fallback for the man who does not
    // know, reached from a quiet link, never offered as a choice up front.
    route: 'usual', usual: null, heightBand: null,
    build: null, glutes: null, fit: null, focus: null,
    readIdx: 0, chosen: null, open: false
  };

  /* ---- Answers are remembered, so a second product opens on the result -- */
  try {
    var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved.h === 'number') {
      S.h = saved.h; S.w = saved.w; S.imperial = !!saved.imperial;
      S.fit = saved.fit || null;
      if (saved.route) S.route = saved.route;
      if (typeof saved.usual === 'number') S.usual = saved.usual;
      if (saved.heightBand) S.heightBand = saved.heightBand;
      if (saved.glutes) S.glutes = saved.glutes;
    }
  } catch (e) {}

  function remember() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        h: S.h, w: S.w, imperial: S.imperial,
        route: S.route, usual: S.usual, heightBand: S.heightBand,
        build: S.build, glutes: S.glutes, fit: S.fit
      }));
    } catch (e) {}
  }

  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  // Sizes are written inconsistently in the product options (28", 30'', 32").
  var norm = function (s) { return String(s == null ? '' : s).replace(/[″′"'\s]/g, '').toLowerCase(); };
  var pickLabel = function (list, id) { var o = list.filter(function (x) { return x.id === id; })[0]; return o ? o.label : ''; };

  function len(cm) { return S.imperial ? (cm / 2.54).toFixed(1) + 'in' : Math.round(cm) + 'cm'; }
  function fmtH(h) {
    if (!S.imperial) return [String(h), 'cm'];
    var ft = Math.floor(h / 2.54 / 12), inch = Math.round(h / 2.54 - ft * 12);
    if (inch === 12) { ft += 1; inch = 0; }
    return [ft + '′' + inch + '″', ''];
  }
  function fmtW(w) { return S.imperial ? [String(Math.round(w * 2.2046)), 'lb'] : [String(w), 'kg']; }

  /* ---- The recommendation ----------------------------------------------
     True to size is the rule: a 30 wears a 30. Wanting them tighter takes one
     size down, where the stretch waist copes and the leg sits closer; looser
     takes one size up for more room through the leg. The seat and the height
     never move the size, they decide what we tell him about the fit.       */
  function baseIndex() {
    if (S.route === 'estimate') {
      // No size given, so infer one from the body, then the same rules apply.
      var bmi = S.w / Math.pow(S.h / 100, 2);
      var est = BOTTOM ? 36 + 1.9 * bmi : 52 + 1.9 * bmi + 0.1 * (S.h - 178);
      for (var i = 0; i < P.chart.length; i++) { if (P.chart[i] >= est - 1.5) return i; }
      return P.chart.length - 1;
    }
    var u = USUAL[S.usual == null ? 0 : S.usual];
    return u.exact != null ? u.exact : u.low;
  }

  // Between two of our sizes: Will's rule is to take the smaller one. The
  // leg is more tapered and, on this chart, the inside leg is shorter too.
  // Only a man who wants them looser goes up.
  function usualEntry() { return USUAL[S.usual == null ? 0 : S.usual]; }
  function isBetween() { var u = usualEntry(); return u.exact == null; }

  function heightBand() {
    if (S.route !== 'estimate' && S.heightBand) return S.heightBand;
    return S.h > 186 ? 'tall' : S.h < 172 ? 'short' : 'average';
  }

  function compute() {
    var last = P.chart.length - 1;
    var between = S.route !== 'estimate' && isBetween();
    var base = baseIndex(); // for a man between sizes this is already the smaller one
    // Tighter: one down. Between sizes the smaller size IS the down step, so
    // tighter stays there rather than dropping two. Tighter also wins over
    // thicker legs: Will's words are that the stretch waist takes it and the
    // legs sit close. Otherwise thicker legs take one up.
    var pref = S.fit === 'close' ? (between ? 0 : -1) : S.fit === 'easy' ? 1 : 0;
    var legs = (BOTTOM && S.glutes === 'full' && S.fit !== 'close') ? 1 : 0;
    var move = pref + legs;
    var idx = clamp(base + move, 0, last);

    // A confident answer, because this is how men actually buy: their size,
    // one down if they like them tight, one up for thicker legs. A step off
    // the plain rule costs a little; the range running out costs more.
    var conf = 96;
    if (between) conf -= 2;
    if (pref !== 0) conf -= 3;
    if (idx !== base + move) conf = 84;

    // The other pattern is offered where it would suit him better, as a
    // suggestion rather than a penalty.
    var cross = null;
    if (BOTTOM) {
      if (P.thighCut === 'close' && S.glutes === 'full') { cross = P.cross || null; }
      if (P.thighCut === 'room' && S.glutes === 'flat') { cross = P.cross || null; }
    }
    conf = clamp(conf, 70, 96);

    var alt = null;
    if (idx < last) alt = { idx: idx + 1, why: 'up' };
    else if (idx > 0) alt = { idx: idx - 1, why: 'down' };

    return { idx: idx, base: base, move: move, pref: pref, legs: legs, conf: conf, alt: alt, cross: cross, between: between };
  }

  function glutesRow(r) {
    var g = S.glutes || 'average';
    var close = {
      flat: ['Clean and close. Nothing spare.', '46%'],
      average: ['Sits close, as cut.', '50%'],
      full: [r.legs ? 'Room where you need it, tapered where you do not.' : 'Sits close. Shows the shape.', r.legs ? '54%' : '32%']
    };
    var room = {
      flat: ['Easy through the back.', '68%'],
      average: ['Room, never baggy.', '58%'],
      full: ['Cut for you.', '50%']
    };
    var pair = (P.thighCut === 'room' ? room : close)[g];
    return { label: 'Glutes', spec: P.thighCut === 'room' ? 'Fuller cut' : 'Close cut', note: pair[0], pos: pair[1], a: 'Close', b: 'Right', c: 'Easy' };
  }

  // Will's length rule, in his words: tall and they come up above the ankle,
  // average and they sit on it, shorter and they sit just below.
  function lengthRow(i) {
    var band = heightBand();
    if (!P.leg) {
      return { label: 'Length', spec: 'Above the knee',
        note: band === 'tall' ? 'Sits a touch higher. Sharp.' : band === 'short' ? 'Just above the knee.' : 'A hand above the knee.',
        pos: band === 'tall' ? '30%' : band === 'short' ? '68%' : '50%', a: 'Short', b: 'Right', c: 'Long' };
    }
    var spec = (P.inside && P.inside[i] != null) ? 'Inside leg ' + len(P.inside[i]) : 'Full length';
    return { label: 'Length', spec: spec,
      note: P.noConfidence ? 'Compare this inside-leg measurement with a pair you already like. The finish depends on your leg length and where you wear the waist.' : band === 'tall' ? 'Finishes above the ankle. A sharp, modern break.'
        : band === 'short' ? 'Finishes on the ankle. Clean, no bunching.'
        : 'Finishes just above the ankle. Clean, no bunching.',
      pos: band === 'tall' ? '26%' : band === 'short' ? '56%' : '42%', a: 'Short', b: 'Right', c: 'Long' };
  }

  function rowsFor(r, i) {
    if(!BOTTOM)return [{label:'Chest',spec:len(P.chart[i]),note:'Upper chest measurement for this size. Compare with the full size guide before choosing.',pos:r.move===0?'50%':r.move<0?'28%':'72%',a:'Close',b:'Fitted',c:'Easy'},{label:'Fit',spec:S.fit==='close'?'Closer fit':S.fit==='easy'?'More room':'As cut',note:'A slim body with room to move. Your preferred fit adjusts the suggestion from your usual size.',pos:'50%',a:'Close',b:'Fitted',c:'Easy'}];
    var yours = S.route === 'estimate' ? '' : ' \u00b7 your ' + usualEntry().label;
    var waistNote;
    if (r.legs && r.pref === 0) waistNote = 'A little more ease at the waist. Room through the back, no pull at the pocket.';
    else if (r.move < 0 || (r.between && r.move === 0)) waistNote = 'A clean, fitted waist. Stretch built in, so it moves with you.';
    else if (r.move > 0) waistNote = 'A little more ease at the waist.';
    else waistNote = 'Sits right at the waist. No belt needed.';
    if (P.noConfidence) waistNote = 'Suggested from your usual waist and preferred fit. Compare the measurement before choosing.';
    var rows = [
      { label: 'Waist', spec: len(P.chart[i]) + yours,
        note: waistNote,
        pos: r.between ? (r.move > 0 ? '66%' : '36%') : r.move === 0 ? '50%' : r.move < 0 ? '26%' : '74%', a: 'Close', b: 'Right', c: 'Easy' }
    ];
    if (BOTTOM) rows.push(glutesRow(r));
    rows.push(lengthRow(i));
    return rows;
  }

  function noteFor(r, label) {
    if(!BOTTOM)return 'Suggested from your usual shirt size and preferred fit. Check the chest measurements in the size guide to confirm.';
    if (P.noConfidence) return 'Suggested size: ' + label + '. Based on your answers about your usual size, build and preferred fit. Check the measurements below before choosing.';
    var s = 'Take the ' + label + '.';
    if (r.between) {
      var u = usualEntry();
      s = 'You sit between our ' + P.sizes[u.low] + ' and ' + P.sizes[u.high] + '. Take the ' + label + '.';
      if (r.legs && r.pref === 0) return s + ' Room where you need it, tapered where you do not.';
      if (r.move > 0) return s + ' A touch more ease through the leg.';
      return s + ' Cleaner through the leg, sharper at the ankle.';
    }
    if (r.legs && r.pref === 0) s += ' Room where you need it, tapered where you do not.';
    else if (r.move < 0) s += ' A sharper line through the leg. The stretch waist does the rest.';
    else if (r.move > 0) s += ' A touch more ease through the leg.';
    else s += ' Your size, cut the way you would want it.';
    return s;
  }

  // Step 2 asks about the seat (bottoms only) and how he likes them to sit.
  function groupOrder() {
    var o = [];
    if (BOTTOM) o.push('glutes');
    o.push('fit');
    return o;
  }
  var step2Done = function () {
    return groupOrder().every(function (k) { return !!S[k]; });
  };
  // Step 1 is complete when we have a size to start from and a height band.
  // The estimate route always has both (its sliders always hold a value).
  var step1Done = function () {
    return S.route === 'estimate' || (S.usual != null && !!S.heightBand);
  };

  /* ---- Shadow root ------------------------------------------------------ */
  var host = document.createElement('div');
  host.id = 'GuilloFitHost';
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : null;
  if (!shadow) return;
  var cssHref = (dataEl.getAttribute('data-gff-css') || '');
  if (!cssHref) {
    var existing = document.querySelector('link[href*="guillo-fit-finder.css"]');
    cssHref = existing ? existing.href : '';
  }
  if (cssHref) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    shadow.appendChild(link);
  }
  shadow.appendChild(root);
  document.body.appendChild(host);

  var el = {
    panel: root.querySelector('[data-gff-panel]'),
    strip: root.querySelector('[data-gff-strip]'),
    body: root.querySelector('[data-gff-body]'),
    foot: root.querySelector('[data-gff-foot]'),
    back: root.querySelector('[data-gff-back]'),
    next: root.querySelector('[data-gff-next]'),
    liveSize: root.querySelector('[data-gff-live-size]'),
    liveHint: root.querySelector('[data-gff-live-hint]'),
    liveFill: root.querySelector('[data-gff-live-fill]'),
    livePct: root.querySelector('[data-gff-live-pct]')
  };

  /* ---- Views ------------------------------------------------------------ */
  function dialHTML(key, label, fmt) {
    var a = RANGES[key][0], b = RANGES[key][1], v = S[key];
    var pair = fmt(v), ticks = '';
    for (var n = a; n <= b; n++) {
      var major = n % 10 === 0, mid = n % 5 === 0;
      var h = major ? 22 : mid ? 14 : 8;
      var c = n <= v ? (major ? '#121212' : 'rgba(18,18,18,.55)') : (major ? 'rgba(18,18,18,.35)' : 'rgba(18,18,18,.18)');
      ticks += '<i class="gff__tick" style="height:' + h + 'px;background:' + c + '"></i>';
    }
    var pct = ((v - a) / (b - a) * 100);
    return '' +
      '<div class="gff__dial">' +
        '<div class="gff__dial-row">' +
          '<span class="gff__dial-label">' + esc(label) + '</span>' +
          '<span class="gff__dial-val">' + esc(pair[0]) + (pair[1] ? '<span class="gff__dial-unit">' + esc(pair[1]) + '</span>' : '') + '</span>' +
        '</div>' +
        '<div class="gff__dial-hit" data-gff-dial="' + key + '" role="slider" tabindex="0"' +
          ' aria-label="' + esc(label) + '" aria-valuemin="' + a + '" aria-valuemax="' + b + '"' +
          ' aria-valuenow="' + v + '" aria-valuetext="' + esc(pair.join('')) + '">' +
          '<div class="gff__ticks">' + ticks + '</div>' +
          '<div class="gff__track"><div class="gff__track-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="gff__knob" style="left:' + pct + '%"></div>' +
        '</div>' +
        '<div class="gff__dial-ends"><span>' + esc(fmt(a).join('')) + '</span><span>' + esc(fmt(b).join('')) + '</span></div>' +
      '</div>';
  }

  function step1HTML() {
    return '' +
      '<div class="gff__introrow">' +
        '<div class="gff__intro">' +
          '<span class="gff__stepno">01 / 02</span>' +
          '<h2>' + (S.route === 'usual' ? 'What size do you wear now?' : 'Height and weight.') + '</h2>' +
          '<p class="gff__sub">' + (S.route === 'usual'
            ? 'In fitted shirts. Any brand.'
            : 'Less exact than your size, so use it only if you must.') + '</p>' +
        '</div>' +
        (S.route === 'estimate' ? '<div class="gff__units">' +
          '<button type="button" class="gff__unit' + (S.imperial ? '' : ' is-on') + '" data-gff-unit="0">cm · kg</button>' +
          '<button type="button" class="gff__unit' + (S.imperial ? ' is-on' : '') + '" data-gff-unit="1">ft · lb</button>' +
        '</div>' : '') +
      '</div>' +
      routeBodyHTML() +
      (S.route === 'estimate' ? '<button type="button" class="gff__switch" data-gff-mode="usual">Back to picking my size</button>' : '');
  }

  // The part of step 1 that changes with the route. Height is asked in every
  // route, below this, because it is what the length advice is built on.
  function routeBodyHTML() {
    if (S.route === 'usual') {
      // Nothing is pre-selected. Lighting a default size made it look chosen
      // while the state still said nothing was, so Continue stayed locked and
      // the shopper could not see why.
      return '<div class="gff__sizes">' + USUAL.map(function (u, i) {
          return '<button type="button" class="gff__size-btn' + (S.usual === i ? ' is-on' : '') + (u.exact == null ? ' gff__size-btn--between' : '') + '" data-gff-usual="' + i + '">' + esc(u.label) + '</button>';
        }).join('') + '</div>' +
        '<p class="gff__askfit">And how tall are you?</p>' +
        '<div class="gff__seg">' + [
          ['short', 'Under 5\u20329\u2033', 'Below 172cm'],
          ['average', '5\u20329\u2033 to 6\u20321\u2033', '172 to 186cm'],
          ['tall', 'Over 6\u20321\u2033', 'Above 186cm']
        ].map(function (o) {
          return '<button type="button" class="gff__seg-btn' + (S.heightBand === o[0] ? ' is-on' : '') + '" data-gff-height="' + o[0] + '">' +
            '<span class="gff__seg-l">' + o[1] + '</span><span class="gff__seg-d">' + o[2] + '</span></button>';
        }).join('') + '</div>' +
        '<button type="button" class="gff__switch" data-gff-mode="estimate">Not sure of your size?</button>';
    }
    return dialHTML('h', 'Height', fmtH) + dialHTML('w', 'Weight', fmtW);
  }

  function groupHTML(key, num, title, prompt, inner, val) {
    var order = groupOrder();
    var firstUnanswered = null;
    for (var i = 0; i < order.length; i++) { if (!S[order[i]]) { firstUnanswered = order[i]; break; } }
    var active = S.focus || firstUnanswered;
    var isOpen = key === active;
    var done = !!S[key] && !isOpen;
    var locked = !S[key] && !isOpen;
    var cls = 'gff__group' + (isOpen ? ' is-open' : '') + (done ? ' is-done' : '') + (locked ? ' is-locked' : '');
    return '' +
      '<div class="' + cls + '">' +
        '<div class="gff__group-head">' +
          '<span class="gff__num">' + (done
            ? '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : num) + '</span>' +
          '<span class="gff__group-title">' + esc(title) + '</span>' +
          (done ? '<span class="gff__group-sum"><span class="gff__group-val">' + esc(val) + '</span>' +
            '<button type="button" class="gff__change" data-gff-change="' + key + '">Change</button></span>' : '') +
        '</div>' +
        (isOpen ? '<div class="gff__group-body"><p class="gff__prompt">' + esc(prompt) + '</p>' + inner + '</div>' : '') +
      '</div>';
  }

  function segHTML(name, list) {
    return '<div class="gff__seg">' + list.map(function (o) {
      return '<button type="button" class="gff__seg-btn' + (S[name] === o.id ? ' is-on' : '') + '" data-gff-set="' + name + '" data-gff-val="' + o.id + '">' +
        '<span class="gff__seg-l">' + esc(o.label) + '</span><span class="gff__seg-d">' + esc(o.desc) + '</span></button>';
    }).join('') + '</div>';
  }

  function step2HTML() {
    var out = '' +
      '<div class="gff__intro">' +
        '<span class="gff__stepno">02 / 02</span>' +
        '<h2>How do you like your shirt to fit?</h2>' +
        '<p class="gff__sub">Start from your usual shirt size, then choose how closely you like it cut.</p>' +
      '</div><div>';
    var n = 1;
    var order = groupOrder();
    if (order.indexOf('glutes') > -1) out += groupHTML('glutes', n++, 'Your glutes', 'And through the glutes?', segHTML('glutes', GLUTES), pickLabel(GLUTES, S.glutes));
    out += groupHTML('fit', n++, 'Your preferred fit', 'How do you like your shirt to fit?', segHTML('fit', FITS), pickLabel(FITS, S.fit));
    return out + '</div>';
  }

  function readingHTML(r) {
    var lines = [
      ['Size', S.route === 'estimate' ? 'Estimated ' + P.sizes[r.base]
        : r.between ? 'Your ' + usualEntry().label + ' \u00b7 between sizes'
        : 'Your ' + usualEntry().label + (r.move ? ' \u00b7 ' + (r.move < 0 ? 'one down' : 'one up') : ' \u00b7 true to size')],
      ['Glutes', (pickLabel(GLUTES, S.glutes) || 'Average') + ' \u00b7 ' + (P.thighCut === 'room' ? 'fuller cut' : 'close cut')],
      ['Length', P.leg && P.inside && P.inside[r.idx] != null ? len(P.inside[r.idx]) + ' inside leg' : 'Above the knee'],
      ['Pattern', P.short + ' \u00b7 ' + P.sizes.length + ' sizes']
    ];
    if(!BOTTOM)lines=[['Size',P.sizes[r.idx]],['Chest',len(P.chart[r.idx])],['Fit',S.fit==='close'?'Closer':S.fit==='easy'?'More room':'As cut'],['Pattern',P.short]];
    return '' +
      '<div class="gff__reading">' +
        '<div class="gff__reading-top"><span class="gff__dot"></span><span class="gff__label">Checking the pattern</span></div>' +
        '<h2>Fitting you to the ' + esc(P.short) + ' pattern.</h2>' +
        '<div class="gff__scan"></div>' +
        '<div>' + lines.map(function (l, i) {
          return '<div class="gff__readrow' + (S.readIdx > i ? ' is-in' : '') + '"><span>' + esc(l[0]) + '</span><span>' + esc(l[1]) + '</span></div>';
        }).join('') + '</div>' +
      '</div>';
  }

  function rowHTML(row) {
    return '' +
      '<div class="gff__row">' +
        '<div class="gff__row-l">' +
          '<div class="gff__row-top"><span class="gff__row-label">' + esc(row.label) + '</span>' +
            '<span class="gff__row-spec">' + esc(row.spec) + '</span></div>' +
          '<p class="gff__row-note">' + esc(row.note) + '</p>' +
        '</div>' +
        '<div class="gff__row-r">' +
          '<div class="gff__scale"><span class="gff__scale-tick"></span><span class="gff__scale-dot" style="left:' + row.pos + '"></span></div>' +
          '<div class="gff__scale-labels"><span>' + esc(row.a) + '</span><span>' + esc(row.b) + '</span><span>' + esc(row.c) + '</span></div>' +
        '</div>' +
      '</div>';
  }

  function resultHTML(r) {
    var i = S.chosen == null ? r.idx : S.chosen;
    var onRec = i === r.idx;
    var label = P.sizes[i];
    var conf = onRec ? r.conf : Math.max(70, r.conf - 8);
    var match = P.noConfidence ? 'Based on your answers' : conf >= 88 ? 'Strong match' : conf >= 80 ? 'Good match' : 'Between sizes';
    var out = '' +
      '<div class="gff__res">' +
        '<div class="gff__res-head">' +
          '<span class="gff__label">' + (onRec ? 'Your fitting' : 'Alternative') + ' · ' + esc(P.name) + '</span>' +
          '<div class="gff__res-size-row">' +
            '<span class="gff__res-size">' + esc(label) + '</span>' +
            '<span class="gff__res-match">' +
              '<span class="gff__res-match-l">' + esc(match) + '</span>' +
              (P.noConfidence ? '' : '<span class="gff__res-pct">' + conf + '%</span><span class="gff__res-bar"><i style="width:' + conf + '%"></i></span>') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<p class="gff__res-note">' + esc(noteFor(r, label)) + '</p>' +
        '<div>' + rowsFor(r, i).map(rowHTML).join('') + '</div>';

    if (r.cross) {
      out += '<div class="gff__cross">' +
        '<div class="gff__cross-top">' +
          '<span class="gff__label">' + (r.cross.thighCut === 'room' ? 'More room through the back' : 'Cleaner through the back') + '</span>' +
          '<span class="gff__row-spec">' + esc(r.cross.price) + '</span>' +
        '</div>' +
        '<p class="gff__cross-title">' + esc(r.cross.name) + ' · ' + esc(label) + '</p>' +
        '<p class="gff__cross-note">' + (r.cross.thighCut === 'room'
          ? 'Same waist, same taper. More room through the seat and thigh.'
          : 'Same waist. Closer through the back, with nothing spare.') + '</p>' +
        '<a class="gff__cross-cta" href="' + esc(r.cross.url) + '?fit=' + encodeURIComponent(label) + '">Fit me in the ' + esc(r.cross.short.replace(' Chino', '')) + '</a>' +
      '</div>';
    }

    if (r.alt) {
      var altLabel = P.sizes[r.alt.idx];
      out += '<div class="gff__alt"><span>' + (onRec
        ? (r.alt.why === 'up' ? 'More room? The ' + esc(altLabel) + '.' : 'Closer? The ' + esc(altLabel) + '.')
        : 'Our first pick was the ' + esc(P.sizes[r.idx]) + '.') + '</span>' +
        '<button type="button" class="gff__alt-cta" data-gff-alt>' + (onRec ? 'Show the ' + esc(altLabel) : 'Back to ' + esc(P.sizes[r.idx])) + '</button></div>';
    }

    out += '<button type="button" class="gff__atc" data-gff-add="' + esc(label) + '">Add the ' + esc(label) + ' to bag · ' + esc(P.price) + '</button>' +
      '<p class="gff__reassure">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        (P.freeExchange ? 'Wrong size? Free exchanges within 44 days.' : 'Wrong size? 44 days to exchange.') + '</p>' +
      '<button type="button" class="gff__restart" data-gff-restart>Change my answers</button>' +
      '</div>';
    return out;
  }

  /* ---- Render ----------------------------------------------------------- */
  function render() {
    var r = compute();
    var num = typeof S.step === 'number' ? S.step : 0;
    var done = step2Done();

    // The estimate stays up while the pattern is being checked, then gives way
    // to the result, which carries its own confidence bar.
    el.strip.hidden = S.step === 'result';
    el.foot.hidden = num === 0;

    if (num > 0) {
      // The real number, always. Showing a deliberately deflated figure until
      // the end made a strong match look weak at the exact moment he was
      // deciding whether to trust it.
      var live = r.conf;
      var haveSize = S.route === 'estimate' || S.usual != null;
      el.liveSize.textContent = haveSize ? P.sizes[r.idx] : '\u2014';
      el.livePct.textContent = P.noConfidence ? '' : haveSize ? live + '%' : '\u2014';
      el.liveFill.style.width = haveSize ? live + '%' : '0%';
      el.liveHint.textContent = num === 1 ? 'From your size' : done ? 'Ready' : 'Your preferred fit';
      el.back.hidden = num < 2;
      el.next.textContent = num === 2 ? 'Find my size' : 'Continue';
      el.next.disabled = (num === 1 && !step1Done()) || (num === 2 && !done);
    }

    if (S.step === 1) el.body.innerHTML = step1HTML();
    else if (S.step === 2) el.body.innerHTML = step2HTML();
    else if (S.step === 'reading') el.body.innerHTML = readingHTML(r);
    else el.body.innerHTML = resultHTML(r);

    if (S.step === 'result' || S.step === 'reading') el.body.scrollTop = 0;
  }

  /* ---- Step machine ------------------------------------------------------ */
  var timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function finishReading() {
    if (S.step !== 'reading') return;
    clearTimers();
    S.step = 'result'; S.chosen = null; render();
  }

  function go(step) {
    clearTimers();
    if (step === 'reading' && P.noConfidence) {remember();S.step='result';S.chosen=null;render();return;}
    if (step === 'reading') {
      remember();
      S.step = 'reading'; S.readIdx = 0; render();
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) { finishReading(); return; }
      [1, 2, 3, 4].forEach(function (n) {
        timers.push(setTimeout(function () { S.readIdx = n; render(); }, 200 + n * 340));
      });
      timers.push(setTimeout(finishReading, 2000));
    } else { S.step = step; render(); }
  }

  // Browsers freeze timers in a background tab. A shopper who switches tabs
  // during the check must not come back to a screen that never finishes.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && S.step === 'reading') finishReading();
  });

  /* ---- Open / close ------------------------------------------------------ */
  var lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    S.open = true;
    root.hidden = false;
    // Straight to the result when the answers are already known.
    if (step1Done() && step2Done() && S.step === 1) S.step = 'result';
    render();
    window.requestAnimationFrame(function () {
      root.classList.add('is-open');
      if (el.panel) el.panel.focus();
    });
  }
  function close() {
    S.open = false;
    clearTimers();
    root.classList.remove('is-open');
    window.setTimeout(function () { if (!S.open) root.hidden = true; }, 340);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---- Sliders ----------------------------------------------------------- */
  var dragging = null;
  function setFromPointer(key, hit, clientX) {
    var rect = hit.getBoundingClientRect();
    var a = RANGES[key][0], b = RANGES[key][1];
    var v = Math.round(a + clamp((clientX - rect.left) / rect.width, 0, 1) * (b - a));
    if (v !== S[key]) { S[key] = v; render(); }
  }
  root.addEventListener('pointerdown', function (e) {
    var hit = e.target.closest && e.target.closest('[data-gff-dial]');
    if (!hit) return;
    dragging = hit.getAttribute('data-gff-dial');
    if (hit.setPointerCapture) { try { hit.setPointerCapture(e.pointerId); } catch (err) {} }
    setFromPointer(dragging, hit, e.clientX);
    e.preventDefault();
  });
  root.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var hit = root.querySelector('[data-gff-dial="' + dragging + '"]');
    if (hit) setFromPointer(dragging, hit, e.clientX);
  });
  root.addEventListener('pointerup', function () { dragging = null; });
  root.addEventListener('pointercancel', function () { dragging = null; });
  root.addEventListener('keydown', function (e) {
    var hit = e.target.closest && e.target.closest('[data-gff-dial]');
    if (!hit) return;
    var key = hit.getAttribute('data-gff-dial');
    var d = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    S[key] = clamp(S[key] + d * (e.shiftKey ? 5 : 1), RANGES[key][0], RANGES[key][1]);
    render();
  });

  /* ---- Add to bag -------------------------------------------------------- */
  function variantForSize(size) {
    var holder = document.querySelector('[data-variant-data]');
    if (!holder) return null;
    var list;
    try { list = JSON.parse(holder.textContent); } catch (e) { return null; }
    var want = norm(size);
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      var opts = v.options || [];
      for (var j = 0; j < opts.length; j++) {
        if (norm(opts[j]) === want) return v;
      }
    }
    return null;
  }

  function selectSizeOnPage(size) {
    var want = norm(size);
    var inputs = document.querySelectorAll('form[action*="/cart/add"] input[type="radio"]');
    for (var i = 0; i < inputs.length; i++) {
      if (norm(inputs[i].getAttribute('data-size') || inputs[i].value) === want && !inputs[i].disabled) { inputs[i].click(); return true; }
    }
    return false;
  }

  function showPickNote(size, match) {
    var hint = document.querySelector('[data-size-hint]');
    if (!hint) return;
    var note = document.querySelector('[data-gff-pick]');
    if (!note) {
      note = document.createElement('p');
      note.setAttribute('data-gff-pick', '');
      note.className = 'guillo-pdp__fit-pick';
      hint.parentNode.insertBefore(note, hint);
    }
    note.textContent = 'Your fitting · ' + size + ' · ' + match;
  }

  function addToBag(btn, size) {
    var v = variantForSize(size);
    var r = compute();
    var i = S.chosen == null ? r.idx : S.chosen;
    var conf = i === r.idx ? r.conf : Math.max(70, r.conf - 8);
    var match = P.noConfidence ? 'Based on your answers' : conf >= 88 ? 'Strong match' : conf >= 80 ? 'Good match' : 'Between sizes';

    selectSizeOnPage(size);
    showPickNote(size, match);

    if (!v || !v.available) {
      // Nothing to add: leave the size chosen on the page and step aside.
      close();
      return;
    }
    btn.classList.add('is-loading');
    var done = function () { btn.classList.remove('is-loading'); close(); };
    if (window.GuilloCart && window.GuilloCart.add) {
      window.GuilloCart.add(v.id, 1).then(done).catch(done);
    } else {
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: [{ id: v.id, quantity: 1 }] })
      }).then(done).catch(done);
    }
  }

  /* ---- Clicks ------------------------------------------------------------ */
  root.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;

    if (t.closest('[data-gff-close]')) { close(); return; }

    var unit = t.closest('[data-gff-unit]');
    if (unit) { S.imperial = unit.getAttribute('data-gff-unit') === '1'; render(); return; }

    var mode = t.closest('[data-gff-mode]');
    if (mode) {
      S.route = mode.getAttribute('data-gff-mode');
      S.focus = null;
      if (S.route !== 'estimate') S.build = null; // not asked, so never left stale
      render();
      return;
    }

    var usual = t.closest('[data-gff-usual]');
    if (usual) { S.usual = parseInt(usual.getAttribute('data-gff-usual'), 10); render(); return; }

    var hb = t.closest('[data-gff-height]');
    if (hb) { S.heightBand = hb.getAttribute('data-gff-height'); render(); return; }

    var set = t.closest('[data-gff-set]');
    if (set) {
      S[set.getAttribute('data-gff-set')] = set.getAttribute('data-gff-val');
      S.focus = null;
      render();
      return;
    }

    var change = t.closest('[data-gff-change]');
    if (change) { S.focus = change.getAttribute('data-gff-change'); render(); return; }

    if (t.closest('[data-gff-back]')) { if (typeof S.step === 'number' && S.step > 1) go(S.step - 1); return; }

    if (t.closest('[data-gff-next]')) {
      if (S.step === 1 && step1Done()) go(2);
      else if (S.step === 2 && step2Done()) go('reading');
      return;
    }

    if (t.closest('[data-gff-alt]')) {
      var r = compute();
      S.chosen = (S.chosen == null && r.alt) ? r.alt.idx : null;
      render();
      return;
    }

    if (t.closest('[data-gff-restart]')) { S.step = 1; S.focus = null; render(); return; }

    var add = t.closest('[data-gff-add]');
    if (add) { addToBag(add, add.getAttribute('data-gff-add')); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.open) { e.stopPropagation(); close(); }
  }, true);

  /* ---- Entry points ------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-gff-open]');
    if (!trigger) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  }, true);

  // Arriving from the other cut's result page with ?fit=32"
  try {
    var fit = new URLSearchParams(window.location.search).get('fit');
    if (fit) {
      selectSizeOnPage(fit);
      if (step1Done() && step2Done()) window.setTimeout(open, 400);
    }
  } catch (e) {}

  // The entry points ship hidden, so a product whose chart did not pass the
  // check never shows a button that leads nowhere. Reveal them now the finder
  // is running, and close the size guide first if it is what opened us.
  Array.prototype.forEach.call(document.querySelectorAll('[data-gff-link]'), function (b) { b.hidden = false; });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-gff-open]');
    if (!t) return;
    var guide = document.querySelector('[data-gfys-close]');
    if (guide && t.closest('.gfys-modal')) guide.click();
  }, true);

  window.GuilloFit = { open: open, close: close, finish: finishReading };
})();
