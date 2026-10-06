<!--
 * This file is part of the CD2027 project.
 *
 * File: docs/design-rules-catalog.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

# CD2027 rendering and design rules catalog

This catalog records how public WordPress content becomes the Eleventy and Web Awesome frontend. It complements, and does not replace, the project-wide invariants in `PROJECT_RULES.md`.

## Scope and precedence

Apply rules in this order:

1. `PROJECT_RULES.md` defines project-wide architecture, content, accessibility, security, and delivery invariants. A narrower rule cannot weaken them.
2. Global rules below define the default translation and visual behavior across the public site.
3. Block and element rules specialize a Gutenberg block, imported element, or frontend component wherever it appears.
4. Page-family rules specialize a shared template family such as editorial pages, articles, archives, products, or commerce flows.
5. Route-specific rules apply to one canonical URL and may refine component choice, translation, or styling only within that route.

When two applicable rules conflict, retain the project invariant and use the narrowest applicable translation or presentation rule. Record an intentional exception here and link it to the broader rule it refines. Do not silently copy a one-page fix into a global selector.

Skills describe how to inspect, implement, and validate work. They should link to this catalog rather than maintain a separate copy of the design decisions.

## Rule entry format

Add rules under the narrowest applicable scope. Give each rule an ID and record:

| Field | What to record |
| --- | --- |
| Scope | Global, block/element, page family, or exact route |
| Trigger | Source block, class, data attribute, component, or canonical route |
| Translation | The target HTML or Web Awesome component and its behavior |
| Preserve | Content, dimensions, metadata, interaction, or source styling that must remain |
| Styling | Token use and the narrowest stable CSS selector or route modifier |
| Responsive behavior | Expected desktop and mobile behavior |
| Validation | Representative routes and checks that prove the rule |
| Overrides | Any broader rule this entry intentionally refines |

Use stable `data-cd-block`, `data-cd-role`, component, template-family, or route-modifier selectors. Keep authored CSS external and token-based. If a page-specific scope does not exist, add an explicit stable modifier in the renderer or template; do not target page text, fragile child positions, or unrelated routes.

## Global translation rules

### G-01 — Preserve editorial meaning and behavior

Preserve source wording, semantic hierarchy, links, metadata, media relationships, meaningful dimensions, and working backend behavior. Keep headings, paragraphs, lists, articles, navigation landmarks, and other editorial/document structure as semantic HTML unless a suitable component is required for an interactive behavior.

### G-02 — Prefer the suitable Web Awesome equivalent

Whenever Web Awesome provides a suitable element or utility that preserves the source behavior, accessibility, and intent, use it instead of a native UI control or another component library. This applies to newly authored UI and to imported WordPress controls during translation. Use documented attributes, slots, CSS parts, and form semantics. Keep hidden transport inputs and semantic editorial HTML native; do not force a component where there is no suitable equivalent or where conversion would damage the content's meaning or authored layout.

### G-03 — Keep project styling in source-controlled CSS

Extract imported inline declarations into the generated WordPress content stylesheet. Keep project-authored styles in source stylesheets, use `--cd2027--*` tokens mapped to documented Web Awesome tokens, and scope styles according to the rule level. Never hand-edit `_site/` output.

### G-04 — Treat page families independently

Validate the homepage, editorial pages, articles, archives, products, commerce/account flows, forms, and legal pages as separate families. The homepage is not a proxy for the rest of the site. Consult `docs/current-site-inventory.md` when a change affects routes or shared rendering.

### G-05 — Preserve the WordPress header navigation treatment

Use Web Awesome buttons and dropdowns for the shared desktop header and mobile navigation. Preserve the source menu's Montserrat font weight of 400 and its 0.25em gap before submenu carets. Render an item with no child choices as a regular navigation link, not as an empty dropdown. Apply the same typography and caret spacing in both views; validate a standard route and a shop route at desktop and mobile widths.

## Block and element rules

### B-01 — WordPress controls

Translate buttons and links that act as controls to `<wa-button>` while preserving destination, source appearance, state colors, labels, and keyboard behavior. Convert supported visible form controls to their corresponding Web Awesome elements—for example, `wa-input`, `wa-number-input`, `wa-select`, `wa-textarea`, `wa-checkbox`, `wa-radio`, and `wa-radio-group`—while retaining names, values, validation, consent, and provider/backend behavior. Keep hidden transport fields native. For field states, style the complete documented Web Awesome wrapper part: `input-wrapper` for `wa-input`, `textarea-wrapper` for `wa-textarea`, and `form-control-input` for `wa-select`; keep hover and keyboard focus distinct. If a provider wraps `wa-checkbox` in a consent paragraph, make that paragraph's hover state visible and activate the checkbox hover treatment from it.

Preserve the generic `has-text-color` theme default (`text`) when no named palette or inline color is authored. A named color or explicit inline color takes precedence. Retain source-generated container alignment for button groups; on mobile, `center-children-on-mobile` centers the marked container's direct children, including its buttons.

### B-02 — Explicit callout signals and icons

