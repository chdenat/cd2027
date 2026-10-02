# First implementation — status and boundaries

Date: 2 October 2026.

## Implemented

- Eleventy generates the homepage and the current WordPress public route families from published records: 58 other pages, 142 articles, 7 purchasable products, 5 article categories, 6 product categories, and the Christine author archive. The generated sitemap contains 220 routes.
- The header and legal footer navigation are read from the public WordPress navigation records. Internal links are mapped back to the Eleventy routes. Lazy-loaded images in WordPress-rendered content are activated for static output.
- The homepage and editorial routes use current WordPress content instead of the previous fictional starter copy. Product detail, shop/category archives, the article archive, cart, and checkout each have an Eleventy template.
- WordPress theme values are copied into code-owned `--cd2026--*` tokens and mapped to Web Awesome tokens. Web Awesome is self-hosted from the installed package, and Font Awesome SVGs are copied locally. The current site’s public images and fonts are still served from `christinedeloupy.fr`.
- On `localhost:4555`, WooCommerce’s Store API is proxied same-origin so the browser can keep its Cart-Token without WordPress CORS headers. Cart reads, add/remove/update, shipping-rate selection, checkout fields, and order submission use WooCommerce’s public customer-facing API.
- Forminator form IDs 10671 and 10569 and MailPoet IDs 1, 5, 7, 9, 11, 12, 13, and 15 load their current fields from WordPress at runtime. Eleventy owns the page shell and theme; the local adapter preserves the provider’s hidden form tokens and forwards submissions to the existing plugin handlers.
- The Bun webhook receiver stores signed WordPress content events in a durable queue. The dispatcher batches queued changes into a GitHub Actions request; the staging workflow fetches current public data and rebuilds all Eleventy routes. The WordPress sender covers public post types, WooCommerce products and product metadata, public taxonomies, media, and navigation. The local frontend does not poll WordPress or process this queue.

## Not yet certified

This is a route-complete first pass, not a pixel-perfect approval of all 220 routes. The current theme tokens match the public WordPress palette and typography roles, but Gutenberg, Getwid, CoBlocks, custom fields, and plugin-rendered sections still need comparison and dedicated renderers where their original styles are not reproduced. External image and font hosting also remains coupled to the current WordPress domain.

The checkout adapter follows WooCommerce Store API cart and checkout endpoints. The live store currently advertises PayPal and bank transfer. No live order was placed during implementation, so payment gateway redirects, gateway-specific `payment_data`, order confirmation callbacks, taxes, coupons, account creation, and each product’s optional fields still need a staging end-to-end test. An incompatible gateway may require a narrowly scoped server adapter or a documented provider-hosted payment step; it must not silently fall back to the WordPress checkout page.

The account, memberships, subscriptions, course access, invoices, booking, and payment-result routes are generated as Eleventy pages, but their authenticated runtime operations have not been connected. Contact Form 7 markup found on a payment-result page is also not included in the current Forminator/MailPoet adapter. File uploads, CAPTCHA, and other special form fields need individual provider tests before those forms are called complete.

## Automatic publishing path

The local frontend remains at `localhost:4555` and is separate from publishing. The signed webhook receiver and GitHub dispatcher run on an internet-reachable host. GitHub Actions builds and atomically deploys the staging site at `cd2027.christinedeloupy.fr`.

The production domain is not connected to this workflow. Before enabling it, configure a separate production environment and deployment target, test route/link and commerce checks, and retain atomic artifact promotion and rollback. The daily staging build is a recovery path for a missed event. Never expose WordPress credentials in the Eleventy output or browser code.

The browser currently calls same-origin paths such as `/wp-json/wc/store/v1/cart`. A production host must provide an equivalent HTTPS reverse proxy or server adapter and the form routes used here. Direct browser-to-WordPress calls are blocked by the current site’s CORS response for `localhost:4555`.
