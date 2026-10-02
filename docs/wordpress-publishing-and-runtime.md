# WordPress publishing, GitHub builds, and runtime routes

Status: GitHub Actions staging deployment is implemented; production deployment and the PHP runtime proxy are not connected. Reviewed 2 October 2026.

WordPress remains the content and transaction backend; Eleventy generates the public pages; GitHub Actions builds and deploys static output to staging. The Bun receiver and dispatcher relay content events to GitHub. Production deployment and runtime API routes are still separate work. See [PROJECT_RULES.md](../PROJECT_RULES.md) and the [whole-site route inventory](current-site-inventory.md).

## What works today

- `bun run dev` starts the local frontend at `http://localhost:4555`; it neither polls WordPress nor consumes webhook events.
- `bun run webhook` starts the Bun receiver on `127.0.0.1:8787` by default. It verifies an HMAC-SHA256 signature over the exact request body, requires a fresh `X-Webhook-Timestamp` (five-minute window by default), validates the generic WordPress content event, and durably stores deduplicated events in `.data/webhooks/pending/` before returning `202`.
- The MU-plugin sender reports public post types (including posts/articles, pages, products, and public custom post types), public post metadata, WooCommerce product changes, public taxonomy changes, media changes, and menu changes. Draft edits are ignored; publication and removal from public status are reported. A new custom post type still needs an Eleventy data adapter and template before it can appear in generated output.
- `bun run webhook:dispatch` batches pending events to GitHub's `repository_dispatch` API. The GitHub workflow builds the entire Eleventy site from current public WordPress/WooCommerce data, checks generated routes, then atomically promotes the result to `https://cd2027.christinedeloupy.fr`. The daily full staging rebuild recovers from missed events and failed earlier workflow runs.
- The receiver binds to loopback by default. On the webhook host, put it behind an HTTPS reverse proxy and run the dispatcher on a schedule. `localhost:4555` remains the development frontend address, not the webhook address.
- This is a staging workflow. The production hostname is not deployed by it. Configure the GitHub `test` environment as described in [the staging deployment guide](staging-deployment.md).
- `bun run check` runs the Eleventy build and `scripts/check-routes.js`. The route check inspects generated sitemap routes and selected internal-link and archive conditions. It does not exercise checkout payments or every form integration.

### Connect WordPress to the GitHub staging build

1. Copy `wordpress/mu-plugins/cd2026-eleventy-webhook.php` to the WordPress installation’s `wp-content/mu-plugins/` directory. Create that directory if it does not exist.
2. Run the Bun receiver and dispatcher on an internet-reachable webhook host, with the private queue on persistent storage. Configure `WEBHOOK_SECRET`, `GITHUB_REPOSITORY`, `GITHUB_DISPATCH_TOKEN`, and `GITHUB_DISPATCH_EVENT_TYPE` there; keep secrets out of the repository and public web root.
3. Add the public HTTPS receiver URL and the same HMAC secret to WordPress `wp-config.php` before WordPress loads:

```php
define('CD2026_ELEVENTY_WEBHOOK_URL', 'https://webhook-host.example/webhooks/christine');
define('CD2026_ELEVENTY_WEBHOOK_SECRET', 'the-same-long-random-secret-as-WEBHOOK_SECRET');
```

4. Save a published page, article, product, or another supported WordPress record. The receiver's `202` confirms queue persistence; the dispatcher batches pending events to GitHub. The GitHub workflow then performs a complete data fetch, build, route check, and staging promotion.

WordPress's default WP-Cron is triggered by site visits, so sender retries may be delayed on a quiet site. Configure a real server cron to invoke WordPress cron and schedule `bun run webhook:dispatch` on the webhook host.

The [first implementation note](first-implementation.md) records the current page, commerce, and form coverage. In particular, account, subscription, course, payment-result, and some specialized form operations still need integration work.

## Content update flow and production boundary

The webhook should notify the system that content changed. WordPress remains the canonical source; the event body is not the content database.

1. The MU-plugin observes saved public content and sends a signed event with event ID, record type and ID, status, changed fields, and modification time. The payload is only a signal; WordPress remains canonical.
2. The Bun receiver validates timestamp, HMAC, body size, and the generic record event schema. It deduplicates and stores the event before returning `202`; that response means “stored”, not “deployed”.
3. The dispatcher batches pending events and submits one GitHub `repository_dispatch`. The event identifies the batch; it does not carry a content snapshot.
4. GitHub Actions fetches the latest public WordPress pages, posts, products, taxonomies, menus, and related data, then rebuilds all Eleventy routes and checks them. This handles affected article, archive, page, product, and category outputs without maintaining a hand-built dependency map.
5. After validation, the workflow uploads a versioned static release and atomically switches the staging `current` symlink. The last successful release remains available if a new build or upload fails.
6. If the incoming delivery or GitHub dispatch fails, the relevant sender/dispatcher retries. A build or upload failure leaves the previous staging release active; the daily rebuild and manual workflow trigger provide recovery. Production still needs its own environment and target.

