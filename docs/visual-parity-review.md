# Visual migration review

Reviewed on 2026-10-02 against the public WordPress site, including its rendered `/mon-blog/` template. This review covers shared rendering across the site and representative route families; it does not certify pixel-for-pixel parity of every route.

## Corrections

- Restore featured-image headers supplied by the WordPress theme outside REST content for pages, articles, and the blog. Reproduce the source duotone filter and white overlay using an external SVG asset and CSS. Keep a readable plain header when no featured image exists.
- Preserve the blog's authored category headings, three category images and links, and closing content. Render posts with Web Awesome cards, French dates, author attribution, excerpts, and pagination. The current configuration uses nine posts per archive page.
- Extract WordPress block declarations into `/assets/wordpress-content.css`; remove embedded CSS from generated HTML. Keep image geometry, paragraph backgrounds, and border radii. Map source palette and legacy variables to code-owned theme tokens, including dark-mode accents.
- Preserve cover opacity classes, heading color inheritance, and Web Awesome button part styling. Use a contrasting text token for button hover states in each color scheme.
- Restore the newsletter's 500px Getwid background area. Correct lazy-image attribute removal so `data-src` cannot damage `data-srcset`.
- Move gallery state to data/ARIA attributes and external CSS. Display only the first slide before initialization, then one active slide; no project JavaScript writes inline carousel CSS.
- Restore the footer from the rendered WordPress source: white logo, five social links, profile link, six navigation links, and legal links. Match its pink surface, gray typography, spacing, and mobile rounding; override Web Awesome footer-slot and button sizing where their defaults altered the layout.
- Reduce generic image-radius selector specificity so authored per-corner radii win. Paint Gutenberg image borders on the image rather than its figure wrapper.
- Match the source fluid typography and weights. Editorial page/article paragraphs use the shared normal size and default weight 400; authored emphasis remains intact. Heading presets and explicit sizes/weights remain independent. Match default H1–H6 sizes, including the smaller H5/H6 defaults, and retain the blog's separate title, excerpt, and metadata typography.
- Remove fetched form wrappers' inline declarations as well as embedded stylesheets, preserving intentionally hidden fields with the HTML hidden attribute and external CSS.

## Validation

- `CD2026_ALLOW_PUBLIC_CACHE=1 bun run check`: passed, 261 public and paginated archive routes with the current nine-post archive configuration. The final run fetched a fresh public WordPress snapshot. An intermediate run exercised the cache fallback after a WordPress request timed out.
- Generated sitemap pages: no `<style>` blocks or `style` attributes. The extracted stylesheet has no undefined custom-property references.
- Browser checks: 12 routes at 1440px and 390px in light and dark schemes (48 combinations). No horizontal overflow or failed loaded images observed. Lazy images outside the viewport are not certified by this check.
- Routes sampled: homepage, blog and page 2, ritual category, contact, newsletter, gift, latest article, two legacy articles with literal colors, shop, and cart.
- Browser interaction checks: light/dark button hover colors, saved dark scheme after reload, and the jewelry gallery advancing from slide 0 to 1 with one visible slide and no inline carousel style.
- Independent Web Awesome design review: corrected hero gutters/radii, dark text contrast, unresolved legacy variables, and imported button radii applied only to the component host.
- Compared all four computed corner radii and border width/style/color for 21 images across seven routes against WordPress: no differences. Confirmed that image figures do not introduce an additional border.
- Typography reference at 1440px: paragraph 18.6px/400 with 22.32px line height; cover H1 54.2px/700; default H2 31.2px/600 and H3 23.4px/600. At 390px, paragraphs use 14.6625px/400. Explicit category-heading weight 700 is preserved.
- Additional footer and typography checks cover the blog, a service page, and an article at both viewport widths and in both schemes (12 combinations): no horizontal overflow, logo fully loaded, footer links present, and paragraph metrics consistent.

- Contact rendering checked at 1440px and 390px using a previously fetched backend response: six visible Web Awesome fields, consent retained, provider honeypot hidden, no embedded form CSS, and no horizontal overflow. Corrected nested-label conversion and the final form row's grid span. No form was submitted.

Web Awesome may apply its own runtime or shadow-DOM styles; the no-embedded-CSS rule covers project-authored HTML and styling. Backend transactions and form submission were not exercised during this visual pass. Existing media fallbacks remain for deleted WordPress attachments.
