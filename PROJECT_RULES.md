<!--
 * This file is part of the CD2027 project.
 *
 * File: PROJECT_RULES.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-07
 *
 * Copyright © 2026 Christian Denat
-->

# Project rules

These rules adapt the relevant LGS1920 site conventions to the Christine Deloupy site. WordPress remains the editorial and transaction backend; Eleventy owns the public visual interface, including dynamic-flow screens where the required APIs support them.

## 1. Language and collaboration

- Use French in conversation unless the user requests another language.
- Write code comments, technical documentation, and skill instructions in professional English. Write public site content in French unless the owner requests another locale.
- Preserve unrelated staged, unstaged, and untracked changes. Do not reset, checkout, or delete user work.
- Do not commit, push, deploy, publish, or change WordPress or hosting configuration unless that action is part of the user's explicit request.
- State assumptions and unresolved product decisions clearly. Do not treat an implementation option as approved merely because it appears in an analysis.

## 2. Whole-site scope and URL contract

- Work across the entire site, not just the homepage. Before a migration or redesign, consult `docs/current-site-inventory.md`, refresh the WordPress route inventory, and classify every current route as an Eleventy route, an intentionally live backend route, a redirect, or an explicitly retired route.
- Preserve public slugs, trailing-slash behavior, canonical URLs, page titles, descriptions, Open Graph metadata, taxonomy relationships, publication dates, media, and internal links unless a change is requested.
- Keep a route and redirect map for every old URL. Never let a build silently omit a published page, article, product, category archive, legal page, or campaign landing page.
- A public sitemap is not the full route contract. Reconcile it with WordPress REST records, navigation links, commerce/account flows, forms, and any routes that require authentication or query parameters.
- Define build inclusion explicitly: retain records listed in the matching public sitemap or referenced by public internal links, navigation, or required site flows. Do not generate unrelated published records solely because the API returns them, and do not drop linked content solely because it is absent from a sitemap. Document deliberate exclusions and verify selected records against generated routes.
- Start each full build from a clean generated-output directory, or otherwise prove that removed or newly excluded routes cannot survive as stale files. Never clean source or user data as part of output cleanup.
- Audit internal links during whole-site route QA. Correct a stale destination when its current canonical replacement is unambiguous; otherwise report the broken link and leave the editorial destination unchanged until it is confirmed. Update links in source content or the adapter, never generated output.

## 3. WordPress and Eleventy responsibilities

- Treat WordPress as the editorial source of truth for published pages, posts, products, media, taxonomies, navigation, and SEO fields until the user approves a different model.
- Render the public interface with Eleventy across the site, including editorial pages, forms, and the complete WooCommerce order interface. Keep WordPress/WooCommerce as the content, session, order, payment, account, subscription, and course backend.
- Render cart, account, form, and other customer-specific data at runtime through supported APIs or a server-side adapter; never bake it into static output. Verify each payment gateway and plugin integration before implementation. If one requires a temporary WordPress-rendered or provider-hosted screen, record it as a visual exception and an integration task.
- Use `http://localhost:4555` as the immediate local frontend address when configuring or documenting development. It is not a production hosting decision.
- Use a server-side data adapter to fetch and normalize WordPress content for Eleventy. Keep WordPress credentials and API tokens on the server or build runner; never place them in browser code or public output.
- Treat `_site/` as generated output. Edit templates, data adapters, styles, and source assets under `src/` or the relevant project configuration, then rebuild.
- Do not assume serialized Gutenberg markup is a complete Eleventy rendering solution. Inventory core and plugin blocks, shortcodes, dynamic blocks, custom fields, and third-party embeds; implement and document an explicit renderer or integration for each required block family.
- Keep cart, checkout, payment, account, subscription, course, contact, and newsletter behavior connected to a functioning backend. Never replace a working transaction or form with a static visual copy.
- Preserve content identifiers and media relationships when synchronizing records. Handle deletes, unpublishes, slugs, and media changes explicitly.

## 4. Visual system and assets

