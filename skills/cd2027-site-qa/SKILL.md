---
name: cd2027-site-qa
description: Validate all CD2027 page families, routes, visual fidelity, SEO, accessibility, and backend interactions.
---

# CD2027 site QA

Use this skill when checking the public site, the WordPress migration, or a published Eleventy build. Treat generated output and live user flows as the verification surface, not as editing targets.

## Required route coverage

1. Refresh `docs/current-site-inventory.md` and compare source records with generated routes.
2. Confirm every source page, article, product, category, archive, and legal URL is either generated, intentionally served by a live backend, redirected, or explicitly retired.
3. Investigate route discrepancies between the WordPress REST API, Yoast sitemaps, menus, and published output.
4. Check archive pagination, query and trailing-slash behavior, media URLs, and canonical links.
5. Compare fetched, selected, excluded, and generated record sets. Confirm sitemap records and internally referenced content are present, unrelated excluded records are absent, and a clean rebuild leaves no stale route files.
6. Crawl internal links across the generated site. When a broken or retired URL has a single clear canonical replacement, verify and correct the source or adapter mapping; when the target is uncertain, report it without guessing or changing editorial content.

## Visual and functional checks

- Compare each page family with the current WordPress reference at desktop and mobile viewports.
- On routes containing classes beginning `callout-`, confirm each element renders as a plain Web Awesome callout. Never infer callouts or icons from rounded geometry; for authored `callout-icon-` classes, confirm the suffix after `icon-` selects that exact solid Font Awesome icon. Check that source-authored widths and readable text are preserved, empty WordPress spacers and paragraphs do not leave oversized gaps, and three-corner petal images remain images with their shape.
- Check typography, colors, layout, image crop, spacing, overlays, and responsive navigation against the approved design references.
- Across homepage, page, post, archive, and product routes, verify that all full-alignment sections keep the shared left/right inset on desktop and mobile; on mobile, confirm their all-side inset and radius. Check that the homepage welcome cover is framed and rounded at all widths, colored full-width sections and page heroes are rounded at every viewport, and the footer has a bottom margin plus a top margin when the final content section is colored. Confirm the footer's surrounding background matches the page background and shows no white band.
- On `/`, compare the cover and Gutenberg alignment gutters with WordPress: content uses `--cd2027--content-width` without an extra desktop gutter, `wide` uses `--cd2027--wide-width`, full-alignment sections keep the shared horizontal inset, and column gaps match the 1rem WordPress block gap. Check that default flex content stretches like Gutenberg, the KAELYA Talismans button has no duplicate outline, and no gray band remains between testimonials and the footer. Check `/mes-bijoux/` for the same column spacing and confirm the framed mobile gutters remain intact.
- On `/contact/`, confirm the details and form align at the top on desktop; icons sit at the top of their text rows; the icon column stays narrow; the email wraps without overlapping the form; and mobile keeps the detail rows horizontal while stacking the main columns.
- Inspect every contact field's hover and keyboard-focus states. Hover must affect the complete Web Awesome field wrapper; for the Forminator consent checkbox, hovering its paragraph wrapper must also activate the checkbox treatment. Check that the two-column name row stacks cleanly on narrow screens.
- Verify forms, consent, newsletter signups, product options, cart, checkout, payment results, accounts, subscriptions, and course access with a safe test flow.
- Check page titles, descriptions, canonical URLs, Open Graph metadata, sitemap entries, redirects, and robots rules.
- Check heading hierarchy, keyboard use, visible focus, labels, image alt text, and readable contrast.
- When multiple commits are requested, group changes by coherent theme and keep unrelated work out of each commit.
- Do not include customer records, live payment data, form submissions, or API secrets in QA artifacts.

## Reporting

Report the URL, route family, expected behavior, observed behavior, severity, and reproduction steps. Separate WordPress/service outages and unavailable authenticated test accounts from Eleventy regressions. Never modify `_site/` to make a check pass.
