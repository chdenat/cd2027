# Christine Deloupy — Eleventy frontend

Eleventy generates the public pages from published WordPress content. WordPress remains the editorial backend and WooCommerce remains the cart, order, and payment engine. Web Awesome supplies the component and layout system; Font Awesome supplies the icon assets.

## Run locally

Install the dependencies and run the local frontend with Bun:

```bash
bun install
bun run dev
```

The frontend is served at `http://localhost:4555` with `bun run dev`. The development server serves `_site/` and proxies the WooCommerce Store API and supported form endpoints to WordPress. It does not poll WordPress or consume webhook events. Content changes go through the signed webhook queue and GitHub Actions; the staging workflow fetches the current public WordPress data and rebuilds the complete site.

Useful commands:

```bash
bun run build
bun run check
```

The build requires network access to the public WordPress REST and WooCommerce Store APIs. `_site/` is generated output.

## Source layout

- `src/_data/wordpress.js` fetches published pages, posts, product data, taxonomies, and the WordPress navigation, then maps their canonical links to Eleventy output routes.
- `src/pages.njk`, `src/posts.njk`, `src/products.njk`, and the category templates generate the site’s current route families.
- `src/_includes/layouts/` and `src/_includes/includes/` hold the shared layouts and reusable cards.
- `src/assets/theme.css` defines the WordPress-derived `--cd2026--*` palette and the Web Awesome light/dark theme; `src/assets/styles.css` applies those tokens to page layouts and WordPress block styles.
- `scripts/dev-server.js` serves the local site and provides same-origin API adapters for WooCommerce and the current Forminator/MailPoet forms.
- `docs/current-site-inventory.md` is the route inventory; `docs/first-implementation.md` records the prototype’s verified scope and remaining integrations; `docs/wordpress-publishing-and-runtime.md` documents the GitHub staging workflow, Bun webhook, PHP runtime proxy, and environment configuration. For setup steps, see the [site de test et hook WordPress user guide](docs/staging-deployment.md).

The checked-in GitHub workflow deploys only to `https://cd2027.christinedeloupy.fr`. It needs the documented GitHub environment secrets and an internet-reachable webhook host; this does not enable production deployment.
