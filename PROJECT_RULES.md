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
- Build the custom theme in a focused source stylesheet and give project-owned design variables the `--cd2026--` prefix.
- Keep all `--cd2026--*` theme values in source-controlled code; WordPress is not an editing surface for these variables.
- Capture the current WordPress design across page families and desktop/mobile viewports before claiming visual parity. Reuse approved logo, font, and image assets where available, and preserve their licensing and alternative text.
- Define the WordPress-derived source values as `--cd2026--*` tokens, then map Web Awesome semantic `--wa-*` tokens to them. Keep page styles on these shared tokens instead of scattering independent colors, typefaces, spacing, radii, or shadows.
- Treat Web Awesome as the required component, layout, and theming system for every project-authored template and client-rendered interface. Use its components for navigation menus, cards, buttons and links that act as controls, badges, breadcrumbs, dividers, inputs, selects, textareas, checkboxes, radios, dialogs, and other matching UI. Do not add visible native `<button>`, `<input>`, `<select>`, or `<textarea>` controls where a Web Awesome component exists; hidden transport fields may remain native. Keep semantic document structure such as headings, paragraphs, articles, lists, forms, and navigation landmarks as HTML, and preserve imported editorial HTML when converting it would damage its authored layout.
- Use Web Awesome's documented elements, slots, attributes, CSS parts, design tokens, and layout utilities. Use semantic HTML and focused custom CSS for editorial layouts that need a precise match, but compose their controls from Web Awesome components. Do not distort a page to fit a component.
- When converting imported WordPress button blocks to `<wa-button>`, preserve the enclosing block's source appearance and state colors (including fill/outline, border, text, and hover); do not flatten every button to one Web Awesome appearance.
- Maintain a project-owned `wa-theme-cd2026` theme and `wa-palette-cd2026` palette with both `wa-light` and `wa-dark` schemes. Define the source palette, typography, spacing, surfaces, borders, component states, and hover colors in version-controlled CSS using `--cd2026--*` variables, then map those values to Web Awesome's `--wa-*` theme tokens. Default to the saved user preference or operating-system color-scheme preference, provide an icon-only Web Awesome theme selector in a popover, and persist the selected system, light, or dark mode. Keep theme variables out of WordPress.
- Treat Web Awesome as the component, layout, and theming system. All icons used on the site must come from Font Awesome, including icons in buttons, navigation, and forms; do not introduce another icon library, hand-drawn icon SVGs, or emoji substitutes.
- Use Font Awesome through the project's supported local package or kit configuration. Do not substitute icons for the existing logo or decorative artwork.
- Use the shared source `--cd2026--font-size-normal` for editorial paragraph text across pages and articles. Preserve each H1–H6 heading's authored size and explicit font weights. Keep form/control typography separate from editorial body copy.
- Keep the custom theme and page composition separate: shared tokens define the visual language, while templates reproduce the structure and image treatment of each WordPress page family.

## 5. WordPress publishing and update pipeline

- Trigger public builds from validated public changes. Drafts, previews, autosaves, and private records must not reach the production frontend.
- A remote WordPress site cannot send a webhook directly to a developer's `localhost`; use local pull-based synchronization for development, or a temporary secured tunnel only when live webhook testing is needed.
- Treat webhooks as change notifications, not as the content database. After authenticating an event, fetch the canonical current WordPress records using server-side credentials.
- Use signed requests, a durable queue or job store, idempotent event handling, retries, and a scheduled reconciliation build. Account for publish, update, scheduled publication, unpublish, delete, taxonomy, media, navigation, and SEO changes.
- Acknowledge an event only after its job is safely recorded. Do not report a content change as deployed until the build and deployment complete.
- Build and validate into an isolated artifact, then promote it atomically. Keep the last successful release live when data fetching, rendering, validation, or deployment fails.
- Keep webhook storage and deployment metadata outside the public output. Limit event retention, avoid logging secrets or unnecessary personal data, and expose only health and authenticated webhook routes.

## 6. Code, content, and validation

- Clean text known to come from Microsoft Word, or containing identifiable Word HTML artifacts, before public rendering. Remove Word-specific classes and declarations (`Mso*`, `mso-*`), Office namespace tags and metadata, and redundant paste wrappers or formatting. Preserve the wording, accents, meaningful spacing, semantic headings, paragraphs, lists, emphasis, links, and intentional editorial formatting; do not infer Word provenance from typography alone. Apply the cleanup in source content or the WordPress data adapter, never directly in `_site/`.
- Follow the existing runtime and module conventions after checking `package.json`, the lockfile, and source configuration. The current working copy must be brought back into agreement before a clean build can be relied on.
- Use the Web Awesome documentation for the installed version before styling component internals. Map site tokens to supported Web Awesome design tokens and use documented CSS parts for shadow-DOM styling.
- Keep new source and documentation files focused. Never hand-edit generated pages to make a check pass.
- Use only commands that exist in the current package scripts. Before handoff, inspect the diff, check routes and links affected by the change, and report checks, warnings, and blockers accurately.
- For content changes, verify copy, metadata, media alt text, localized internal links if another locale is added, and route preservation. For visual changes, compare all affected page families at desktop and mobile sizes.

## 7. Handoff

- Summarize what changed, why, how it was checked, and which architecture decisions remain open.
- Link changed project files and the relevant route inventory or operational documentation.
- Do not imply that an automated WordPress-to-Eleventy deployment is active until a published-content event has completed the real fetch, build, validation, and deployment chain.
