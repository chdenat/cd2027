# Christine Deloupy — Bun starter

An Eleventy website powered end to end by Bun, Web Awesome and locally served Font Awesome assets.
The visual direction is inspired by the public structure of [christinedeloupy.fr](https://christinedeloupy.fr/):
soft blush tones, clay accents, editorial typography, women’s guidance, jewellery and journal sections.

## Quick start

```bash
bun install
bun run dev       # build the site and start Eleventy dev server
bun run build     # build Eleventy output and browser assets
bun run check     # run the production build check
bun run webhook   # start the Bun webhook receiver
```

The generated website is written to `_site/`.

## Project structure

- `src/index.njk` — homepage content
- `src/_includes/layouts/base.njk` — shared Eleventy layout and responsive header
- `src/assets/main.js` — browser entry point and Web Awesome component imports
- `src/assets/styles.css` — theme, layout and the central site color palette
- `.eleventy.js` — Eleventy configuration and local Font Awesome SVG copying
- `webhook/server.js` — HMAC-protected JavaScript webhook receiver for Bun
- `.env.example` — webhook configuration template

## Color system

All site colors are declared once in `src/assets/styles.css` under distinct `--site-color-*` variables.
The Web Awesome semantic tokens are mapped to those variables, so components and custom sections share
the same palette without scattering color values throughout the stylesheet.

Main palette variables:

- `--site-color-brand-deep` — primary clay/brown brand color
- `--site-color-brand-clay` — secondary terracotta accent
- `--site-color-brand-blush` — soft blush surface
- `--site-color-brand-on-deep` — text displayed on the dark brand color
- `--site-color-paper` — main paper background
- `--site-color-ink` and `--site-color-muted` — readable text levels
- `--site-color-rose-wash` / `--site-color-sand-wash` — supporting accents

To retheme the site, edit the `--site-color-*` declarations only. Do not add raw colors to individual
component rules.

## Webhook receiver

The receiver is a native Bun server. It does not poll the source website: a WordPress webhook sender
must POST the updated content to this project.

1. Copy the environment template and set a strong shared secret:

   ```bash
   cp .env.example .env
   ```

2. Start the receiver:

   ```bash
   bun run webhook
   ```

3. Configure the WordPress webhook sender with:

   - URL: `https://your-domain.example/webhooks/christine`
   - Method: `POST`
   - Content type: `application/json`
   - Header: `X-Webhook-Signature: sha256=<hex digest>`
   - Optional event header: `X-Webhook-Event: post.updated`

The signature is an HMAC-SHA256 digest of the exact raw JSON request body, using `WEBHOOK_SECRET`.
Valid events are stored as JSON files in `.data/webhooks/`, which is ignored by Git.

Available routes:

- `GET /health` — service health check
- `POST /webhooks/christine` — authenticated event ingestion

Example payload:

```json
{
  "event": "post.updated",
  "post": {
    "id": 42,
    "status": "publish",
    "url": "https://christinedeloupy.fr/example"
  }
}
```

Keep the receiver behind HTTPS, use a long random secret, and never commit `.env` or received event
files. The server rejects missing or invalid signatures and payloads larger than the configured limit.
