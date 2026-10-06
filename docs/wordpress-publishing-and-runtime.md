<!--
 * This file is part of the CD2027 project.
 *
 * File: docs/wordpress-publishing-and-runtime.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

# WordPress publishing, GitHub builds, and runtime routes

Status: GitHub Actions staging deployment is implemented. A separate production workflow is present but remains locked until its environment and web-server route are configured. The PHP runtime proxy is not connected. Reviewed 4 October 2026.

WordPress remains the content and transaction backend; Eleventy generates the public pages; GitHub Actions builds and deploys static output to `cd2027.christinedeloupy.fr`. The source WordPress site is the CD2020 origin, currently configured at `https://christinedeloupy.fr`. The WordPress PHP MU-plugin queues publishing events and dispatches GitHub builds through WP-Cron. The production workflow is defined separately but remains locked; its GitHub environment, release root, and web-server route are not configured. Runtime API routes are also still separate work. See [PROJECT_RULES.md](../PROJECT_RULES.md) and the [whole-site route inventory](current-site-inventory.md).

## What works today

- `bun run dev` starts the local frontend at `http://localhost:4555`; it neither polls WordPress nor consumes webhook events.
- The MU-plugin stores changed-content events in the WordPress database and retries GitHub notifications through WP-Cron.
- The MU-plugin sender reports public post types (including posts/articles, pages, products, and public custom post types), public post metadata, WooCommerce product changes, public taxonomy changes, media changes, and menu changes. Draft edits are ignored; publication and removal from public status are reported. A new custom post type still needs an Eleventy data adapter and template before it can appear in generated output.
- The PHP MU-plugin batches pending events to GitHub's `repository_dispatch` API. GitHub builds the entire Eleventy site from current public WordPress/WooCommerce data, checks generated routes, then atomically promotes the result to `https://cd2027.christinedeloupy.fr`. The daily full staging rebuild recovers from missed events and failed earlier workflow runs.
- `localhost:4555` remains the development frontend address and does not participate in publishing.
- The staging workflow deploys only `cd2027.christinedeloupy.fr`. A separate `cd2027-production` workflow/environment targets `christinedeloupy.fr` after its readiness flag and approval gate are configured; see the [WP Awesome and environment guide](wordpress-connector-and-environments.md).
- `bun run check` runs the Eleventy build and `scripts/check-routes.js`. The route check inspects generated sitemap routes and selected internal-link and archive conditions. It does not exercise checkout payments or every form integration.

### Connect WordPress to the GitHub staging build

