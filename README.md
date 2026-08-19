# Mystora website

Static storefront for Mystora Perfumes. Product content is loaded from Supabase,
and customers complete orders through WhatsApp.

## Pages

- `/` — homepage, featured fragrances, and the special collection
- `/shop/` — searchable and sortable product catalog
- `/product/?slug=example-product` — product details and size selection
- `/admin/` — invite-only Mystora catalogue and operations workspace

## Administration

The admin application is intentionally separate from the public storefront. It
uses Supabase Auth for staff sessions and database RLS for authorization. There
is no public registration flow and a signed-in user must also have an active row
in `public.admin_users`.

The first admin release includes:

- Dashboard metrics, recent orders, collection health, and activity
- Product creation, editing, publishing, variants, prices, stock, and media
- Ordered storefront collections, including New Arrivals
- Manual WhatsApp enquiry and order tracking
- Validated product-image uploads to Supabase Storage
- Storefront WhatsApp, delivery, and social settings
- Database-triggered audit history

The reviewed database changes are kept in `supabase/admin_foundation.sql` and
`supabase/admin_hardening.sql`. They must be applied in that order before
`/admin/` can be used. After the schema exists, create the first user through
Supabase Auth and add that user's UUID to `public.admin_users` with the `owner`
role using a trusted administrative connection. Never expose a service-role or
secret key in this repository or in the browser.

## Local development

The site uses browser JavaScript modules and loads `/navbar.html` with `fetch`,
so opening the HTML files directly with a `file://` URL will not work. Serve the
repository from its root with any static HTTP server, for example:

```powershell
npm install
npm run build:css
npx http-server . -p 4173 -a 127.0.0.1 -c-1
```

Then open the local URL printed by the server. Test the homepage, `/shop/`, and
a product URL containing a valid Supabase product slug.

Tailwind CSS is compiled locally to `assets/css/tailwind.css`. Run
`npm run build:css` after changing Tailwind classes, or keep `npm run watch:css`
running while developing. GSAP, Lenis, and the Supabase browser client are still
loaded from CDNs by the pages that use them.

## JavaScript structure

- `js/main.js` — page bootstrap
- `js/core.js` — navigation and smooth scrolling
- `js/hero.js` — video hero and hero-to-navbar wordmark transition
- `js/search.js` — global navigation search overlay
- `js/home.js` — homepage collections
- `js/shop.js` — catalog search, filters, sorting, and rendering
- `js/product.js` — product variants, gallery, recommendations, and WhatsApp
- `js/products.js` — shared safe product-card rendering
- `js/dom.js` — DOM, loading, error, and formatting helpers
- `js/supabase.js` and `js/config.js` — data client configuration

The homepage hero uses `assets/videos/hero_video.mp4` with
`hero_video_poster.webp` as its loading and reduced-motion fallback.

## Supabase product fields

The storefront currently reads these fields from the `products` table:

- Identity: `id`, `slug`, `name`, `category`, `active`
- Merchandising: `is_featured`, `description`, `created_at`
- Prices: `price`, `price_10ml`, `price_50ml`, `price_100ml`
- Images: `image_url`, `hover_image_url`, `image_10ml`, `image_50ml`,
  `image_100ml`, `promo_image`

The publishable Supabase key in `js/config.js` is intended for browser use. The
`products` table must have Row Level Security enabled with a public read-only
policy for active products. Never place a Supabase secret or service-role key in
this repository.

## Deployment requirements

Create the production bundle before deploying:

```powershell
npm ci
npm run build
```

Deploy only the generated `dist/` directory. It intentionally excludes tests,
local MCP configuration, build scripts, source configuration, logs, and other
development-only files. The included `_headers` file provides CSP, HSTS,
clickjacking protection, MIME sniffing protection, referrer controls, and a
restricted permissions policy on hosts that support the standard static headers
file format.

The host must:

- Serve clean directory routes such as `/shop/` and `/product/`
- Serve JavaScript files with a valid JavaScript MIME type
- Keep absolute asset paths rooted at `/`
- Use HTTPS in production
- Return `navbar.html` at `/navbar.html`
- Apply the rules in `dist/_headers`, or configure equivalent response headers
  in the hosting dashboard
- Redirect every HTTP request to HTTPS before serving content

## Verification checklist

Before deployment:

1. Run `npm install` and `npm run build:css`.
2. Run `npm run test:e2e`.
3. Confirm the browser console has no module or Supabase errors.
4. Test the hero and product grids on a narrow mobile viewport.
5. Test search, category filters, sorting, and Clear on `/shop/`.
6. Test every available size and thumbnail on a product page.
7. Confirm the generated WhatsApp message contains the correct item and price.
8. Simulate an offline request and confirm each product area offers a retry.
