<!--
 * This file is part of the CD2027 project.
 *
 * File: README.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-08-19
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

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

- `src/_lib/wordpress-data.js` fetches published pages, posts, product data, taxonomies, and WordPress navigation, then maps canonical links to Eleventy output routes.
- `src/pages.njk`, `src/posts.njk`, `src/products.njk`, and the category templates generate the site’s current route families.
- `src/_includes/layouts/` and `src/_includes/includes/` hold the shared layouts and reusable cards.
- `src/assets/theme.css` defines the WordPress-derived `--cd2027--*` palette and the Web Awesome light/dark theme; `src/assets/styles.css` applies those tokens to page layouts and WordPress block styles.
- `scripts/dev-server.js` serves the local site and provides same-origin API adapters for WooCommerce and the current Forminator/MailPoet forms.
- `docs/current-site-inventory.md` is the route inventory; `docs/first-implementation.md` records the prototype’s verified scope and remaining integrations; `docs/wordpress-publishing-and-runtime.md` documents the GitHub staging workflow, Bun webhook, PHP runtime proxy, and environment configuration. For setup steps, see the [site CD2027 et hook WordPress user guide](docs/cd2027-deployment.md).
- [Developer tools and automation](docs/developer-tools.md) documents the Bun commands, scripts, workflow triggers, required environment, and side effects.

The checked-in GitHub workflow deploys only to `https://cd2027.christinedeloupy.fr`. It needs the documented GitHub environment secrets and an internet-reachable webhook host; this does not enable production deployment.

## Standalone WP Awesome dependency

The reusable WordPress library and optional PHP publisher are maintained in `../wp-awesome/`, under the unscoped package name `wp-awesome`. This site installs the verified `vendor/wp-awesome-0.1.0-d610ea573912.tgz` archive, so a frozen CI install works before npm/GitHub publication.

After changing the package, run `bun run package:wordpress:refresh` and `bun run check`. The refresh command verifies and repacks the standalone source, updates the dependency and Bun lockfile, and installs it; it does not publish or commit. See [the integration guide](docs/reusable-wordpress-eleventy-content-pipeline.md) for npm and GitHub installation after the first release.
