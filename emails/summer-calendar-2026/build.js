#!/usr/bin/env node
/*
 * Builds the email-safe "Eight dates, and one wardrobe" email from the
 * Claude Design source in ./source.
 *
 * Email clients (Gmail, Outlook) strip absolute positioning, transforms and
 * CSS grid, which the design relies on. So the art-directed paper sections are
 * rendered in Chromium at 2x and cut into linked image slices. The trust strip,
 * sign-off and legal footer stay live HTML.
 *
 *   node emails/summer-calendar-2026/build.js
 *   IMG_BASE=https://cdn.example.com/summer-calendar/ node .../build.js
 *
 * IMG_BASE (optional) makes image URLs absolute for sending platforms that
 * need hosted images. Without it, index.html references ./images/ relatively.
 *
 * Requires Playwright with Chromium (require('playwright')).
 * OFFLINE_NPM / OFFLINE_FONTS_CSS (optional) serve the CDN scripts and Google
 * Fonts from local copies on machines that can't reach unpkg.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'source');
const OUT_IMG = path.join(ROOT, 'images');
const THEME_ASSETS = path.join(ROOT, '..', '..', 'assets');
const DESIGN = 'Guillo Summer Calendar Email.dc.html';
const IMG_BASE = process.env.IMG_BASE || 'images/';
const SCALE = 2;
const W = 600;

const SHOP = 'https://guilloclothing.com';
const L = {
  newArrivals: `${SHOP}/collections/new-arrivals`,
  look01: `${SHOP}/products/the-signore-chino-latte`,
  look02: `${SHOP}/search?q=valenti`,
  look03: `${SHOP}/search?q=portofino`,
  look04: `${SHOP}/products/the-luxe-chino-black`,
  look05: `${SHOP}/search?q=siracusa`,
  look06: `${SHOP}/products/the-luxe-chino-stone`,
  look07: `${SHOP}/search?q=portofino`,
  look08: `${SHOP}/products/the-signore-chino-mocha`,
  shipping: `${SHOP}/pages/shipping`,
  returns: `${SHOP}/policies/refund-policy`,
  home: SHOP,
};

/*
 * Slice plan in CSS px of the 600px design. Rows are contiguous from the top
 * of the hero to the top of the footer. A row with two columns sits where two
 * polaroids are side by side, so each gets its own link. Cuts were chosen in
 * empty paper or where a crop only moves a few pixels of shadow between rows;
 * the reassembled image is pixel-identical either way.
 */
const ROWS = [
  { y: [0, 800], cols: [{ x: [0, 600], href: L.newArrivals, alt: 'Guillo. Eight dates, and one wardrobe. The Melbourne Cup to the February wedding. What to wear to each. Tap to shop.' }] },
  { y: [800, 1200], cols: [{ x: [0, 600], href: L.newArrivals, alt: 'What to wear to every date on the summer calendar. November 2026, with the Melbourne Cup circled on 3 November.' }] },
  { y: [1200, 1700], cols: [
    { x: [0, 314], href: L.look01, alt: 'Melbourne Cup, 3 November: The Milano and The Signore Chino in Latte. Tap to shop.' },
    { x: [314, 600], href: L.look02, alt: 'The work Christmas party, outdoors, late November: The Valenti and The Alassio Linen Pant. Tap to shop.' },
  ] },
  { y: [1700, 1980], cols: [{ x: [0, 600], href: L.newArrivals, alt: 'December 2026, with Christmas lunch on the 25th, Boxing Day at the cricket on the 26th and New Year\'s Eve on the 31st circled.' }] },
  { y: [1980, 2398], cols: [
    { x: [0, 283], href: L.look03, alt: 'Christmas lunch, in the heat, 25 December: The Portofino Polo in Black, The Alassio Linen Pant and The Bellagio Weekender. Tap to shop.' },
    { x: [283, 600], href: L.look04, alt: 'Boxing Day, at the cricket, 26 December: The Vulcano Long Sleeve and The Luxe Chino in Black. Tap to shop.' },
  ] },
  { y: [2398, 3165], cols: [{ x: [0, 600], href: L.look05, alt: 'New Year\'s Eve, 31 December: The Siracusa and The Luxe Chino in Sage. Tap to shop.' }] },
  { y: [3165, 3470], cols: [{ x: [0, 600], href: L.newArrivals, alt: 'January and February 2027, with the long weekend on 26 January and dinner for two on 14 February circled.' }] },
  { y: [3470, 3935], cols: [
    { x: [0, 316], href: L.look06, alt: 'The long weekend, 26 January: The Vulcano and The Luxe Chino in Stone. Tap to shop.' },
    { x: [316, 600], href: L.look07, alt: 'Dinner for two, 14 February: The Portofino Polo in Red and The Signore Chino in Navy. Tap to shop.' },
  ] },
  { y: [3935, 4744], cols: [{ x: [0, 600], href: L.look08, alt: 'The summer wedding, February: The Siracusa and The Signore Chino in Mocha. Tap to shop.' }] },
];
const FOOTER_SECTION = 'Footer';