The staging path is:

```text
WordPress publish hook
  -> HTTPS Bun webhook receiver
  -> durable event record
  -> scheduled GitHub dispatcher
  -> repository_dispatch
  -> full WordPress fetch, Eleventy build, and route checks
  -> atomic staging promotion
```

The receiver stores queue files on disk; on the webhook host, that queue must be persistent and private. Do not run a full-site build inside the incoming HTTP request: hosting request timeouts and WordPress retries make that fragile. The batch event triggers one build for all current WordPress content, avoiding per-record page dependency logic.

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

The public frontend address, WordPress source address, and visible brand name are different settings. They may currently share a value, but should not be conflated if WordPress later moves to a separate host.

| Variable | Example | Used for |
| --- | --- | --- |
| `SITE_NAME` | `Christine Deloupy` | Visible brand name, document title, and Open Graph site name. |
| `SITE_URL` | `https://christinedeloupy.fr` | Public Eleventy origin for canonical URLs and sitemap entries. Use the final public domain. |
| `WORDPRESS_ORIGIN` | `https://christinedeloupy.fr` | WordPress API, media, and form-handler origin fetched by the build and PHP proxy. This may become a WordPress-only subdomain. |
| `WEBHOOK_SECRET` | random secret, never an example value in production | Shared HMAC key used by the WordPress MU plugin and local Bun receiver. |
| `GITHUB_DISPATCH_TOKEN` | stored secret | Credential used by `webhook:dispatch` to request a GitHub workflow. Keep it on the webhook host, not in the browser or public repository. |
| `GITHUB_REPOSITORY` | `owner/repository` | Repository receiving `repository_dispatch` events. |
| `GITHUB_DISPATCH_EVENT_TYPE` | `cd2026_staging_deploy` | Event type the receiving workflow must subscribe to. |
| Deployment credentials | host-specific | SSH/SFTP/hosting credentials used by GitHub Actions to publish `_site/`. Store them as GitHub Actions secrets. |

Set non-secret build values such as `SITE_NAME`, `SITE_URL`, and `WORDPRESS_ORIGIN` under GitHub repository **Settings → Secrets and variables → Actions → Variables**. Put tokens and deployment credentials under **Secrets**. GitHub documents [workflow variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables) and [workflow secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

Set `WEBHOOK_SECRET`, `GITHUB_REPOSITORY`, and `GITHUB_DISPATCH_TOKEN` for the Bun receiver/dispatcher using the webhook host's server-side environment configuration. Set staging upload credentials in the GitHub `test` environment. Never put secrets in `src/`, the generated `_site/`, public JavaScript, or Git.

These variables are a configuration target, not currently wired application settings. At present:

- `src/_data/site.js` hard-codes `site.name` and `site.origin`.
- `src/_data/wordpress.js` hard-codes `SITE_ORIGIN`, uses it to fetch WordPress and generate normalized canonical links, and supplies the URLs used by the sitemap.
- `scripts/dev-server.js` hard-codes `WORDPRESS_ORIGIN` for forms and the Store API proxy.
- `scripts/check-routes.js` contains the current public hostname in an internal-link check.
- `.env.example` lists webhook and GitHub dispatcher settings. The webhook host must configure its own environment rather than relying on the development `.env` file.

When wiring the variables, keep source and output origins separate: use `WORDPRESS_ORIGIN` to accept WordPress record URLs and fetch data, then build public canonical links and sitemap entries from `SITE_URL` while preserving the existing paths and redirects in the [route inventory](current-site-inventory.md). If both systems remain on `christinedeloupy.fr`, the two origin values can be the same. If WordPress moves to a backend subdomain, they should differ.

## Decisions before enabling production automation

- Confirm the webhook host's outbound HTTPS access, persistent private queue storage, and cron support.
- Choose how the site files are uploaded and how a known-good release is retained or restored. Confirm whether the host supports a staging directory and atomic promotion.
- Decide whether WordPress remains on the public domain or moves to a backend origin, and how `/wp-admin`, REST routes, public Eleventy routes, forms, and commerce routes are routed.
- Install the MU plugin and configure its HTTPS endpoint and HMAC secret. Configure a separate production GitHub environment/workflow and deployment target before production publishing.
- Complete staging checks for all current route families, WooCommerce payment gateways, form providers, account/subscription/course integrations, and any required redirects before claiming production parity.

## Project references

- [Project rules](../PROJECT_RULES.md)
- [Current site route inventory](current-site-inventory.md)
- [First implementation status and remaining integrations](first-implementation.md)
- [Bun webhook receiver](../webhook/server.js)
- [Local development server and API adapters](../scripts/dev-server.js)
- [WooCommerce browser client](../src/assets/commerce.js)
- [Form browser client](../src/assets/forms.js)
- [Site metadata](../src/_data/site.js)
- [WordPress build data](../src/_data/wordpress.js)
- [Build and route-check scripts](../package.json) and [`scripts/check-routes.js`](../scripts/check-routes.js)
