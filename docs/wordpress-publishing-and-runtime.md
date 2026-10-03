# WordPress publishing, GitHub builds, and runtime routes

Status: GitHub Actions staging deployment is implemented; production deployment and the PHP runtime proxy are not connected. Reviewed 2 October 2026.

WordPress remains the content and transaction backend; Eleventy generates the public pages; GitHub Actions builds and deploys static output to `cd2027.christinedeloupy.fr`. The WordPress PHP MU-plugin queues publishing events and dispatches GitHub builds through WP-Cron. Production deployment and runtime API routes are still separate work. See [PROJECT_RULES.md](../PROJECT_RULES.md) and the [whole-site route inventory](current-site-inventory.md).

## What works today

- `bun run dev` starts the local frontend at `http://localhost:4555`; it neither polls WordPress nor consumes webhook events.
- The MU-plugin stores changed-content events in the WordPress database and retries GitHub notifications through WP-Cron.
- The MU-plugin sender reports public post types (including posts/articles, pages, products, and public custom post types), public post metadata, WooCommerce product changes, public taxonomy changes, media changes, and menu changes. Draft edits are ignored; publication and removal from public status are reported. A new custom post type still needs an Eleventy data adapter and template before it can appear in generated output.
- The PHP MU-plugin batches pending events to GitHub's `repository_dispatch` API. GitHub builds the entire Eleventy site from current public WordPress/WooCommerce data, checks generated routes, then atomically promotes the result to `https://cd2027.christinedeloupy.fr`. The daily full staging rebuild recovers from missed events and failed earlier workflow runs.
- `localhost:4555` remains the development frontend address and does not participate in publishing.
- This is a staging workflow. The production hostname is not deployed by it. Configure the GitHub `cd2027` environment as described in [the staging deployment guide](cd2027-deployment.md).
- `bun run check` runs the Eleventy build and `scripts/check-routes.js`. The route check inspects generated sitemap routes and selected internal-link and archive conditions. It does not exercise checkout payments or every form integration.

### Connect WordPress to the GitHub staging build

1. Copy `wordpress/mu-plugins/cd2027-eleventy-webhook.php` to the WordPress installation’s `wp-content/mu-plugins/` directory. Create that directory if it does not exist.
2. Create a fine-grained GitHub token limited to this repository, with `Contents: Read and write`, and add it and the repository name to WordPress `wp-config.php` before WordPress loads:

```php
define('CD2027_GITHUB_DISPATCH_TOKEN', 'the-server-side-token');
define('CD2027_GITHUB_REPOSITORY', 'owner/repository');
```

3. Configure Nuxit's scheduled task to call WordPress `wp-cron.php` every five minutes. Save a published page, article, product, or another supported record. WP-Cron sends the notification; GitHub then performs a complete data fetch, build, route check, and staging promotion.

WordPress's default WP-Cron is triggered by site visits, so sender retries may be delayed on a quiet site. Configure the scheduled task in Nuxit's hosting panel; no separate webhook host is needed.

The CD2027 pipeline uses its own `cd2027` GitHub environment, `CD2027_SSH_*` secrets, `CD2027_REMOTE_ROOT` variable, and `cd2027_deploy` dispatch event. Configure these values explicitly; the workflow has no fallback to another environment's deployment credentials. Its WordPress sender likewise reads only the `CD2027_GITHUB_*` constants and uses a dedicated database outbox. When replacing an existing sender, drain or back up its pending notifications before removing it, then install only the CD2027 sender and configure its constants. Renaming repository files does not update the live WordPress installation or GitHub settings.

The [first implementation note](first-implementation.md) records the current page, commerce, and form coverage. In particular, account, subscription, course, payment-result, and some specialized form operations still need integration work.

## Content update flow and production boundary

The webhook should notify the system that content changed. WordPress remains the canonical source; the event body is not the content database.

1. The MU-plugin observes saved public content and stores an event ID, record type and ID, status, changed fields, and modification time in WordPress's database. The event is only a signal; WordPress remains canonical.
2. WP-Cron retries a batched authenticated GitHub `repository_dispatch` request until GitHub accepts it. The event identifies the batch; it does not carry a content snapshot.
4. GitHub Actions fetches the latest public WordPress pages, posts, products, taxonomies, menus, and related data, then rebuilds all Eleventy routes and checks them. This handles affected article, archive, page, product, and category outputs without maintaining a hand-built dependency map.
5. After validation, the workflow uploads a versioned static release and atomically switches the staging `current` symlink. The last successful release remains available if a new build or upload fails.
6. If GitHub dispatch fails, the MU-plugin retries through WP-Cron. A build or upload failure leaves the previous staging release active; the daily rebuild and manual workflow trigger provide recovery. Production still needs its own environment and target.

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