function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function routeRequests(route) {
  const url = route.request().url();
  if (url.startsWith('http://127.0.0.1')) return route.continue();
  // Hero wordmark: use the theme's own white logo so the build doesn't depend on a CDN path.
  if (url.includes('guillo-wordmark-white')) return route.fulfill({ path: path.join(THEME_ASSETS, 'guillo-logo-white.png'), contentType: 'image/png' });
  const npm = process.env.OFFLINE_NPM;
  if (npm && url.startsWith('https://unpkg.com/')) {
    const m = url.match(/unpkg\.com\/(@?[^@]+)@([^/]+)\/(.*)$/);
    const dirName = `${m[1].replace('@', '').replace('/', '-')}-${m[2]}`;
    return route.fulfill({ path: path.join(npm, dirName, 'package', m[3]), contentType: 'application/javascript' });
  }
  const fontsCss = process.env.OFFLINE_FONTS_CSS;
  if (fontsCss && url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ path: fontsCss, contentType: 'text/css' });
  if (fontsCss && url.startsWith('https://fonts.gstatic.com/')) {
    const cached = path.join(path.dirname(fontsCss), url.replace(/[^a-z0-9.]/gi, '_'));
    if (!fs.existsSync(cached)) execFileSync('curl', ['-sSL', '-m', '60', '-o', cached, url]);
    return route.fulfill({ path: cached, contentType: 'font/woff2' });
  }
  return route.continue();
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function rowHtml(row, r) {
  const h = row.y[1] - row.y[0];
  const cells = row.cols.map((c, i) => {
    const w = c.x[1] - c.x[0];
    const pct = ((w / W) * 100).toFixed(4);
    return `<td width="${w}" valign="top" style="width:${pct}%;padding:0;font-size:0;line-height:0;"><a href="${c.href}" target="_blank" style="display:block;text-decoration:none;"><img src="${IMG_BASE}${c.file}" width="${w}" height="${h}" alt="${esc(c.alt)}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;outline:none;color:#3A3833;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;background-color:${r === 0 ? '#3A3631' : '#E7E2D8'};"></a></td>`;
  }).join('\n');
  return `<tr><td bgcolor="#E7E2D8" style="padding:0;font-size:0;line-height:0;background-color:#E7E2D8;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;table-layout:fixed;"><tr>\n${cells}\n</tr></table></td></tr>`;
}

