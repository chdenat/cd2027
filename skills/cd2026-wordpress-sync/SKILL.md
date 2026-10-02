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

## Receiver and job processing

1. Accept only the intended HTTP method and route over HTTPS.
2. Verify the HMAC against the exact raw request body using a constant-time comparison. Include an event timestamp or nonce to reject replayed requests.
3. Validate the event schema and size before accepting the job.
4. Persist the job durably before returning success. Never acknowledge an event that only exists in process memory.
5. Deduplicate by event ID and coalesce rapid changes by record type and ID without losing the latest revision.
6. Fetch canonical WordPress state using server-only, least-privilege credentials.
7. Build and validate an isolated Eleventy artifact. Promote it only after all required route and asset checks pass.
8. Record source revision, attempt count, error, build ID, and deployment ID; retry transient failures and surface exhausted jobs.

## Recovery

- Run a scheduled full reconciliation against WordPress so a lost or malformed webhook cannot leave production stale indefinitely.
- Keep the previous successful artifact available for rollback.
- Use staging previews for editorial review when required; keep preview credentials and unpublished content private.
- Track freshness from WordPress modification through successful deployment. A `202 Accepted` from the webhook receiver means a job was stored, not that the frontend is live.

## Current implementation note

The current Bun receiver checks an HMAC signature and stores request JSON files under `.data/webhooks/`. It defaults to `127.0.0.1`; it does not currently provide a durable worker queue, WordPress fetch, Eleventy build, retries, reconciliation, or deployment. Reassess the implementation against this skill before treating it as production automation.
