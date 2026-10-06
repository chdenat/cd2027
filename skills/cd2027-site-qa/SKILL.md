---
name: cd2027-site-qa
description: Validate all CD2027 page families, routes, visual fidelity, SEO, accessibility, and backend interactions.
---
<!--
 * This file is part of the CD2027 project.
 *
 * File: skills/cd2027-site-qa/SKILL.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

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

- Read the applicable global, block/element, page-family, and route-specific entries in `docs/design-rules-catalog.md` before checking visual behavior. Report missing or conflicting entries instead of inferring an undocumented page-specific rule.
- Compare each page family with the current WordPress reference at desktop and mobile viewports.
- Check callouts against the catalog entry: confirm their plain Web Awesome rendering, prescribed icon mapping, source-authored width, readable text, removed spacer artifacts, and preserved three-corner petal imagery.
- Check typography, colors, layout, image crop, spacing, overlays, and responsive navigation against the approved design references.
- Check B-01, B-03, and B-04 on the homepage and affected editorial routes: compare generic text-color defaults, centered button groups, image aspect ratios and crops, vertical image alignment, and mobile petal width (90% of the full content column, independent of a desktop figure width).
- Across homepage, page, post, archive, and product routes, verify that all full-alignment sections keep the shared left/right inset on desktop and mobile; on mobile, confirm their all-side inset and radius. Check that the homepage welcome cover is framed and rounded at all widths, colored full-width sections and page heroes are rounded at every viewport, and the footer has a bottom margin plus a top margin when the final content section is colored. Confirm the footer's surrounding background matches the page background and shows no white band.
- On `/`, compare the cover and Gutenberg alignment gutters with WordPress: content uses `--cd2027--content-width` without an extra desktop gutter, `wide` uses `--cd2027--wide-width`, full-alignment sections keep the shared horizontal inset, and column gaps match the 1rem WordPress block gap. Check that default flex content stretches like Gutenberg, the KAELYA Talismans button has no duplicate outline, and no gray band remains between testimonials and the footer. Check `/mes-bijoux/` for the same column spacing and confirm the framed mobile gutters remain intact.
- For `/contact/`, run the F-05 and P-02 checks at desktop and mobile sizes. Use B-01 for the expected Web Awesome wrapper parts, separate hover/focus treatments, and consent-paragraph hover behavior; check the mobile name row as well.
- Verify forms, consent, newsletter signups, product options, cart, checkout, payment results, accounts, subscriptions, and course access with a safe test flow.
- Check page titles, descriptions, canonical URLs, Open Graph metadata, sitemap entries, redirects, and robots rules.
- Check heading hierarchy, keyboard use, visible focus, labels, image alt text, and readable contrast.
- When multiple commits are requested, group changes by coherent theme and keep unrelated work out of each commit.
- Do not include customer records, live payment data, form submissions, or API secrets in QA artifacts.

## Reporting

Report the URL, route family, expected behavior, observed behavior, severity, and reproduction steps. Separate WordPress/service outages and unavailable authenticated test accounts from Eleventy regressions. Never modify `_site/` to make a check pass.