function emailHtml(footerBg) {
  const trust = [
    [L.shipping, 'SAME-DAY DISPATCH<br>BEFORE 3PM AEST', ''],
    [L.returns, '44-DAY RETURNS<br>AND EXCHANGES', 'border-left:1px solid #BDB5A7;border-right:1px solid #BDB5A7;'],
    [L.shipping, 'DUTIES AND<br>TAXES INCLUDED', ''],
  ].map(([href, label, border]) => `<td class="trust" width="184" align="center" valign="middle" style="width:33.333%;padding:20px 6px;${border}"><a href="${href}" target="_blank" style="font-family:Jost,Helvetica,Arial,sans-serif;font-size:9px;line-height:16px;font-weight:500;letter-spacing:1.8px;color:#2A2926;text-decoration:none;">${label}</a></td>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Eight dates, and one wardrobe</title>
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text&family=Jost:wght@400;500&display=swap" rel="stylesheet"><!--<![endif]-->
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>table,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}td,a,span{font-family:Helvetica,Arial,sans-serif !important}</style><![endif]-->
<style>
body{margin:0 !important;padding:0 !important;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
img{-ms-interpolation-mode:bicubic;}
a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}
u + #body a{color:inherit;text-decoration:none;}
@media (max-width:480px){
  .trust{padding:16px 3px !important;}
  .trust a{font-size:8px !important;letter-spacing:1px !important;line-height:14px !important;}
}
</style>
</head>
<body id="body" style="margin:0;padding:0;background-color:#151412;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">The Melbourne Cup to the February wedding. What to wear to each.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#151412" style="background-color:#151412;">
<tr><td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E7E2D8" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background-color:#E7E2D8;">
${ROWS.map(rowHtml).join('\n')}
<tr><td background="${IMG_BASE}${footerBg}" bgcolor="#E7E2D8" style="padding:0 0 46px;background-color:#E7E2D8;background-image:url('${IMG_BASE}${footerBg}');background-size:cover;background-position:center top;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td style="padding:0 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;table-layout:fixed;border-top:1px solid #BDB5A7;border-bottom:1px solid #BDB5A7;"><tr>
${trust}
</tr></table>
</td></tr>
<tr><td align="center" style="padding:40px 24px 0;font-family:'Libre Caslon Text',Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;color:#22211F;"><a href="${L.home}" target="_blank" style="color:#22211F;text-decoration:none;">Guillo.</a></td></tr>
<tr><td align="center" style="padding:8px 24px 0;font-family:Jost,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;letter-spacing:1px;"><a href="${L.home}" target="_blank" style="color:#2A2926;text-decoration:none;">guilloclothing.com</a></td></tr>
</table>
</td></tr>
<tr><td align="center" bgcolor="#151412" style="padding:20px 24px 26px;background-color:#151412;font-family:Jost,Helvetica,Arial,sans-serif;font-size:10px;line-height:18px;color:#A39C90;">
Guillo Clothing, Brisbane, Australia<br>
<a href="{% web_view_link %}" target="_blank" style="color:#E7E2D8;text-decoration:underline;">View in browser</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="{% manage_preferences_link %}" target="_blank" style="color:#E7E2D8;text-decoration:underline;">Preferences</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="{% unsubscribe_link %}" target="_blank" style="color:#E7E2D8;text-decoration:underline;">Unsubscribe</a>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

(async () => {
  // Rows must tile the paper with no gaps or overlaps.
  ROWS.forEach((r, i) => {
    if (i && r.y[0] !== ROWS[i - 1].y[1]) throw new Error(`row ${i} does not start where row ${i - 1} ends`);
    r.cols.forEach((c, j) => { if (j && c.x[0] !== r.cols[j - 1].x[1]) throw new Error(`row ${i} col ${j} gap`); });
    if (r.cols[0].x[0] !== 0 || r.cols.at(-1).x[1] !== W) throw new Error(`row ${i} does not span ${W}px`);
  });

  const server = await serve(SRC);
  const url = `http://127.0.0.1:${server.address().port}/${encodeURIComponent(DESIGN)}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: 900 }, deviceScaleFactor: SCALE });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.route('**/*', routeRequests);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('image-slot')].every((s) => s.hasAttribute('data-filled')), null, { timeout: 30000 });
  await page.waitForTimeout(1000);

  // Hide Claude Design editing chrome (dashed slot rings, controls) and the scrollbar.
  const footer = await page.evaluate((label) => {
    document.documentElement.setAttribute('data-om-exporting', '');
    document.documentElement.style.overflow = 'hidden';
    document.querySelectorAll('image-slot').forEach((s) => {
      const st = document.createElement('style');
      st.textContent = '.ring,.ctl,.credit,.empty,.spill{display:none !important}.frame{background:transparent !important}';
      s.shadowRoot.appendChild(st);
    });
    const r = document.querySelector(`[data-screen-label="${label}"]`).getBoundingClientRect();
    return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) };
  }, FOOTER_SECTION);
  if (footer.top !== ROWS.at(-1).y[1]) throw new Error(`footer starts at ${footer.top}, slices end at ${ROWS.at(-1).y[1]}; update ROWS`);

  fs.rmSync(OUT_IMG, { recursive: true, force: true });
  fs.mkdirSync(OUT_IMG, { recursive: true });
  let n = 0;
  for (const [r, row] of ROWS.entries()) {
    for (const [c, col] of row.cols.entries()) {
      col.file = `summer-calendar-${String(++n).padStart(2, '0')}.jpg`;
      await page.screenshot({
        path: path.join(OUT_IMG, col.file), type: 'jpeg', quality: 82, fullPage: true,
        clip: { x: col.x[0], y: row.y[0], width: col.x[1] - col.x[0], height: row.y[1] - row.y[0] },
      });
    }
  }

  // Footer background: the same paper texture with the footer's own text hidden.
  await page.evaluate((label) => { document.querySelector(`[data-screen-label="${label}"]`).style.visibility = 'hidden'; }, FOOTER_SECTION);
  const footerBg = 'summer-calendar-footer-paper.jpg';
  await page.screenshot({ path: path.join(OUT_IMG, footerBg), type: 'jpeg', quality: 70, fullPage: true, clip: { x: 0, y: footer.top, width: W, height: footer.bottom - footer.top } });

  await browser.close();
  server.close();

  fs.writeFileSync(path.join(ROOT, 'index.html'), emailHtml(footerBg));
  const kb = fs.readdirSync(OUT_IMG).reduce((t, f) => t + fs.statSync(path.join(OUT_IMG, f)).size, 0) / 1024;
  console.log(`wrote index.html (${(fs.statSync(path.join(ROOT, 'index.html')).size / 1024).toFixed(1)} KB) and ${n + 1} images (${kb.toFixed(0)} KB)`);
})().catch((e) => { console.error(e); process.exit(1); });