Treat an explicit `callout-*` class as the current callout signal and render that element as `<wa-callout variant="brand" appearance="plain">`. A dedicated WordPress notification/callout block may also be mapped to `<wa-callout>`, but only after registering its exact block name and confirming its semantics. No dedicated notification/callout block is registered in the current WordPress source profile or present in the current public content snapshot. In particular, `core/quote` and `core/pullquote` remain editorial quotations; do not convert them based on their block type or appearance. Generic groups and color or corner geometry do not signal callouts. A `callout-icon-*` class selects the solid Font Awesome icon whose name is the exact suffix after `callout-icon-`; for example, `callout-icon-calendar-circle-exclamation` selects `calendar-circle-exclamation`. Other `callout-*` classes remain icon-free. Three-corner petal images remain images. Preserve source-authored callout width and content; remove empty WordPress spacer blocks and empty paragraphs; use the shared callout spacing and readable text colors.

### B-03 — Three-corner petal images

Keep three-corner petal artwork as images. Preserve its source corner geometry, width, aspect ratio, and crop on desktop. Retain aligned image figures and vertical column alignment. On mobile, let the figure span its available content width, then center the image at 90% of that width; do not calculate 90% inside a figure constrained by the desktop image width. Apply the authored aspect ratio and crop at every viewport.

### B-04 — Gutenberg container layouts

Keep safe `flex-direction`, `flex-wrap`, `align-items`, `justify-content`, and gap declarations from simple WordPress container rules in public block-support CSS. Extract them into the external content stylesheet before removing WordPress implementation classes; inline declarations retain precedence. Default vertical groups stretch; explicit left, center, and right justification applies to the horizontal axis of a vertical group. Flex children do not inherit flow margins; image alignment inside a flex group follows the group, while flow figures retain their own alignment. Stack Gutenberg columns below 782px, preserving the explicit `is-not-stacked-on-mobile` exception. Centering markers and the 90% petal treatment apply through 768px. Preserve mobile markers through stable data attributes. Do not copy arbitrary source selectors, nested at-rules, or positioning declarations into project CSS.

## Page-family rules

### F-01 — Homepage

Scope homepage composition to `.wordpress-home`. Preserve its WordPress content width, wide alignment, welcome cover, and testimonial/footer relationship. Limit desktop wide sections to the available homepage frame width, excluding the scrollbar, so they cannot introduce horizontal scrolling. On mobile, use the shared horizontal inset for uncolored content groups as well as the framed colored sections, without adding another desktop gutter. Keep home-only alignment fixes inside this scope; validate the homepage and at least one route from each affected non-home family when shared CSS changes.

### F-02 — Editorial pages and articles

Keep semantic article/page content in its source order. Preserve authored heading sizes and explicit weights, while applying the shared editorial body typography. Use the shared page-hero behavior and validate both a page and an article when changing common editorial styling.

### F-03 — Archives and product catalogs

Preserve category and archive content, pagination, route metadata, and links. Use Web Awesome cards and controls where the matching component preserves the content and action. Validate blog, category, and product archive routes separately from homepage layout.

### F-04 — Commerce and account flows

Use Web Awesome for matching public controls while keeping cart, checkout, payment, account, subscription, and course state connected to the WordPress/WooCommerce backend. Never replace a working transaction with a static visual copy.

### F-05 — Contact and forms

Use matching Web Awesome controls while preserving form names, values, validation, consent, provider behavior, and the connected backend. Scope layout differences to the route or form family that owns them; do not flatten distinct form layouts into a single global selector.

## Route-specific rules

Add one entry for a route only when its source structure or approved design requires a behavior that does not belong to its page family. Use the canonical trailing-slash route and a stable route modifier.

| ID | Route | Scope / modifier | Rule | Validation |
| --- | --- | --- | --- | --- |
| P-01 | `/` | `.wordpress-home` | Keep the welcome cover and Gutenberg alignment rules scoped to the homepage; preserve the homepage-specific testimonial/footer transition. | Desktop and mobile homepage plus affected shared families |
| P-02 | `/contact/` | `.contact-page` | Keep contact details and form top-aligned on desktop; use a fixed 1.5rem icon column and wrap long email text. On mobile, stack the main columns, retain horizontal detail rows, and stack the two-column name row. Apply B-01 to field-wrapper and consent hover/focus states. | Desktop and mobile contact page, including keyboard focus and hover |

Add a row only when a confirmed route-specific rule is needed; do not create empty exceptions for ordinary pages that follow their page-family rules.

## Adding or changing a rule

1. Identify the source trigger and every route family that uses it; check the current route inventory and source selectors.
2. Decide whether the rule is global, block/element-local, page-family, or route-specific. Choose the narrowest scope that covers the intended behavior.
3. Prefer a suitable Web Awesome element for UI controls. Preserve the source behavior and semantics, then record exceptions to conversion explicitly.
4. Implement CSS with shared tokens and a stable selector at the same scope as the rule. Do not use generated `_site/` files as an editing surface.
5. Add or update a focused transformation test where markup is translated. Add route QA for every affected family and desktop/mobile checks for visual changes.
6. Update this catalog and point the applicable skill at it. Keep `PROJECT_RULES.md` for invariants that must apply across the whole repository.