The one-time MU-plugin install procedure is in the [CD2027 deployment guide](cd2027-deployment.md#4-relier-wordpress-au-workflow-par-le-mu-plugin-php). The optional [WP Awesome plugin](wordpress-connector-and-environments.md) adds a WordPress admin dashboard for configuration checks, event history, separate staging/production build results, and explicit build requests. The repository token uses **Contents: Read and write** to dispatch builds; a private repository also needs **Actions: Read** to list workflow runs. The constants are `CD2027_GITHUB_DISPATCH_TOKEN` and `CD2027_GITHUB_REPOSITORY`.

For Nuxit's Webcron, use this URL and schedule it every five minutes (`*/5 * * * *`):

```text
https://christinedeloupy.fr/wp-cron.php?doing_wp_cron
```

This is the CD2020 WordPress origin currently configured by the staging workflow; `cd2027.christinedeloupy.fr` is the generated frontend and is not the cron target. Nuxit's panel accepts the URL and schedule fields directly, so no separate webhook host or shell command is needed. After saving a published page, article, product, or another supported record, WP-Cron sends the notification; GitHub then fetches current data, builds, checks routes, and promotes the staging output.

### Do template and style fixes survive later content edits?

Yes, when the fixes are in the repository source and merged into `main`. Each GitHub workflow run checks out `main`, fetches the latest public WordPress content, and rebuilds the site. Later edits to page text or media therefore appear in the next build while templates and CSS from `main` are applied again. A change made only in generated `_site/` output or in an uncommitted local file is not part of that workflow and will not persist. If an edit changes the page's block structure, review any layout rules that depend on that structure.

The staging pipeline uses its own `cd2027` GitHub environment, `CD2027_SSH_*` secrets, `CD2027_REMOTE_ROOT` variable, and `cd2027_deploy` dispatch event. Production has a separate `cd2027-production` environment, production-only release root, and `cd2027_production_deploy` event; routine content updates never trigger production. Configure both environments explicitly. Their workflow files do not fall back to each other's deployment credentials. The WordPress sender continues to use the `CD2027_GITHUB_*` constants and its durable database outbox. Do not remove or replace an installed sender until its pending events are drained or backed up.

The [first implementation note](first-implementation.md) records the current page, commerce, and form coverage. In particular, account, subscription, course, payment-result, and some specialized form operations still need integration work.

## Content update flow and production boundary

The webhook should notify the system that content changed. WordPress remains the canonical source; the event body is not the content database.

1. The MU-plugin observes saved public content and stores an event ID, record type and ID, status, changed fields, and modification time in WordPress's database. The event is only a signal; WordPress remains canonical.
2. WP-Cron retries a batched authenticated GitHub `repository_dispatch` request until GitHub accepts it. The event identifies the batch; it does not carry a content snapshot.
3. GitHub Actions fetches the latest public WordPress pages, posts, products, taxonomies, menus, and related data, then rebuilds all Eleventy routes and checks them. This handles affected article, archive, page, product, and category outputs without maintaining a hand-built dependency map.
4. After validation, the workflow uploads a versioned static release and atomically switches the staging `current` symlink. The last successful release remains available if a new build or upload fails.
5. If GitHub dispatch fails, the MU-plugin retries through WP-Cron. A staging build or upload failure leaves the previous staging release active; the daily staging rebuild and manual workflow trigger provide recovery. Production has a separate manual workflow and remains locked until the production environment, release root, and web-server route are configured.

The staging path is:

```text
WordPress publish hook
  -> durable WordPress database outbox
  -> scheduled WP-Cron dispatch
  -> repository_dispatch
  -> full WordPress fetch, Eleventy build, and route checks
  -> atomic staging promotion
```

The MU-plugin does not build the site inside a WordPress request. GitHub Actions performs the full build after receiving the notification, avoiding hosting timeouts and per-record page dependency logic.

## PHP runtime proxy for WooCommerce and forms

The static Eleventy build handles public pages. A PHP proxy handles requests that need WordPress at visitor runtime. Keep this separate from the publishing webhook, even if both are implemented in PHP on the same host.

### WooCommerce Store API

The browser currently calls same-origin paths under `/wp-json/wc/store/v1` and stores the WooCommerce `Cart-Token` in session storage. The production PHP adapter can forward the allowed cart, checkout, and product paths to `WORDPRESS_ORIGIN`, then return WordPress's status, JSON body, and relevant headers. It must preserve the HTTP method, query string, request body, `Content-Type`, `Cart-Token`, and `Nonce`; return updated `Cart-Token` or `Nonce` headers where supplied; and disable caching for customer-specific cart and checkout responses.

WooCommerce documents `Cart-Token` for headless cart sessions; cart writes and checkout require a valid Cart Token or Nonce. Use the customer-facing Store API for these operations, not privileged WooCommerce REST API keys in browser code. See the [Store API](https://developer.woocommerce.com/docs/apis/store-api/), [Cart Tokens](https://developer.woocommerce.com/docs/apis/store-api/cart-tokens), and [Nonce Tokens](https://developer.woocommerce.com/docs/apis/store-api/nonce-tokens) documentation.

Restrict the PHP proxy to known routes and methods. Do not accept a caller-supplied upstream URL or let the PHP endpoint become an open proxy. Enforce request-size and timeout limits, return upstream status codes safely, and avoid caching cart, checkout, order, or account data.

### Forminator and MailPoet

The local adapter exposes `/api/forms/load` and `/api/forms/submit`. It currently recognizes specific Forminator and MailPoet form IDs, retrieves their current fields from WordPress, preserves provider hidden fields, and submits to the existing WordPress plugin handlers. A PHP implementation must keep an allowlist of supported provider/form pairs, validate the submitted form ID and action, preserve consent and anti-spam fields, and test each form's success and error behavior.

Do not infer that every WordPress form is covered: the current implementation note records unsupported form types and special cases such as file uploads and CAPTCHA. Add each provider integration explicitly and verify it before relying on it in production.

## Configuration values and where they belong

The public frontend address, WordPress source address, and visible brand name are different settings. In the current staging workflow, the frontend is `cd2027.christinedeloupy.fr` and the CD2020 WordPress source is `christinedeloupy.fr`.

| Variable | Example | Used for |
| --- | --- | --- |
| `SITE_NAME` | `Christine Deloupy` | Visible brand name, document title, and Open Graph site name. |
| `SITE_URL` | `https://cd2027.christinedeloupy.fr` | Current staging origin for generated canonical URLs and sitemap entries. |
| `WORDPRESS_ORIGIN` | `https://christinedeloupy.fr` | WordPress API, media, and form-handler origin fetched by the build and PHP proxy. This may become a WordPress-only subdomain. |
| `CD2027_GITHUB_DISPATCH_TOKEN` | stored secret | Fine-grained GitHub token held in WordPress `wp-config.php` for requesting the staging workflow. |
| `CD2027_GITHUB_REPOSITORY` | `chdenat/cd2027` | Repository receiving `repository_dispatch` events. |
| Deployment credentials | host-specific | SSH/SFTP/hosting credentials used by GitHub Actions to publish `_site/`. Store them as GitHub Actions secrets. |

The current staging workflow sets `SITE_URL` and `WORDPRESS_ORIGIN` directly in `.github/workflows/deploy-cd2027.yml`; `src/_lib/wordpress-site-profile.js`, `src/_lib/wordpress-data.js`, and `scripts/check-routes.js` read those build environment values. The local `scripts/dev-server.js` API proxy currently uses `https://christinedeloupy.fr` directly. Change these source settings deliberately if the WordPress host changes.

Set the dispatch token in WordPress `wp-config.php`. Set staging upload credentials in the GitHub `cd2027` environment. Never put secrets in `src/`, the generated `_site/`, public JavaScript, or Git.

Keep source and output origins separate: use `WORDPRESS_ORIGIN` to fetch WordPress data and media, then use `SITE_URL` for staging canonical links and sitemap entries while preserving the paths and redirects in the [route inventory](current-site-inventory.md).

## Decisions before enabling production automation

- Confirm WordPress can make outbound HTTPS requests to GitHub and Nuxit's scheduled task can invoke WP-Cron.
- Choose how the site files are uploaded and how a known-good release is retained or restored. Confirm whether the host supports a staging directory and atomic promotion.
- Decide whether WordPress remains on the public domain or moves to a backend origin, and how `/wp-admin`, REST routes, public Eleventy routes, forms, and commerce routes are routed.
- Install the MU-plugin and connector, configure the GitHub dispatch token and target map in `wp-config.php`, and populate the separate production environment before enabling its readiness flag.
- Complete staging checks for all current route families, WooCommerce payment gateways, form providers, account/subscription/course integrations, and any required redirects before claiming production parity.

## Project references

- [Project rules](../PROJECT_RULES.md)
- [Current site route inventory](current-site-inventory.md)
- [First implementation status and remaining integrations](first-implementation.md)
- [WordPress publishing MU-plugin](../wordpress/mu-plugins/cd2027-eleventy-webhook.php)
- [Local development server and API adapters](../scripts/dev-server.js)
- [WooCommerce browser client](../src/assets/commerce.js)
- [Form browser client](../src/assets/forms.js)
- [Site metadata](../src/_lib/wordpress-site-profile.js)
- [WordPress build data](../src/_lib/wordpress-data.js)
- [Build and route-check scripts](../package.json) and [`scripts/check-routes.js`](../scripts/check-routes.js)
