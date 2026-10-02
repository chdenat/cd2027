# WordPress publishing, GitHub builds, and PHP runtime routes

Status: proposed production architecture. The production webhook-to-deployment chain and PHP runtime proxy are not connected yet. Reviewed 1 October 2026.

This document records the discussed deployment shape: WordPress remains the content and transaction backend, Eleventy generates the public pages, GitHub Actions builds and deploys static output, and PHP on the web host handles webhook ingestion and runtime API routes. These are implementation boundaries, not evidence that production automation is already active. See [PROJECT_RULES.md](../PROJECT_RULES.md) and the [whole-site route inventory](current-site-inventory.md).

## What works today

- `npm run dev` starts the local development server at `http://localhost:4555`. It polls public WordPress pages, posts, taxonomies, navigation, products, product categories, and rendered homepage header data every 60 seconds. A detected change triggers a local Eleventy rebuild. This loop does not deploy production.
- `npm run webhook` starts the Bun receiver. It checks an HMAC-SHA256 signature over the raw request body, enforces a request-size limit, parses JSON, stores the event under `.data/webhooks/`, and returns `202`. By default it listens on `127.0.0.1:8787`, so a remote WordPress site cannot reach it directly.
- The Bun receiver is only an event collector. It does not validate a timestamp or replay window, validate a content-event schema beyond JSON syntax, fetch canonical WordPress records, dispatch a GitHub workflow, retry jobs, build Eleventy, or deploy.
- `npm run check` runs the Eleventy build and `scripts/check-routes.js`. The route check inspects generated sitemap routes and selected internal-link and archive conditions. It does not exercise checkout payments or every form integration.

The [first implementation note](first-implementation.md) records the current page, commerce, and form coverage. In particular, account, subscription, course, payment-result, and some specialized form operations still need integration work.

## Proposed content update flow

The webhook should notify the system that content changed. WordPress remains the canonical source; the event body is not the content database.

1. A WordPress hook sends a small signed event after a public content change. It should identify the event, record type and ID, status, and revision or modified time. It should cover publish, update, scheduled publication, unpublish, trash/delete, slug, taxonomy, media, navigation, and SEO changes. Drafts, previews, autosaves, private records, and password-protected records must not enter a production build.
2. A PHP receiver on an HTTPS address validates the allowed method and route, body size, event schema, HMAC on the exact raw body, and an event timestamp or nonce. It deduplicates by stable event ID and stores the job durably before acknowledging it. A `202` response means the job was recorded; it does not mean the site is live.
3. After persisting the job, PHP asks GitHub Actions to run through the GitHub API `repository_dispatch` event. The receiver keeps its GitHub credential server-side and retries a pending dispatch if GitHub is temporarily unavailable. The workflow file must exist on the repository's default branch. See [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
4. The workflow fetches the current public WordPress state using server-side requests, coalesces rapid changes where useful, then builds the complete Eleventy site. It should use the event as a reason to synchronize, not blindly publish the supplied event content. Run the existing `npm run check` command before deployment; add broader route, link, asset, and dynamic-flow checks as those integrations are completed.
5. On success, the workflow uploads `_site/` to the hosting target using the selected supported method (for example, SSH/SFTP or a hosting deployment API). The upload must preserve the PHP webhook and proxy routes and their private configuration. Where the host supports it, stage the release and switch it atomically. Retain the last successful release so a failed build or upload cannot replace it.
6. Add a scheduled reconciliation build that compares WordPress's current public data with the latest deployed revision. This catches a webhook that was lost. GitHub scheduled workflows can be delayed under load, so this is a recovery path rather than an exact publication-time guarantee.
7. Track the event ID, WordPress revision, workflow/build ID, deployment result, attempts, and error. Report content as deployed only after the upload or release promotion succeeds.

The intended path is:

```text
WordPress publish hook
  -> HTTPS PHP webhook receiver
  -> durable event record
  -> GitHub repository_dispatch
  -> fetch current public WordPress data
  -> Eleventy build and route checks
  -> upload/promote _site on the web host
```

The PHP receiver may use a database table or another durable store available on the hosting account. It should acknowledge only after persistence. Do not run a long full-site build inside the incoming HTTP request: hosting request timeouts and WordPress retries make that fragile.

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
| `WEBHOOK_SECRET` | random secret, never an example value in production | Shared HMAC key used by WordPress and the PHP receiver. |
| `GITHUB_DISPATCH_TOKEN` | stored secret | Credential used by PHP to request the GitHub workflow. Keep it on the server, not in the browser or public repository. |
| Deployment credentials | host-specific | SSH/SFTP/hosting credentials used by GitHub Actions to publish `_site/`. Store them as GitHub Actions secrets. |

Set non-secret build values such as `SITE_NAME`, `SITE_URL`, and `WORDPRESS_ORIGIN` under GitHub repository **Settings → Secrets and variables → Actions → Variables**. Put tokens and deployment credentials under **Secrets**. GitHub documents [workflow variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables) and [workflow secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

Set the PHP receiver's `WORDPRESS_ORIGIN`, `WEBHOOK_SECRET`, and `GITHUB_DISPATCH_TOKEN` using the hosting provider's server-side environment configuration. If the provider has no environment-variable panel, use a configuration file outside the public document root with restricted permissions. Never put secrets in `src/`, the generated `_site/`, public JavaScript, or Git.

These variables are a configuration target, not currently wired application settings. At present:

- `src/_data/site.js` hard-codes `site.name` and `site.origin`.
- `src/_data/wordpress.js` hard-codes `SITE_ORIGIN`, uses it to fetch WordPress and generate normalized canonical links, and supplies the URLs used by the sitemap.
- `scripts/dev-server.js` hard-codes `WORDPRESS_ORIGIN` for local polling, forms, and the Store API proxy.
- `scripts/check-routes.js` contains the current public hostname in an internal-link check.
- `.env.example` currently lists webhook settings only. Creating `SITE_NAME`, `SITE_URL`, or `WORDPRESS_ORIGIN` variables will not change the build until the source code reads them.

When wiring the variables, keep source and output origins separate: use `WORDPRESS_ORIGIN` to accept WordPress record URLs and fetch data, then build public canonical links and sitemap entries from `SITE_URL` while preserving the existing paths and redirects in the [route inventory](current-site-inventory.md). If both systems remain on `christinedeloupy.fr`, the two origin values can be the same. If WordPress moves to a backend subdomain, they should differ.

## Decisions before enabling production automation

- Confirm the hosting provider, PHP version/extensions, outbound HTTPS access, available database or private storage, and cron support.
- Choose how the site files are uploaded and how a known-good release is retained or restored. Confirm whether the host supports a staging directory and atomic promotion.
- Decide whether WordPress remains on the public domain or moves to a backend origin, and how `/wp-admin`, REST routes, public Eleventy routes, forms, and commerce routes are routed.
- Configure the WordPress event sender, HTTPS endpoint, HMAC secret, and GitHub dispatch credential. Keep a manual workflow trigger for controlled recovery.
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
