---
name: cd2027-site-content-maintenance
description: Maintain WordPress-managed content and preserve all public CD2027 routes, media, metadata, and functional page families.
---

# CD2027 site content maintenance

Use this skill for content or route work spanning WordPress records, Eleventy output, or both. Read `PROJECT_RULES.md` and `docs/current-site-inventory.md` first.

## Workflow

1. Check `git status --short` and preserve all existing user changes.
2. Identify the WordPress record, public URL, route family, taxonomies, media, metadata, and any form, commerce, account, or course dependency.
3. Treat WordPress as the editorial source of truth. Make ordinary copy and media changes in the CMS unless the user explicitly assigns that content to source files.
4. Confirm that the record is public before including it in production data. Keep drafts, previews, and private content out of the public build.
5. Preserve the published slug, canonical URL, existing links, media alternatives, taxonomy, date, and SEO fields unless the user asks for a change.
6. For a slug change or removal, add the approved redirect or retirement behavior to the route map.
7. Inspect the generated route after synchronization when a working CMS sync and build command are available. Never edit `_site/` by hand.
8. For route selection, compare the matching public sitemap with internal references from pages, posts, navigation, and required flows. Include referenced records even when absent from that sitemap; exclude unrelated records that are neither listed nor referenced, and record the reason for intentional exclusions.
9. Check internal links to affected content. Update an obsolete destination only when the canonical replacement is clear from the live site or approved route map; ask for or record clarification when it is ambiguous. Make the change in the CMS when authorized or in the source adapter when that is the assigned source of truth.
10. After removing or excluding content, verify a clean build no longer serves its old output route and does not preserve stale generated files.

## Gutenberg and embedded behavior

- Do not assume every Gutenberg block is plain HTML. Identify static blocks, server-rendered blocks, extension blocks, shortcodes, forms, and media embeds before changing their rendering.
- Preserve the content and intent of unrecognized blocks and report unsupported behavior. Do not silently drop a block to make a page build.
- Keep commerce, subscription, payment, course, contact, and newsletter submissions connected to their active services.
- Do not copy private customer data, form submissions, or authenticated account data into static output.

## Text pasted from Microsoft Word

- Before importing or synchronizing editorial HTML, check for known Word provenance or identifiable paste artifacts such as `MsoNormal`, `mso-*`, or Office namespace markup. Apply the cleanup rule in [PROJECT_RULES.md](../../PROJECT_RULES.md#6-code-content-and-validation).
- When the artifacts are in WordPress-managed content, normalize them in the data adapter for public rendering; changing the live CMS still requires authorization under the project rules.
- Compare the cleaned content with the original to verify that text, heading levels, list structure, emphasis, links, and intentional formatting remain intact. Check the affected routes after rendering.

## Highlight markup

- Preserve HTML `<mark>` elements and their text during public content normalization.
- Extract each mark's inline and WordPress palette styles to generated CSS rules scoped by a deterministic page-specific class; remove the corresponding inline style and generic palette attributes from the rendered mark.
- Check that generated mark rules do not affect marks on other routes or leak into global theme styles.
