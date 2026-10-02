---
name: cd2026-eleventy-maintenance
description: Maintain CD2026 Eleventy data, Nunjucks templates, Web Awesome styling, Font Awesome assets, and production builds.
---

# CD2026 Eleventy maintenance

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
5. Keep content transformation explicit. Map supported Gutenberg blocks and extension output to documented renderers; fail or report clearly on unsupported data.
6. Use Web Awesome components and utilities for supported layout and controls, with the `--cd2026--*` tokens mapped to documented `--wa-*` tokens.
7. Use the imported Font Awesome icon definitions through the custom Web Awesome icon library. Add definitions to `scripts/fontawesome-icons.entry.js`, run `bun run build:icons`, and keep the private package token out of source control.
8. Run the real project build and inspect affected routes once the package manifest and scripts are restored to a reproducible state.

## Contact page and form styling

- The WordPress `/contact/` page is rendered through `wordpress-page.njk` with the `contact-page` class. Keep contact-specific layout rules scoped to that class in `src/assets/styles.css`; do not change the imported WordPress content to fix presentation.
- On desktop, align the contact details and form at the top. Keep each icon-and-text row left aligned, prevent the icon column from growing (`flex: 0 0 1.5rem`), use a small shared-token gap, and let long email text wrap. On mobile, stack the main columns while keeping each contact detail row horizontal.
- `forms.js` converts provider fields to Web Awesome controls after the form mounts. Style field hover and focus on the complete documented wrapper part (`input-wrapper`, `textarea-wrapper`, or `form-control-input` for a select), not the inner text-entry part; styling only the inner part can leave an inset strip. Keep hover distinct from keyboard focus.
- Forminator checkbox markup can retain a paragraph around `wa-checkbox`. Reset that paragraph's default margin and let hovering the paragraph activate the checkbox hover treatment as well as the paragraph surface.
- For these CSS changes, inspect Contact at desktop and mobile widths and check the full field surface, checkbox paragraph, hover state, and keyboard focus state. Do not edit `_site/` to adjust the result.

## Safety

- Preserve unrelated work and make scoped source changes.
- Do not fetch private WordPress data with credentials exposed in browser bundles or generated HTML.
- Do not weaken a failing build or omit content to make output appear successful.
- Report environment or WordPress API failures separately from template defects.