- Keep all authored CSS in external stylesheets. Do not emit `<style>` elements or `style` attributes, including imported WordPress content; extract block declarations into the generated external content stylesheet. Web Awesome encapsulated component styles are library internals.
- Build the custom theme in a focused source stylesheet and give project-owned design variables the `--cd2027--` prefix.
- Keep all `--cd2027--*` theme values in source-controlled code; WordPress is not an editing surface for these variables.
- Capture the current WordPress design across page families and desktop/mobile viewports before claiming visual parity. Reuse approved logo, font, and image assets where available, and preserve their licensing and alternative text.
- Define the WordPress-derived source values as `--cd2027--*` tokens, then map Web Awesome semantic `--wa-*` tokens to them. Keep page styles on these shared tokens instead of scattering independent colors, typefaces, spacing, radii, or shadows.
- Treat Web Awesome as the required component, layout, and theming system for every project-authored template and client-rendered interface. Whenever Web Awesome has a suitable equivalent that preserves the behavior, accessibility, and intent of a UI element, use that element instead of a native control or another component library. Use Web Awesome for navigation menus, cards, buttons and links that act as controls, badges, breadcrumbs, dividers, inputs, selects, textareas, checkboxes, radios, dialogs, and other matching UI. Do not add visible native `<button>`, `<input>`, `<select>`, or `<textarea>` controls where a Web Awesome component exists; hidden transport fields may remain native. Keep semantic document structure such as headings, paragraphs, articles, lists, forms, and navigation landmarks as HTML, and preserve imported editorial HTML when converting it would damage its authored layout.
- Use Web Awesome's documented elements, slots, attributes, CSS parts, design tokens, and layout utilities. Use semantic HTML and focused custom CSS for editorial layouts that need a precise match, but compose their controls from Web Awesome components. Do not distort a page to fit a component.
- When converting imported WordPress button blocks to `<wa-button>`, preserve the enclosing block's source appearance and state colors (including fill/outline, border, text, and hover); do not flatten every button to one Web Awesome appearance.
- All `<wa-button>` components use the same font family. Their other typographic properties and visual appearance, including size, weight, colors, fill/outline, borders, and hover states, may vary by context.
- Maintain a project-owned `wa-theme-cd2027` theme and `wa-palette-cd2027` palette with both `wa-light` and `wa-dark` schemes. Define the source palette, typography, spacing, surfaces, borders, component states, and hover colors in version-controlled CSS using `--cd2027--*` variables, then map those values to Web Awesome's `--wa-*` theme tokens. Default to the saved user preference or operating-system color-scheme preference, provide an icon-only Web Awesome theme selector in a popover, and persist the selected system, light, or dark mode. Keep theme variables out of WordPress.
- Treat Web Awesome as the component, layout, and theming system. All icons used on the site must come from Font Awesome, including icons in buttons, navigation, and forms; do not introduce another icon library, hand-drawn icon SVGs, or emoji substitutes.
- Use Font Awesome through the project's supported local package or kit configuration. Do not substitute icons for the existing logo or decorative artwork.
- Apply the scoped WordPress-to-Web-Awesome translation rules in [`docs/design-rules-catalog.md`](docs/design-rules-catalog.md). Project-wide invariants in this file take precedence; catalog entries may specialize block, page-family, and route behavior without weakening those invariants.
- Use the shared source `--cd2027--font-size-normal` for editorial paragraph text across pages and articles. Preserve each H1–H6 heading's authored size and explicit font weights. Keep form/control typography separate from editorial body copy.
- Keep the custom theme and page composition separate: shared tokens define the visual language, while templates reproduce the structure and image treatment of each WordPress page family.

- Give every full-alignment WordPress section (`group`, `columns`, `section`, or `cover`) the shared `--cd2027--section-surface-spacing` on its left and right at every viewport. On mobile, apply the same inset on all sides and the shared radius; use the shared horizontal inset and radius for the page hero and footer surface on every viewport. Frame the homepage welcome cover (`.rounded-on-mobile[data-cd-block='cover']`) with that same inset and radius at every viewport. Keep full-width colored sections rounded at every viewport and remove the desktop viewport breakout from full-alignment sections.
- When a full-alignment section or colored group, columns, section, or cover is immediately followed by another colored section, put the shared section-surface spacing below the first section. Remove the next colored section's top gap in that case so the separation is not doubled. Give the footer a bottom margin on every viewport and a top margin when the final content section is colored. Match the footer slot's background to the page background so the inset around its colored surface never shows white.

## 5. WordPress publishing and update pipeline

- Trigger public builds from validated public changes. Drafts, previews, autosaves, and private records must not reach the production frontend.
- A remote WordPress site cannot send a webhook directly to a developer's `localhost`. The WordPress MU-plugin keeps a durable outbox and, through WP-Cron, sends an authenticated GitHub `repository_dispatch` request; local frontend development does not consume publishing events.
- Treat dispatch events as change notifications, not as the content database. After accepting an authenticated event, fetch the canonical current WordPress records using server-side credentials.
- Keep the GitHub dispatch token in server-side WordPress configuration, never in public output. Use the WordPress database outbox, retry failed requests through WP-Cron, and keep a scheduled reconciliation build. Account for public post types (including pages and articles), WooCommerce products, scheduled publication, unpublish, delete, taxonomy, media, navigation, and SEO changes. The sender covers these WordPress content families and the GitHub workflow rebuilds from canonical public data.
- Acknowledge an event only after its job is safely recorded. Do not report a content change as deployed until the build and deployment complete.
- Build and validate into an isolated artifact, then promote it atomically. Keep the last successful release live when data fetching, rendering, validation, or deployment fails.
- Keep the WordPress outbox and deployment metadata out of public output. Avoid logging secrets or unnecessary personal data.

