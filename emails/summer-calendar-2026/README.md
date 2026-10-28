# Summer Calendar email: "Eight dates, and one wardrobe"

Email-safe build of the Claude Design file `Guillo Summer Calendar Email.dc.html`.

| | |
|---|---|
| Subject (suggested) | Eight dates, and one wardrobe |
| Preheader | The Melbourne Cup to the February wedding. What to wear to each. |
| Width | 600px, scales proportionally on mobile |
| HTML size | about 15 KB, under Gmail's 102 KB clipping limit |
| Images | 12 slices plus a footer paper background, about 1 MB in total, rendered at 2x for retina |

## How it is built

Gmail and Outlook strip absolute positioning, rotation and CSS grid, and the design depends on all three.
`build.js` renders the design in Chromium at 2x and cuts the paper sections into image slices.
Where two polaroids sit side by side, the row is split into two columns, so each "Tap to shop" goes to its own product.
The trust strip, sign-off and legal footer are live HTML over a matching paper background.
Every slice has descriptive alt text naming the date and the products.

```sh
node emails/summer-calendar-2026/build.js
# absolute image URLs for a sending platform:
IMG_BASE=https://your-image-host/summer-calendar/ node emails/summer-calendar-2026/build.js
```

`source/` holds the original design file, its scripts, the binder image and the image-slot state that carries the eight look photos and the hero.
Edit the design in Claude Design, export again into `source/`, and rerun the build.
If section heights change, update `ROWS` in `build.js`. The build fails loudly if the slices stop lining up with the footer.

## Sending from Klaviyo

The draft template **Summer Calendar 2026 - Eight dates, and one wardrobe (draft)** is already in Klaviyo, template ID `YapCZV`.
Open it at https://www.klaviyo.com/email-editor/YapCZV/edit or pick it when creating a campaign.

- `klaviyo.html` is the exact HTML in that template. Every image points at its copy in the Klaviyo image library.
- `klaviyo-images.json` maps each slice to its Klaviyo URL. Klaviyo gives every upload a new URL, so if the slices change, re-upload them, update this file and rebuild.
- The template has a plain-text version, and its footer uses Klaviyo's `{% web_view_link %}`, `{% manage_preferences_link %}` and `{% unsubscribe_link %}` tags.
- Send a preview to Gmail, Apple Mail and Outlook before scheduling.

## Check before sending

- **Search links.** The Valenti, Portofino and Siracusa looks link to site search, as in the design. Swap in product URLs if those pages exist.
- **Product URLs.** The handles come from the design and have not been checked against the live store.
- **Hero wordmark.** The design points at `cdn/shop/files/guillo-wordmark-white.png`. The build bakes in the theme's `assets/guillo-logo-white.png` instead, so the hero never depends on that path.
