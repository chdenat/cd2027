---
name: cd2026-wordpress-sync
description: Design or maintain the authenticated, durable WordPress-to-Eleventy content update pipeline.
---

# CD2026 WordPress synchronization

Use this skill for WordPress publish hooks, webhook verification, API fetching, build queues, retries, publication status, and content reconciliation.

## Architecture boundary

- Keep WordPress/WooCommerce as the canonical content and transaction backend during the first migration phase.
- Render the public interface with Eleventy, including editorial pages, the complete WooCommerce order flow, and forms. Load cart, account, and other customer-specific data at runtime; never serialize it into static output.
- Audit checkout, payment gateways, accounts, subscriptions, courses, forms, and newsletter integrations for API compatibility. Record any temporary WordPress-rendered or provider-hosted fallback as a visual exception with an integration plan.
- Do not replace WordPress transaction or form processing unless the owner explicitly changes this decision.

## Form handling

- Build form presentation and client-side validation states in Eleventy, but preserve the current destination, consent, anti-spam protection, notifications, and post-submit behavior.
- For each form, identify the current plugin/provider and a supported submission API or implement a narrowly scoped, permission-checked WordPress endpoint. Do not expose privileged API credentials in browser code.
- Keep WooCommerce checkout fields and payment submission on WooCommerce-supported APIs rather than treating checkout as an ordinary contact form.

## Event contract

- Use WordPress as the canonical content source. A webhook should carry a stable event ID, record type and ID, status, revision or modified time, and event time; fetch the current record from WordPress after receiving the event.
- Cover published pages, posts, products, taxonomies, media, menus, and SEO metadata. Also handle scheduled publication, unpublish, trash/delete, and slug changes.
- Do not publish draft, preview, autosave, private, or password-protected content to the public output.
- WordPress status hooks can run on an update where status is unchanged. Filter the desired public states and make processing idempotent.

## Queue and job processing

1. Persist public-content events in a durable WordPress database outbox; never keep the queue only in process memory.
2. Send a least-privilege authenticated `repository_dispatch` request to GitHub from the PHP MU-plugin. Keep the token in server-side WordPress configuration, outside public output.
3. Batch pending events and remove them from the outbox only after GitHub accepts the request. Retry failures through WP-Cron.
4. Fetch canonical WordPress state in the GitHub build rather than trusting event payloads as content.
5. Build and validate an isolated Eleventy artifact. Promote it only after all required route checks pass.
6. Keep build and deployment identifiers in GitHub Actions logs; scheduled reconciliation recovers from missed events.

## Recovery

- Run a scheduled full reconciliation against WordPress so a lost or malformed webhook cannot leave production stale indefinitely.
- Keep the previous successful artifact available for rollback.
- Use staging previews for editorial review when required; keep preview credentials and unpublished content private.
- Track freshness from WordPress modification through successful deployment. Acceptance of a GitHub dispatch means a workflow was queued, not that the frontend is live.

## Current implementation note

Current implementation: the WordPress MU-plugin queues public post types (including pages, articles and products), product metadata, public taxonomy, media, and menu changes in the WordPress options table. WP-Cron retries a batched authenticated `repository_dispatch` request to GitHub. The staging workflow performs a full canonical WordPress fetch, Eleventy build, route check, and atomic staging deployment, with a daily reconciliation build. Local development does not consume the publishing queue. Production still needs its own deployment environment and target.
