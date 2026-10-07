<!--
 * This file is part of the wp-awesome package.
 *
 * File: docs/reusable-wordpress-eleventy-content-pipeline.md
 *
 * Author: Christian Denat
 *
 * Created on: 2026-10-04
 * Last modified: 2026-10-07
 *
 * Copyright © 2026 Christian Denat
-->

# Reusable WordPress-to-Eleventy content package

Status: CD2027 consumes a verified local archive from the standalone package checkout; the package itself has not been published as a registry release.
Reviewed: 4 October 2026.

## Product boundary

The package should let a site connect a WordPress REST API to Eleventy with configuration and small site-owned adapters. It should not guess a site's theme, layout, permalink conventions, plugin behavior, or editorial rules. Each consumer supplies its WordPress origin, authentication provider, endpoints, type-specific policies, routes, public custom fields, renderers, and record-selection rules.

The package core now contains a paginated REST client, renderer-neutral record contracts, author and taxonomy normalization, route resolution and collision checks, Gutenberg conversion policies, and an Eleventy global-data plugin. WooCommerce, Yoast sitemap, and form-reference support are separate opt-in subpaths. Site templates, styles, link rewriting, custom block rendering, commerce presentation, and form submission remain with the consuming project.

## Implemented package surface

The reusable library is the standalone `wp-awesome` package in [`chdenat/wp-awesome`](https://github.com/chdenat/wp-awesome). CD2027 depends on that GitHub repository; `bun.lock` records the exact resolved commit so a clean CI runner installs the same package snapshot. Its public entry points are exposed from the package root or optional subpaths:

| Package API | Responsibility |
| --- | --- |
| `createWordPressRestClient()` | REST requests, pagination, configurable headers/authentication, timeouts, transient retries, and optional edit-to-public fallback. |
| `normalizeWordPressRecord()` | Common page, post, and custom-type fields, Gutenberg diagnostics, author, taxonomy, media, route, and explicitly allowlisted custom fields. It omits the raw REST body and `content.raw`. |
| `normalizeWordPressAuthor()` and `collectWordPressAuthors()` | Normalize standard embedded WordPress authors and deduplicate them by user ID. Co-author plugins are not part of the core contract. |
| `normalizeWordPressTaxonomy()` | Normalize core or custom taxonomy terms and preserve their identity and route. |
| `createWordPressRouteResolver()` and `assertNoWordPressRouteCollisions()` | Configure routes by content type, derive Eleventy output paths, canonical URLs, and reject output collisions. |
| `resolveWordPressContentPolicy()` and `convertWordPressContent()` | Apply Gutenberg support and fallback rules per content type, with source and unsupported-block diagnostics. |
| `createWordPressEleventyPlugin()` | Register a site-owned asynchronous loader as Eleventy global data. The package remains usable without Eleventy. |
| `integrations/woocommerce` | Optional WooCommerce Store API collection adapter over the generic REST client. |
| `integrations/yoast` | Optional configurable sitemap transport and location parser. |
| `integrations/forms` | Optional form-reference collection through caller-provided plugin detectors; no form plugin is assumed. |

The REST client accepts a REST root and relative endpoint paths, so a custom post type exposed through `show_in_rest` can use its configured `rest_base` with the same pagination and normalization. A consumer chooses a stable type key, route, content policy, and allowlist for any public custom fields. Application Passwords are provided as a helper, while `getHeaders` allows another authentication scheme.

The normalizer keeps one standard WordPress `author` relation. `_embed=1` is needed to collect each author's public profile from post responses; authors are deduplicated by ID. The contract does not query the user directory or depend on co-author plugins. A site that needs a directory independent of selected posts can add a separately reviewed user-endpoint adapter.

## Gutenberg input and validation

The parser dependency is WordPress's official [`@wordpress/block-serialization-default-parser`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-serialization-default-parser/). It turns serialized Gutenberg source into nested block data. It does not fetch records, run shortcodes, load a site's registered blocks, reproduce a theme, or render dynamic blocks.

Each content type can define its own `mode`, supported block names, renderers, and freeform policy. `auto` uses serialized content only when the whole block tree is covered and otherwise selects server-rendered HTML with a reason. `rendered` always uses the REST `content.rendered` field. `blocks` fails if serialized source or renderer coverage is incomplete. The normalizer returns the selected HTML and diagnostic metadata without returning privileged `content.raw`.

WordPress exposes `content.raw` in edit context, which requires an authenticated build-time request. Public rendered HTML remains the compatibility path for dynamic blocks, shortcodes, classic content, and unsupported plugin blocks. [REST API authentication](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/), [REST response fields](https://developer.wordpress.org/reference/classes/wp_rest_posts_controller/prepare_item_for_response/), and [REST pagination](https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/) describe these source behaviors.

The package sanitizes returned title, excerpt, content, caption, author-description, and taxonomy-description HTML with a strict allowlist, including HTML returned by custom renderers. Custom fields remain selected data rather than safe HTML; validate their types, use normal template escaping, and sanitize them separately if rendering as markup.

## Example consumer configuration

The package API is independent of a site's content types. A small Eleventy consumer can fetch standard post types and a custom `projects` type, while opting into only the integrations it uses:

```js
const {
  createApplicationPasswordHeaders,
  createWordPressEleventyPlugin,
  createWordPressRestClient,
  createWordPressRouteResolver,
  normalizeWordPressRecord,
  resolveWordPressContentPolicy,
} = require('wp-awesome')

const policies = {
  default: { mode: 'rendered' },
  types: {
    page: { mode: 'auto', supportedBlockNames: ['core/paragraph', 'core/heading'] },
    post: { mode: 'auto', supportedBlockNames: ['core/paragraph', 'core/heading'] },
    project: { mode: 'rendered' },
  },
}

const rest = createWordPressRestClient({
  baseUrl: `${process.env.WORDPRESS_ORIGIN}/wp-json/`,
  getHeaders: ({ context }) => context === 'edit'
    ? createApplicationPasswordHeaders(process.env.WP_USER, process.env.WP_APP_PASSWORD)
    : {},
})
const routes = createWordPressRouteResolver({
  siteUrl: process.env.SITE_URL,
  routes: { page: '/{slug}/', post: '/articles/{slug}/', project: '/projects/{slug}/' },
})

async function loadWordPressData() {
  const definitions = [
    { type: 'page', endpoint: 'wp/v2/pages' },
    { type: 'post', endpoint: 'wp/v2/posts' },
    { type: 'project', endpoint: 'wp/v2/projects', customFields: ['subtitle'] },
  ]
  const collections = await Promise.all(definitions.map(async (definition) => {
    const policy = resolveWordPressContentPolicy(policies, definition.type)
    const records = await rest.getCollection(definition.endpoint, {
      params: { _embed: 1, status: 'publish' },
      ...(policy.mode !== 'rendered' ? { context: 'edit', allowPublicFallback: policy.mode === 'auto' } : {}),
    })
    return records.map((record) => normalizeWordPressRecord(record, {
      ...definition,
      contentPolicy: policy,
      routeResolver: routes,
    }))
  }))
  return { pages: collections[0], posts: collections[1], projects: collections[2] }
}

module.exports = (eleventyConfig) => {
  eleventyConfig.addPlugin(createWordPressEleventyPlugin({ loadData: loadWordPressData }))
}
```

The sample is a starting integration, not a universal publishing policy. Consumers should select records from their sitemaps, internal links, navigation, and required runtime routes; filter public status explicitly; and check their full route inventory after builds.

## Optional integrations

Integrations are imported explicitly from package subpaths. A pages-and-posts site does not need to load commerce or forms support. WooCommerce Store API fetching is kept separate from core editorial records. Yoast support parses locations but leaves sitemap names and HTTP transport to the consumer. Form support deduplicates references through supplied detectors; provider markup, validation, submission, consent, and anti-spam behavior remain plugin-specific.

SEO fields can differ between plugins, and a sitemap adapter alone does not normalize every SEO contract. Each consumer should provide an SEO adapter for its active plugin and preserve metadata such as title, description, canonical URL, social preview, and index policy. Likewise, the optional WooCommerce client only fetches Store API collections; cart, checkout, payment, accounts, and customer-specific data remain runtime integrations.

## Connecting a WordPress site

There is no package-wide site registration or lookup. Each consuming project creates a small adapter that supplies the connection details and calls the same public APIs:

1. Set the WordPress REST root from that site's build environment, such as `https://cms.example/wp-json/`.
2. Map each consumer-facing type to its REST endpoint. Core pages and posts use `wp/v2/pages` and `wp/v2/posts`; a custom type uses its configured `rest_base` under `wp/v2/`.
3. Provide an optional authentication callback. Build secrets stay in the build environment and never enter Eleventy output.
4. Define route templates, content policies, and an allowlist of public custom fields for each type.
5. Write a small loader that fetches the selected records, normalizes them, checks route collisions, and returns the data model expected by that site's templates.
6. Register that loader with `createWordPressEleventyPlugin()` and import only the optional integrations the project uses.

This boundary lets multiple projects use the package without sharing a WordPress account, route scheme, theme, cache format, or plugin stack. Site-specific navigation extraction, URL rewriting, presentation, and record selection remain in the consumer adapter until a stable, independently useful contract justifies adding them to the package.

The parser path must be checked against the consumer's actual WordPress responses. A build log should report `serialized-blocks` for the intended record types and useful per-record block diagnostics before claiming that authenticated raw Gutenberg parsing works. A public build may correctly report `rendered-html` when edit-context credentials are unavailable or raw content is not exposed.

## Standalone package and installation

The package repository now owns its manifest, Bun lockfile, MIT license, changelog, shared/project rules, local skills, Vite/Vitest/Eleventy toolchain, plugin ZIP builder, CI, GitHub Pages documentation, and version-tag npm/GitHub publication workflows. It exposes the same CommonJS functions under the unscoped `wp-awesome` name. Consumers keep site profiles, presentation and routing policy in their own projects.

CD2027 declares `"wp-awesome": "chdenat/wp-awesome"`. Run `bun add chdenat/wp-awesome` to update the package manifest and lockfile, review the resolved commit in `bun.lock`, then run `bun install --frozen-lockfile` and `bun run check`. Commit the manifest and lockfile together.

For another Bun consumer that needs a fixed release tag or commit, use:

```sh
bun add github:chdenat/wp-awesome#<tag-or-commit>
```

The GitHub dependency uses `require('wp-awesome')`, with optional `wp-awesome/integrations/*` subpaths. The package has not been published to npm; after a versioned release is published, consumers may use that registry version instead. See the standalone `README.md` and `docs-site/src/package-releases.md` for package release setup.

Staging verification remains necessary for the live WordPress plugin, hosting, token permissions, commerce and form flows. Local package tests do not establish that those external systems are configured.

## Acceptance conditions for a published product

- The published package contains no site brand, domain, route alias, theme token, fixed content ID, or workflow assumption.
- Every WordPress collection is paginated, auth is configurable, credentials remain outside browser output, and public fallback is explicit.
- Page, post, author, taxonomy, and custom-type contracts preserve source identity while excluding privileged raw content and unapproved metadata.
- Each content type can choose Gutenberg support and fallback policy; unsupported dynamic content remains visible through rendered HTML or produces an explicit failure.
- Route generation is configurable and collisions fail before a release can be promoted.
- WooCommerce, SEO, and forms remain optional subpaths or separately installable adapters.
- A second unrelated consumer can install the package without copying application code from its first consumer.

## Official WordPress references

- [Block Serialization Default Parser package](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-serialization-default-parser/)
- [Parser filters and serialized block content](https://developer.wordpress.org/block-editor/reference-guides/filters/parser-filters/)
- [WordPress REST post response fields](https://developer.wordpress.org/reference/classes/wp_rest_posts_controller/prepare_item_for_response/)
- [Embedding related REST resources](https://developer.wordpress.org/rest-api/using-the-rest-api/global-parameters/)
- [WordPress posts endpoint](https://developer.wordpress.org/rest-api/reference/posts/)
- [WordPress users endpoint](https://developer.wordpress.org/rest-api/reference/users/)
- [Custom post type REST API support](https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-rest-api-support-for-custom-content-types/)
- [WordPress REST API authentication](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/)
- [WordPress REST API pagination](https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/)
