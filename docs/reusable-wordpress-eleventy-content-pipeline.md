# Reusable WordPress-to-Eleventy content pipeline

Status: architecture proposal; no implementation decision has been approved.
Reviewed: 4 October 2026.

## Recommendation

Extract the repeated WordPress fetching, content modeling, route selection, and Eleventy integration into a configurable library made of optional adapters. Keep each site's route rules, theme mapping, custom blocks, and exceptional content in a site profile.

The WordPress Gutenberg parser is a promising part of this design. The package to evaluate is [`@wordpress/block-serialization-default-parser`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-serialization-default-parser/). It parses serialized Gutenberg source into a tree of block names, attributes, nested blocks, and inner HTML. It does not fetch WordPress pages, render blocks, reproduce a theme, or replace the full content pipeline.

## Current implementation

[`src/_data/wordpress.js`](../src/_data/wordpress.js) currently combines these responsibilities:

- Fetch public WordPress REST collections, WooCommerce Store API collections, and Yoast sitemaps, with pagination and retries.
- Normalize pages, posts, products, and taxonomy terms into records used by Eleventy.
- Select generated records from sitemap membership and links found in selected content, then derive archives and route checks.
- Rewrite internal links and normalize WordPress, WooCommerce, Getwid, CoBlocks, and site-specific HTML.
- Extract navigation and footer data from the current WordPress front page and assemble the `wordpress` Eleventy data object.

Some of these are good library candidates, with configuration for the source origin and endpoint types. Others are current-site policy: canonical aliases, media fallbacks, the blog and home-page identities, CD2027 CSS tokens, custom callouts, and page-specific presentation rules. The module also keeps generated content CSS in a module-level map; a shared implementation should put that state in a per-build context.

The library must cover the whole site contract. The current inventory records editorial routes as well as products, archives, checkout, accounts, subscriptions, courses, forms, and legal pages. Dynamic customer and transaction data remains a runtime concern, not build-time content. See the [current route inventory](current-site-inventory.md), [initial architecture study](initial-architecture-study.md), and [WordPress runtime and publishing notes](wordpress-publishing-and-runtime.md).

## Gutenberg parser assessment