The public frontend address, WordPress source address, and visible brand name are different settings. They may currently share a value, but should not be conflated if WordPress later moves to a separate host.

| Variable | Example | Used for |
| --- | --- | --- |
| `SITE_NAME` | `Christine Deloupy` | Visible brand name, document title, and Open Graph site name. |
| `SITE_URL` | `https://christinedeloupy.fr` | Public Eleventy origin for canonical URLs and sitemap entries. Use the final public domain. |
| `WORDPRESS_ORIGIN` | `https://christinedeloupy.fr` | WordPress API, media, and form-handler origin fetched by the build and PHP proxy. This may become a WordPress-only subdomain. |
| `CD2027_GITHUB_DISPATCH_TOKEN` | stored secret | Fine-grained GitHub token held in WordPress `wp-config.php` for requesting the staging workflow. |
| `CD2027_GITHUB_REPOSITORY` | `owner/repository` | Repository receiving `repository_dispatch` events. |
| Deployment credentials | host-specific | SSH/SFTP/hosting credentials used by GitHub Actions to publish `_site/`. Store them as GitHub Actions secrets. |

Set non-secret build values such as `SITE_NAME`, `SITE_URL`, and `WORDPRESS_ORIGIN` under GitHub repository **Settings → Secrets and variables → Actions → Variables**. Put tokens and deployment credentials under **Secrets**. GitHub documents [workflow variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables) and [workflow secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

Set the dispatch token in WordPress `wp-config.php`. Set staging upload credentials in the GitHub `cd2027` environment. Never put secrets in `src/`, the generated `_site/`, public JavaScript, or Git.

These variables are a configuration target, not currently wired application settings. At present:

- `src/_data/site.js` hard-codes `site.name` and `site.origin`.
- `src/_data/wordpress.js` hard-codes `SITE_ORIGIN`, uses it to fetch WordPress and generate normalized canonical links, and supplies the URLs used by the sitemap.
- `scripts/dev-server.js` hard-codes `WORDPRESS_ORIGIN` for forms and the Store API proxy.
- `scripts/check-routes.js` contains the current public hostname in an internal-link check.

When wiring the variables, keep source and output origins separate: use `WORDPRESS_ORIGIN` to accept WordPress record URLs and fetch data, then build public canonical links and sitemap entries from `SITE_URL` while preserving the existing paths and redirects in the [route inventory](current-site-inventory.md). If both systems remain on `christinedeloupy.fr`, the two origin values can be the same. If WordPress moves to a backend subdomain, they should differ.

## Decisions before enabling production automation

- Confirm WordPress can make outbound HTTPS requests to GitHub and Nuxit's scheduled task can invoke WP-Cron.
- Choose how the site files are uploaded and how a known-good release is retained or restored. Confirm whether the host supports a staging directory and atomic promotion.
- Decide whether WordPress remains on the public domain or moves to a backend origin, and how `/wp-admin`, REST routes, public Eleventy routes, forms, and commerce routes are routed.
- Install the MU plugin and configure its GitHub dispatch token in `wp-config.php`. Configure a separate production GitHub environment/workflow and deployment target before production publishing.
- Complete staging checks for all current route families, WooCommerce payment gateways, form providers, account/subscription/course integrations, and any required redirects before claiming production parity.

## Project references

- [Project rules](../PROJECT_RULES.md)
- [Current site route inventory](current-site-inventory.md)
- [First implementation status and remaining integrations](first-implementation.md)
- [WordPress publishing MU-plugin](../wordpress/mu-plugins/cd2027-eleventy-webhook.php)
- [Local development server and API adapters](../scripts/dev-server.js)
- [WooCommerce browser client](../src/assets/commerce.js)
- [Form browser client](../src/assets/forms.js)
- [Site metadata](../src/_data/site.js)
- [WordPress build data](../src/_data/wordpress.js)
- [Build and route-check scripts](../package.json) and [`scripts/check-routes.js`](../scripts/check-routes.js)
