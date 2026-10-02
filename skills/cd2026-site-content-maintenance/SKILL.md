---
name: cd2026-site-content-maintenance
description: Maintain WordPress-managed content and preserve all public CD2026 routes, media, metadata, and functional page families.
---

# CD2026 site content maintenance

Use this skill for content or route work spanning WordPress records, Eleventy output, or both. Read `PROJECT_RULES.md` and `docs/current-site-inventory.md` first.

## Workflow

1. Check `git status --short` and preserve all existing user changes.
2. Identify the WordPress record, public URL, route family, taxonomies, media, metadata, and any form, commerce, account, or course dependency.
3. Treat WordPress as the editorial source of truth. Make ordinary copy and media changes in the CMS unless the user explicitly assigns that content to source files.
4. Confirm that the record is public before including it in production data. Keep drafts, previews, and private content out of the public build.
5. Preserve the published slug, canonical URL, existing links, media alternatives, taxonomy, date, and SEO fields unless the user asks for a change.
6. For a slug change or removal, add the approved redirect or retirement behavior to the route map.
7. Inspect the generated route after synchronization when a working CMS sync and build command are available. Never edit `_site/` by hand.

## Gutenberg and embedded behavior

- Do not assume every Gutenberg block is plain HTML. Identify static blocks, server-rendered blocks, extension blocks, shortcodes, forms, and media embeds before changing their rendering.
- Preserve the content and intent of unrecognized blocks and report unsupported behavior. Do not silently drop a block to make a page build.
- Keep commerce, subscription, payment, course, contact, and newsletter submissions connected to their active services.
- Do not copy private customer data, form submissions, or authenticated account data into static output.

## Text pasted from Microsoft Word

- Before importing or synchronizing editorial HTML, check for known Word provenance or identifiable paste artifacts such as `MsoNormal`, `mso-*`, or Office namespace markup. Apply the cleanup rule in [PROJECT_RULES.md](../../PROJECT_RULES.md#6-code-content-and-validation).
- When the artifacts are in WordPress-managed content, normalize them in the data adapter for public rendering; changing the live CMS still requires authorization under the project rules.
- Compare the cleaned content with the original to verify that text, heading levels, list structure, emphasis, links, and intentional formatting remain intact. Check the affected routes after rendering.