WordPress stores Gutenberg content as serialized markup in `post_content`. Block delimiters are HTML comments such as `<!-- wp:paragraph -->`; the official default parser turns that source into a block tree. The package can therefore replace custom code that tries to infer block boundaries from saved Gutenberg markup. It provides structure, not a finished public page. See the [parser package documentation](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-serialization-default-parser/) and [WordPress parser overview](https://developer.wordpress.org/block-editor/reference-guides/filters/parser-filters/).

The distinction between source and rendered output matters here. This repository currently normalizes `content.rendered` from public REST responses. The parser needs serialized block source. WordPress exposes `content.raw` in the REST response's edit context, which requires an authenticated build-time request; the REST controller documents the raw and rendered fields in its [response schema](https://developer.wordpress.org/reference/classes/wp_rest_posts_controller/prepare_item_for_response/). WordPress also explains why raw and rendered content differ: shortcodes and dynamic blocks can require server-side rendering, while a JavaScript consumer cannot render every block on its own ([REST content example](https://developer.wordpress.org/block-editor/how-to-guides/data-basics/3-building-an-edit-form/)).

Recommended content input model:

```text
ContentRecord
  identity: source, type, id, slug, canonical URL, status, modified time
  editorial: title, excerpt, rawContent?, renderedHtml
  relations: media, taxonomy, SEO fields
  provenance: source endpoint and selected route policy
```

Keep `rawContent` optional. Parse it to a block tree when a site can provide it. Keep WordPress-rendered HTML as a compatibility path for classic editor content, shortcodes, dynamic blocks, and plugins that have no configured renderer. Unknown blocks must remain visible in the output or produce a clear build report; they must not disappear silently.

For specific dynamic blocks, WordPress also documents a server-side [rendered block REST endpoint](https://developer.wordpress.org/rest-api/reference/rendered-blocks/). Treat that as an optional renderer adapter to investigate per block family. It does not make every plugin's surrounding page behavior portable.

### What the package can and cannot provide

| Capability | Parser package | Pipeline responsibility |
| --- | --- | --- |
| Recognize serialized Gutenberg block boundaries and nesting | Yes | Consume the returned tree. |
| Return a block's name, attributes, nested blocks, and inner HTML | Yes | Define renderers for supported block names. |
| Fetch pages, media, SEO data, or taxonomy | No | WordPress REST or plugin-specific source adapter. |
| Select which public records become Eleventy routes | No | Configurable route policy and route inventory checks. |
| Render dynamic/plugin blocks or shortcodes | No | Preserve server-rendered output or add an explicit renderer adapter. |
| Map block appearance to a site's theme and components | No | Site profile, tokens, and presentation renderers. |

## Proposed package boundaries

Keep the core independent of CD2027's CSS and templates. A site should opt into only the adapters it uses.

1. **WordPress source adapters** fetch REST records, media, taxonomies, menus, sitemaps, and optional WooCommerce data. Pagination, retries, authentication, and endpoint field selection belong here.
2. **Content model and route policy** normalize source records while retaining identifiers and source provenance. Sitemap inclusion, linked-record discovery, required routes, aliases, exclusions, and collision detection are configurable policies.
3. **Content transform pipeline** runs ordered steps over each record: Word cleanup where provenance is known, Gutenberg parsing when raw content exists, supported core and plugin block renderers, local-link/media normalization, and rendered-HTML fallback handling. Each step returns its content and any generated assets or diagnostics through an explicit per-build context.
4. **Eleventy adapter** exposes normalized records, collections, route metadata, and generated style rules through Eleventy's data cascade. Eleventy remains an optional integration around the content model so another static-site generator could reuse the source and transform layers.
5. **Site profile** supplies origins, content types, route policy, taxonomies, aliases, identity lookups, theme-token mappings, navigation rules, custom block renderers, and approved media fallbacks.

WooCommerce, Yoast, Forminator, MailPoet, and Gutenberg block families should be opt-in adapters. A site that only publishes pages and posts should not inherit commerce assumptions. The shared contracts should not expose CD2027 selectors or `--cd2027--*` variables.

## Migration sequence

1. Record the current data contract and representative outputs for every affected route family. Use the route inventory as the coverage checklist; include core blocks, extension blocks, classic HTML, shortcodes, forms, product content, and unsupported markup.
2. Add the Gutenberg parser as an alternate input path for a small fixture set. Compare its block tree and generated result with the existing rendered-HTML path. Keep current production output on the existing path until coverage is known.
3. Extract transport, entity normalization, route-policy helpers, and the Eleventy boundary in small steps. Keep `src/_data/wordpress.js` as the CD2027 composition layer while the generic package takes over neutral behavior.
4. Move CD2027 aliases, token mapping, custom renderers, and source-specific fallbacks into the site profile. Confirm route selection, links, metadata, media, and whole-site page families still satisfy the [project rules](../PROJECT_RULES.md).
5. Exercise the package from a second site configuration before publishing it as a stable shared package. That second consumer will reveal which options are true reusable contracts and which are accidental assumptions from CD2027.

## Decisions to resolve before implementation

- How should the build obtain serialized `content.raw`? An authenticated REST request uses the edit context and requires a server-side credential. Options include a narrowly permissioned WordPress account or a purpose-built read-only export endpoint that returns only approved public records. The current public-fetch build does not require this credential; adding it changes the data-access boundary.
- Which block families should be rendered from parsed source, and which should continue to use WordPress-rendered HTML? Inventory the live content before choosing the first renderer set.
- Should WooCommerce and form providers ship as separate optional packages, or as adapters in one package with optional dependencies?
- Should initial reuse use a local workspace/Git dependency, with package publication after a second consumer validates the API?
- Confirm the parser package's runtime/module compatibility with the repository's Bun and CommonJS Eleventy setup before adopting it.

## Acceptance conditions

- The library has no CD2027 brand tokens, route aliases, IDs, or content-specific assumptions in its core.
- Each build receives isolated configuration and transform state.
- The generated route set and canonical metadata remain traceable to WordPress source records and the configured inclusion policy.
- Supported blocks render explicitly; dynamic or unknown content uses a documented fallback or fails visibly.
- WordPress credentials stay in the build environment and never enter browser bundles, generated output, or public caches.
- The current site's generated content preserves its public routes and functional families, and a second site can opt into a different set of source and rendering adapters.

## Official WordPress references

- [Block Serialization Default Parser package](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-serialization-default-parser/)
- [Parser filters and serialized block content](https://developer.wordpress.org/block-editor/reference-guides/filters/parser-filters/)
- [WordPress REST post response fields](https://developer.wordpress.org/reference/classes/wp_rest_posts_controller/prepare_item_for_response/)
- [Raw and rendered content in an edited entity](https://developer.wordpress.org/block-editor/how-to-guides/data-basics/3-building-an-edit-form/)
- [Rendered Block REST API](https://developer.wordpress.org/rest-api/reference/rendered-blocks/)