## 6. Code, content, and validation

### Source file headers

- Put the canonical CD2027 project header at the beginning of every maintained first-party text source, template, script, and documentation file whose syntax supports comments. Use the identity `Christian Denat`, `christian.denat@orange.fr`, and `Copyright © YYYY Christian Denat`.
- Use the neutral `wp-awesome` package header for `docs/reusable-wordpress-eleventy-content-pipeline.md`. The standalone package lives in its own `wp-awesome` repository with its own rules and skills; it must not inherit the CD2027 identity, domains, or personal email. CD2027 consumes `wp-awesome` from `chdenat/wp-awesome`; Bun's lockfile pins the resolved commit until a versioned package release is adopted.
- Match the comment delimiters to the language: block comments for JavaScript, TypeScript, CSS, and PHP; Nunjucks comments for `.njk`; HTML comments for HTML, Markdown, SVG, and XML; and `#` comments for shell, YAML, and similar configuration files.
- Preserve shebangs, XML declarations, HTML doctypes, and Eleventy front matter before the header. Strict JSON, generated output, caches, dependencies, vendored files, IDE-local files, and binary assets cannot or must not receive this header.
- `Created on` is the date of the first Git commit that introduced the file, falling back to today's date in `Europe/Paris` for a new file. `Last modified` is today's date in `Europe/Paris` when the file has a current change, or the latest commit date otherwise. Do not put a commit hash in the header.
- Install the repository pre-commit hook once with `bun run git:hooks:install`. It updates and stages headers only for supported staged files; it stops if one of those files also has unstaged edits. Use `bun run headers:update:all` to add or refresh headers across the current working tree, `bun run headers:check` to audit them, and `bun run test:file-headers` to test the syntax-specific updater.

- Clean text known to come from Microsoft Word, or containing identifiable Word HTML artifacts, before public rendering. Remove Word-specific classes and declarations (`Mso*`, `mso-*`), Office namespace tags and metadata, and redundant paste wrappers or formatting. Preserve the wording, accents, meaningful spacing, semantic headings, paragraphs, lists, emphasis, links, and intentional editorial formatting; do not infer Word provenance from typography alone. Apply the cleanup in source content or the WordPress data adapter, never directly in `_site/`.
- Follow the existing runtime and module conventions after checking `package.json`, the lockfile, and source configuration. The current working copy must be brought back into agreement before a clean build can be relied on.
- Document every developer-facing tool maintained in this repository—including scripts, CLI entry points, and automation workflows—in professional English. Explain its purpose, prerequisites, invocation, required arguments or environment variables, outputs, and notable side effects.
- Add JSDoc in English to every exported JavaScript function and to non-trivial internal functions that implement shared or non-obvious behavior. Describe relevant parameter and return types, errors, invariants, and side effects.
- Add concise English comments at critical code paths (“hot spots”) such as security boundaries, filesystem or network side effects, retries and cache fallbacks, content normalization, route selection, concurrency, and deployment promotion. Explain intent and invariants; do not restate obvious code.
- Group commits by coherent theme when commits are requested; keep unrelated fixes in separate commits and preserve existing user work.
- Use the Web Awesome documentation for the installed version before styling component internals. Map site tokens to supported Web Awesome design tokens and use documented CSS parts for shadow-DOM styling.
- Keep new source and documentation files focused. Never hand-edit generated pages to make a check pass.
- Use only commands that exist in the current package scripts. Before handoff, inspect the diff, check routes and links affected by the change, and report checks, warnings, and blockers accurately.
- For content changes, verify copy, metadata, media alt text, localized internal links if another locale is added, and route preservation. For visual changes, compare all affected page families at desktop and mobile sizes.

## 7. Handoff

- Summarize what changed, why, how it was checked, and which architecture decisions remain open.
- Link changed project files and the relevant route inventory or operational documentation.
- Do not imply that an automated WordPress-to-Eleventy deployment is active until a published-content event has completed the real fetch, build, validation, and deployment chain.
