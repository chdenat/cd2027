---
name: cd2026-site-qa
description: Validate all CD2026 page families, routes, visual fidelity, SEO, accessibility, and backend interactions.
---

# CD2026 site QA

Use this skill when checking the public site, the WordPress migration, or a published Eleventy build. Treat generated output and live user flows as the verification surface, not as editing targets.

## Required route coverage

1. Refresh `docs/current-site-inventory.md` and compare source records with generated routes.
2. Confirm every source page, article, product, category, archive, and legal URL is either generated, intentionally served by a live backend, redirected, or explicitly retired.
3. Investigate route discrepancies between the WordPress REST API, Yoast sitemaps, menus, and published output.
4. Check archive pagination, query and trailing-slash behavior, media URLs, and canonical links.

## Visual and functional checks

- Compare each page family with the current WordPress reference at desktop and mobile viewports.
- Check typography, colors, layout, image crop, spacing, overlays, and responsive navigation against the approved design references.
- On `/contact/`, confirm the details and form align at the top on desktop; icons sit at the top of their text rows; the icon column stays narrow; the email wraps without overlapping the form; and mobile keeps the detail rows horizontal while stacking the main columns.
- Inspect every contact field's hover and keyboard-focus states. Hover must affect the complete Web Awesome field wrapper; for the Forminator consent checkbox, hovering its paragraph wrapper must also activate the checkbox treatment. Check that the two-column name row stacks cleanly on narrow screens.
- Verify forms, consent, newsletter signups, product options, cart, checkout, payment results, accounts, subscriptions, and course access with a safe test flow.
- Check page titles, descriptions, canonical URLs, Open Graph metadata, sitemap entries, redirects, and robots rules.
- Check heading hierarchy, keyboard use, visible focus, labels, image alt text, and readable contrast.
- Do not include customer records, live payment data, form submissions, or API secrets in QA artifacts.

## Reporting

Report the URL, route family, expected behavior, observed behavior, severity, and reproduction steps. Separate WordPress/service outages and unavailable authenticated test accounts from Eleventy regressions. Never modify `_site/` to make a check pass.
