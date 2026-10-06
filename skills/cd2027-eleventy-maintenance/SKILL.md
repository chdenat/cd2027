---
name: cd2027-eleventy-maintenance
description: Maintain CD2027 Eleventy data, Nunjucks templates, Web Awesome styling, Font Awesome assets, and production builds.
---
<!--
 * This file is part of the CD2027 project.
 *
 * File: skills/cd2027-eleventy-maintenance/SKILL.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

# CD2027 Eleventy maintenance

Use this skill for page generation, WordPress data adapters, template and layout changes, theme work, asset handling, and build debugging.

## Current repository shape

- `src/` contains the Eleventy input, Nunjucks templates, global data, and frontend assets.
- `.eleventy.js` configures the current CommonJS Eleventy setup.
- `src/_data/` contains shared site data.
- `src/_includes/` contains reusable templates.
- `src/assets/` contains the browser entry point and styles.
- `_site/` is generated output and must never be edited directly.
- Check `package.json` and `bun.lock` before relying on an install or build command; the current working copy is not yet consistent.

## Workflow

1. Trace a route from its WordPress record or source data through the Eleventy data cascade, template, assets, and generated URL.
2. Check `PROJECT_RULES.md`, the applicable entries in `docs/design-rules-catalog.md`, the route inventory, and all other templates using the data or include before changing its shape. Record any new global, block, family, or route rule in the catalog.
3. Fetch WordPress data at build time through a server-side adapter. Do not make public visitors wait on a WordPress API request for each page view.
4. Paginate collection endpoints, keep record IDs and canonical URLs, preserve media and SEO fields, and make API failures visible to the build.
5. Select build records from both the matching public sitemap and references in public content, navigation, or required site flows. Sitemap membership alone must not omit linked records; API presence alone must not include unrelated records. Record fetched, selected, and excluded counts so route checks can verify coverage.
6. Ensure full builds cannot retain stale output for deleted or newly excluded routes. Clean only the generated output directory before a full build; never remove source files or hand-edit generated pages.
7. Keep content transformation explicit. Map supported Gutenberg blocks and extension output to documented renderers; fail or report clearly on unsupported data.
8. Prefer the suitable Web Awesome equivalent whenever one exists; use semantic HTML where Web Awesome has no suitable counterpart or conversion would damage content intent. Follow the catalog's component and scope rules, with `--cd2027--*` tokens mapped to documented `--wa-*` tokens.
9. Use the imported Font Awesome icon definitions through the custom Web Awesome icon library. Add definitions to `scripts/fontawesome-icons.entry.js`, run `bun run build:icons`, and keep the private package token out of source control.
10. Run the real project build and inspect affected routes once the package manifest and scripts are restored to a reproducible state.

## Contact page and form styling

- Implement the contact behavior in catalog entries F-05 and P-02. The WordPress `/contact/` page receives its `.contact-page` modifier in `wordpress-page.njk`; keep its CSS scoped to that root in `src/assets/styles.css` and do not change imported content for presentation.
- `forms.js` upgrades provider fields to Web Awesome controls after mount. Follow B-01 for field wrapper parts, hover/focus states, and consent-checkbox wrappers. Inspect Contact at desktop and mobile widths; never edit `_site/` to adjust the result.

## Imported content normalization

- Apply B-01, B-03, and B-04 for generic text-color defaults, image aspect ratios/crops, and source-generated Gutenberg container alignment. Extract safe block-support declarations before removing WordPress container classes. Keep petal figures unconstrained on mobile so the image's 90% width is calculated from the full available content width.
- Preserve `<mark>` elements in `normalizeRenderedHtml()` and extract their inline and WordPress palette styles into generated rules scoped by a deterministic page-specific class. Keep the text and nested semantic HTML intact, and avoid global `<mark>` styling.
- Follow the callout transformation and icon mapping in the design-rules catalog. Preserve source-authored widths and meaningful content, remove empty WordPress spacer blocks and paragraphs, and reset inherited spacing and text colors as defined there.
- Apply generic content borders to block surfaces, not the `<wa-button>` host; Web Awesome button borders belong on its `::part(button)` so imported WordPress border metadata cannot create a second outline.

## Homepage alignment

- Keep the homepage cover content aligned with WordPress's content-width token (`--cd2027--content-width`). Scope `wide` and `full` Gutenberg alignment rules to `.wordpress-home`; on desktop, `wide` uses `--cd2027--wide-width` within the available homepage frame and full-alignment sections keep the shared horizontal inset. Match desktop content width without adding another gutter, and keep Gutenberg columns at the site's 1rem block gap (`--cd2027--space-40`). Flex content defaults to WordPress's stretch alignment; center it only when requested in source. Keep the homepage flush to its testimonial section and avoid extra footer spacing after it; verify desktop and mobile layouts, including Mes bijoux.

## Mobile section surfaces

- Give every full-alignment WordPress `group`, `columns`, `section`, and `cover` the same horizontal inset at every viewport using `--cd2027--section-surface-spacing`; on mobile, use that inset on all sides and the shared radius. Keep full-alignment sections inset on desktop, and keep colored full-width sections rounded at every viewport. Apply the same horizontal inset and radius to the page hero and footer surface. Frame the homepage `.rounded-on-mobile[data-cd-block='cover']` welcome cover with the same inset and radius at every viewport.
- When a full-alignment section or colored group, columns, section, or cover is immediately followed by another colored section, place `--cd2027--section-surface-spacing` below the first section and clear the next section's top gap. Give the footer a bottom margin on all viewports and a top margin when the final content section is colored; match the footer slot background to the page background to prevent a white band. Keep section spacing scoped to surfaces rather than colored text or individual controls.

## Safety

- Preserve unrelated work and make scoped source changes.
- Do not fetch private WordPress data with credentials exposed in browser bundles or generated HTML.
- Do not weaken a failing build or omit content to make output appear successful.
- Report environment or WordPress API failures separately from template defects.
