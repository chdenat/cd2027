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
7. Use Font Awesome through the installed package or authorized kit. Keep frontend assets and font files in the generated output only when needed.
8. Run the real project build and inspect affected routes once the package manifest and scripts are restored to a reproducible state.

## Safety

- Preserve unrelated work and make scoped source changes.
- Do not fetch private WordPress data with credentials exposed in browser bundles or generated HTML.
- Do not weaken a failing build or omit content to make output appear successful.
- Report environment or WordPress API failures separately from template defects.
