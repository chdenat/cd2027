/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/_lib/wordpress-site-profile.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

'use strict'

/**
 * Site-specific WordPress connection, content policy, route aliases, and editorial constants.
 * Credentials are read only in the Node.js build process and are never exported to browser assets.
 */

const { createApplicationPasswordAuthorization } = require('wp-awesome')

const wordpressOrigin = (process.env.WORDPRESS_ORIGIN || 'https://christinedeloupy.fr').replace(/\/$/, '')
const wordpressUrl = new URL(wordpressOrigin)
const wordpressUploadsPrefix = `${wordpressUrl.origin}${wordpressUrl.pathname.replace(/\/+$/, '')}/wp-content/uploads`
const siteOrigin = (process.env.SITE_URL || 'https://christinedeloupy.fr').replace(/\/$/, '')
const authorization = createApplicationPasswordAuthorization(
  process.env.WORDPRESS_API_USERNAME || '',
  process.env.WORDPRESS_API_APPLICATION_PASSWORD || '',
)
const sharedContentMode = process.env.WORDPRESS_CONTENT_MODE || 'auto'
const supportedBlockNames = [
  'core/audio',
  'core/button',
  'core/buttons',
  'core/code',
  'core/column',
  'core/columns',
  'core/cover',
  'core/details',
  'core/file',
  'core/gallery',
  'core/group',
  'core/heading',
  'core/image',
  'core/list',
  'core/list-item',
  'core/media-text',
  'core/paragraph',
  'core/pullquote',
  'core/preformatted',
  'core/quote',
  'core/separator',
  'core/spacer',
  'core/table',
  'core/verse',
  'core/video',
]

/** Resolves and validates the per-content-type conversion mode from server environment settings. */
function contentModeFor(type) {
  const environmentName = `WORDPRESS_${type.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_CONTENT_MODE`
  const mode = process.env[environmentName] || sharedContentMode
  if (!['auto', 'rendered', 'blocks'].includes(mode)) {
    throw new Error(`${environmentName} must be auto, rendered, or blocks.`)
  }
  if (mode === 'blocks' && !authorization) {
    throw new Error(`${environmentName}=blocks requires WORDPRESS_API_USERNAME and WORDPRESS_API_APPLICATION_PASSWORD.`)
  }
  return mode
}

const pageMode = contentModeFor('page')
const postMode = contentModeFor('post')

const sharedContentPolicy = {
  supportedBlockNames,
  blockRenderers: {},
  allowFreeform: false,
  sanitizerOptions: {
    additionalTags: ['wa-button', 'wa-callout', 'wa-icon'],
    additionalFontFamilies: ['Made Mirage', 'Great Vibes', 'Ibarra Real Nova', 'menu-font', 'text-font', 'button-font'],
    allowedCssVariables: [
      '--couleur-texte',
      '--texte-principal',
      '--wp--custom--gap--horizontal',
      '--wp--style--root--padding-left',
      '--wp--style--root--padding-right',
    ],
    allowedBackgroundImagePrefixes: [wordpressUploadsPrefix],
    additionalAttributes: {
      '*': [
        'data-cd-align', 'data-cd-align-items', 'data-cd-aligned-buttons', 'data-cd-appearance',
        'data-cd-background-color', 'data-cd-block', 'data-cd-border-color', 'data-cd-button-style',
        'data-cd-columns', 'data-cd-cropped', 'data-cd-cropped-images', 'data-cd-direction',
        'data-cd-duotone', 'data-cd-font-family', 'data-cd-font-size', 'data-cd-form',
        'data-cd-has-background', 'data-cd-has-border', 'data-cd-hide', 'data-cd-image-shape',
        'data-cd-inline-color', 'data-cd-justify', 'data-cd-layout', 'data-cd-link-color',
        'data-cd-link-color-value', 'data-cd-media-id', 'data-cd-media-provider', 'data-cd-media-type',
        'data-cd-mobile-align-items', 'data-cd-mobile-text-align', 'data-cd-mobile-stack', 'data-cd-multiple-rows',
        'data-cd-overlay-opacity', 'data-cd-resized', 'data-cd-role', 'data-cd-style',
        'data-cd-text-align', 'data-cd-text-color', 'data-cd-wrap', 'data-form-id',
      ],
      'wa-button': ['href', 'target', 'rel', 'appearance', 'variant', 'size', 'type', 'name', 'value', 'disabled'],
      'wa-callout': ['appearance', 'variant'],
      'wa-icon': ['slot', 'library', 'name', 'variant', 'family'],
    },
  },
}

/** Builds edit-context and public-fallback flags for the selected WordPress content mode. */
function contentTypePolicy(mode) {
  return {
    ...sharedContentPolicy,
    mode,
    requestEditContext: mode !== 'rendered' && Boolean(authorization),
    allowPublicFallback: mode === 'auto' && Boolean(authorization),
  }
}

module.exports = {
  wordpressOrigin,
  siteOrigin,
  apiOrigin: `${wordpressOrigin}/wp-json`,
  perPage: 100,
  sitemapNames: ['page', 'post', 'product', 'category', 'product_cat', 'author'],
  authorization,
  content: {
    default: { ...sharedContentPolicy, mode: 'rendered' },
    types: {
      page: contentTypePolicy(pageMode),
      post: contentTypePolicy(postMode),
      product: { mode: 'rendered' },
      'post-category': { mode: 'rendered' },
      'product-category': { mode: 'rendered' },
      navigation: { mode: 'rendered' },
    },
  },
  routes: {
    author: '/author/{slug}/',
  },
  internalRouteAliases: new Map([
    ['/std-boutique/', '/boutique/'],
    ['/seance-clarté/', '/seance-clarte/'],
    ['/inscrivez-vous-pour-une-seance-decouverte/', '/seance-clarte/'],
    ['/inscrivez-vous-pour-une-seance-clarte/', '/seance-clarte/'],
    ['/accompagnements/lecture-akashique/', '/mes-accompagnements/lecture-akashique/'],
    ['/accompagnements/', '/mes-accompagnements/'],
  ]),
  shopNavigationFallback: [
    { label: 'Boutique', href: '/boutique/' },
    { label: 'Panier', href: '/panier/' },
    { label: 'Retour', href: '/' },
  ],
  mediaUrlFallbacks: new Map([
    [
      `${wordpressOrigin}/wp-content/uploads/2022/09/Mon-cadeau-pour-toi.jpg`,
      `${wordpressOrigin}/wp-content/uploads/2022/09/Mon-cadeau-pour-toi-1.jpg`,
    ],
    [
      `${wordpressOrigin}/wp-content/uploads/2020/04/bel2-1500x2000.jpg`,
      `${wordpressOrigin}/wp-content/uploads/2020/04/20200406_174408-rotated.jpg`,
    ],
  ]),
  homePageId: 10343,
  blogPageSlug: 'mon-blog',
  blogArchivePageSize: 9,
  mainNavigationSlug: 'main-menu',
  shopNavigationSlug: 'boutique',
  footerNavigationTitle: 'Menu Bas de Page',
  testimonialsPageSlug: 'lecture-akashique',
}
