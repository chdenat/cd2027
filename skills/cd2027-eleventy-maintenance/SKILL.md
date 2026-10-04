---
name: cd2027-eleventy-maintenance
description: Maintain CD2027 Eleventy data, Nunjucks templates, Web Awesome styling, Font Awesome assets, and production builds.
---

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
2. Check the route inventory and all other templates using the data or include before changing its shape.
3. Fetch WordPress data at build time through a server-side adapter. Do not make public visitors wait on a WordPress API request for each page view.
4. Paginate collection endpoints, keep record IDs and canonical URLs, preserve media and SEO fields, and make API failures visible to the build.
5. Select build records from both the matching public sitemap and references in public content, navigation, or required site flows. Sitemap membership alone must not omit linked records; API presence alone must not include unrelated records. Record fetched, selected, and excluded counts so route checks can verify coverage.
6. Ensure full builds cannot retain stale output for deleted or newly excluded routes. Clean only the generated output directory before a full build; never remove source files or hand-edit generated pages.
7. Keep content transformation explicit. Map supported Gutenberg blocks and extension output to documented renderers; fail or report clearly on unsupported data.
8. Use Web Awesome components and utilities for supported layout and controls, with the `--cd2027--*` tokens mapped to documented `--wa-*` tokens.
9. Use the imported Font Awesome icon definitions through the custom Web Awesome icon library. Add definitions to `scripts/fontawesome-icons.entry.js`, run `bun run build:icons`, and keep the private package token out of source control.
10. Run the real project build and inspect affected routes once the package manifest and scripts are restored to a reproducible state.

## Contact page and form styling

- The WordPress `/contact/` page is rendered through `wordpress-page.njk` with the `contact-page` class. Keep contact-specific layout rules scoped to that class in `src/assets/styles.css`; do not change the imported WordPress content to fix presentation.
- On desktop, align the contact details and form at the top. Keep each icon-and-text row left aligned, prevent the icon column from growing (`flex: 0 0 1.5rem`), use a small shared-token gap, and let long email text wrap. On mobile, stack the main columns while keeping each contact detail row horizontal.
- `forms.js` converts provider fields to Web Awesome controls after the form mounts. Style field hover and focus on the complete documented wrapper part (`input-wrapper`, `textarea-wrapper`, or `form-control-input` for a select), not the inner text-entry part; styling only the inner part can leave an inset strip. Keep hover distinct from keyboard focus.
- Forminator checkbox markup can retain a paragraph around `wa-checkbox`. Reset that paragraph's default margin and let hovering the paragraph activate the checkbox hover treatment as well as the paragraph surface.
- For these CSS changes, inspect Contact at desktop and mobile widths and check the full field surface, checkbox paragraph, hover state, and keyboard focus state. Do not edit `_site/` to adjust the result.

## Imported content normalization

- Preserve `<mark>` elements in `normalizeRenderedHtml()` and extract their inline and WordPress palette styles into generated rules scoped by a deterministic page-specific class. Keep the text and nested semantic HTML intact, and avoid global `<mark>` styling.
- Convert any element with a class beginning `callout-` into a Web Awesome `<wa-callout variant="brand" appearance="plain">`. Callout detection depends exclusively on classes; never infer a callout or its icon from geometry. Three-corner petal shapes remain images. If an authored class begins `callout-icon-`, use the suffix after `icon-` as the solid Font Awesome icon name. Preserve the source-authored callout width and meaningful content, remove empty WordPress spacer blocks and empty paragraphs inside the callout, reset inherited margins and padding to the shared callout spacing, and reset source text colors for readable callouts.
- Apply generic content borders to block surfaces, not the `<wa-button>` host; Web Awesome button borders belong on its `::part(button)` so imported WordPress border metadata cannot create a second outline.

## Homepage alignment

- Keep the homepage cover content aligned with WordPress's content-width token (`--cd2027--content-width`). Scope `wide` and `full` Gutenberg alignment rules to `.wordpress-home`; on desktop, `wide` uses `--cd2027--wide-width` and full-alignment sections keep the shared horizontal inset. Match desktop content width without adding another gutter, and keep Gutenberg columns at the site's 1rem block gap (`--cd2027--space-40`). Flex content defaults to WordPress's stretch alignment; center it only when requested in source. Keep the homepage flush to its testimonial section and avoid extra footer spacing after it; verify desktop and mobile layouts, including Mes bijoux.

## Mobile section surfaces

- Give every full-alignment WordPress `group`, `columns`, `section`, and `cover` the same horizontal inset at every viewport using `--cd2027--section-surface-spacing`; on mobile, use that inset on all sides and the shared radius. Keep full-alignment sections inset on desktop, and keep colored full-width sections rounded at every viewport. Apply the same horizontal inset and radius to the page hero and footer surface. Frame the homepage `.rounded-on-mobile[data-cd-block='cover']` welcome cover with the same inset and radius at every viewport.
- When a full-alignment section or colored group, columns, section, or cover is immediately followed by another colored section, place `--cd2027--section-surface-spacing` below the first section and clear the next section's top gap. Give the footer a bottom margin on all viewports and a top margin when the final content section is colored; match the footer slot background to the page background to prevent a white band. Keep section spacing scoped to surfaces rather than colored text or individual controls.

## Safety

- Preserve unrelated work and make scoped source changes.
- Do not fetch private WordPress data with credentials exposed in browser bundles or generated HTML.
- Do not weaken a failing build or omit content to make output appear successful.
- Report environment or WordPress API failures separately from template defects.
