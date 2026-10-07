/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/_lib/wordpress-data.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-07
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

const fs = require('node:fs')
const path = require('node:path')
const { createHash, randomBytes } = require('node:crypto')
const { decodeHTML } = require('entities')
const { fetchWithRetry } = require('./wordpress-fetch.js')
const {
  assertNoWordPressRouteCollisions,
  collectWordPressAuthors,
  convertWordPressContent,
  createWordPressRestClient,
  createWordPressRouteResolver,
  extractWordPressColorPalette,
  extractWordPressLinkColors,
  isSafeCssColorValue,
  normalizeWordPressRecord,
  normalizeWordPressTaxonomy,
  resolveWordPressContentPolicy,
  sanitizeWordPressHtml,
  toOutputPath,
} = require('wp-awesome')
const { createWooCommerceStoreApi } = require('wp-awesome/integrations/woocommerce')
const { createRetryingFetchText, createYoastSitemapIntegration } = require('wp-awesome/integrations/yoast')
const { collectFormReferences } = require('wp-awesome/integrations/forms')
const SITE_PROFILE = require('./wordpress-site-profile.js')
const SITE_HTML_SANITIZER_OPTIONS = SITE_PROFILE.content.default.sanitizerOptions
const WORDPRESS_ORIGIN = SITE_PROFILE.wordpressOrigin
const SITE_ORIGIN = SITE_PROFILE.siteOrigin
const API_ORIGIN = SITE_PROFILE.apiOrigin
const PER_PAGE = SITE_PROFILE.perPage
const CACHE_FILE = path.resolve(__dirname, '../..', '.data', 'wordpress-public-cache.json')
const sitemapFetchText = createRetryingFetchText({
  retries: 5,
  retryDelayMs: 5000,
  maxRetryDelayMs: 30000,
  maxRetryAfterMs: 120000,
  jitterRatio: 0.2,
  timeoutMs: 20000,
  onRetry: ({ status, nextAttempt, retries, delayMs, name }) => {
    const reason = status ? `HTTP ${status}` : 'a network error'
    console.warn(`[wordpress] Yoast ${name} sitemap returned ${reason}; retry ${nextAttempt}/${retries + 1} after ${delayMs}ms.`)
  },
})
const wordpressRoutes = createWordPressRouteResolver({ siteUrl: SITE_ORIGIN, routes: SITE_PROFILE.routes })
const wordpressRestClient = createWordPressRestClient({
  baseUrl: `${API_ORIGIN}/`,
  perPage: PER_PAGE,
  retries: 3,
  retryDelayMs: 500,
  timeoutMs: 20000,
  getHeaders: ({ context }) => context === 'edit' && SITE_PROFILE.authorization
    ? { Authorization: SITE_PROFILE.authorization }
    : {},
  onPublicFallback: ({ endpoint }) => console.warn(`[wordpress] Edit-context access failed for ${endpoint}; using public rendered content.`),
})
const wooCommerceStoreApi = createWooCommerceStoreApi({ restClient: wordpressRestClient })
const yoastSitemaps = createYoastSitemapIntegration({
  siteUrl: WORDPRESS_ORIGIN,
  sitemapNames: SITE_PROFILE.sitemapNames,
  fetchText: sitemapFetchText,
})

/**
 * Fetches a WordPress collection through the shared REST client with a type-specific context policy.
 * @param {string} endpoint REST path relative to the configured WordPress API root.
 * @param {string} _label Kept for caller diagnostics; the shared client formats its own errors.
 * @param {{params?: object, policy?: object}} [options] Query parameters and content-context policy.
 * @returns {Promise<object[]>} Collection records in WordPress order.
 */
async function fetchCollection(endpoint, _label, { params = {}, policy } = {}) {
  return wordpressRestClient.getCollection(endpoint, {
    params,
    context: policy?.requestEditContext ? 'edit' : undefined,
    perPage: PER_PAGE,
    allowPublicFallback: Boolean(policy?.allowPublicFallback),
  })
}

/** Converts rendered WordPress HTML and entities to normalized human-readable text. */
function textFromHtml(value = '') {
  return decodeHTML(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Escapes a string for a double-quoted HTML attribute emitted by the adapter. */
function escapeAttributeValue(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Keeps public attribute URLs on HTTP(S), resolving source-relative URLs against WordPress. */
function safePublicHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)) return null
  try {
    const parsed = new URL(value.trim(), WORDPRESS_ORIGIN)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null
    return parsed.href
  } catch {
    return null
  }
}

/** Resolves a WordPress URL to a local trailing-slash path, or returns null for another host. */
function localPath(url) {
  const parsed = new URL(url, WORDPRESS_ORIGIN)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null
  if (parsed.hostname.replace(/^www\./i, '').toLowerCase() !== new URL(WORDPRESS_ORIGIN).hostname.replace(/^www\./i, '').toLowerCase()) return null
  const pathname = decodeURI(parsed.pathname)
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

/** Fetches the sitemap families that define the current public route inventory. */
async function fetchPublicSitemaps() {
  const locations = await yoastSitemaps.load()
  return Object.fromEntries(Object.entries(locations).map(([name, urls]) => [name, new Set(urls.map((url) => {
    try {
      return localPath(url)
    } catch {
      return null
    }
  }).filter(Boolean))]))
}

/** Collects same-site destinations from navigable elements in source HTML. */
function collectInternalReferences(htmlValues) {
  const paths = new Set()
  for (const html of htmlValues) {
    for (const match of String(html || '').matchAll(/<(?:a|area|form|wa-button|wa-dropdown-item)\b[^>]*?(?:href|action|data-href)=(['"])(.*?)\1[^>]*>/gi)) {
      try {
        const destination = localPathOrExternal(decodeHTML(match[2]))
        if (!destination) continue
        const path = localPath(destination)
        if (path) paths.add(path)
      } catch {
        // Malformed and external links do not identify a local content route.
      }
    }
  }
  return paths
}

/** Adds a valid same-site destination to the route-reference set and ignores malformed input. */
function addLocalReference(paths, value) {
  if (!value) return
  try {
    const destination = localPathOrExternal(decodeHTML(value))
    if (!destination) return
    const path = localPath(destination)
    if (path) paths.add(path)
  } catch {
    // External and malformed links do not identify a local content route.
  }
}

/**
 * Selects records included by a sitemap or reachable from root/navigation/content links.
 * The fixed-point pass follows links in each newly selected record so linked public routes survive.
 * @param {object} options Public record groups, sitemap path sets, root HTML, links, and required paths.
 * @returns {{records: Record<string, object[]>, referencedPaths: Set<string>}} Selected records and links.
 */
function selectReferencedRecords({ recordGroups, sitemapNames, sitemaps, rootHtml, rootLinks, alwaysIncludePaths }) {
  const selected = Object.fromEntries(Object.entries(recordGroups).map(([kind]) => [kind, new Set()]))
  for (const [kind, records] of Object.entries(recordGroups)) {
    const sitemapPaths = sitemaps[sitemapNames[kind]]
    for (const record of records) {
      if (sitemapPaths?.has(record.path) || alwaysIncludePaths.has(record.path)) selected[kind].add(record)
    }
  }

  // Repeat until selection stops growing; selected records can reveal additional linked routes.
  let referencedPaths = collectInternalReferences(rootHtml)
  for (const href of rootLinks) addLocalReference(referencedPaths, href)
  let changed = true
  while (changed) {
    changed = false
    const activeRecords = Object.values(selected).flatMap((records) => [...records])
    const html = [
      ...rootHtml,
      ...activeRecords.flatMap((record) => [record.contentHtml, record.descriptionHtml, record.shortDescriptionHtml]),
    ]
    referencedPaths = collectInternalReferences(html)
    for (const href of rootLinks) addLocalReference(referencedPaths, href)
    for (const [kind, records] of Object.entries(recordGroups)) {
      for (const record of records) {
        if (!selected[kind].has(record) && referencedPaths.has(record.path)) {
          selected[kind].add(record)
          changed = true
        }
      }
    }
  }

  return {
    records: Object.fromEntries(Object.entries(selected).map(([kind, records]) => [kind, [...records]])),
    referencedPaths,
  }
}

/** Converts a public route to the directory-index file path used by Eleventy. */
function outputPath(pathname) {
  return toOutputPath(pathname)
}

/** Restores browser-facing image URLs from common WordPress lazy-loading attributes. */
function activateLazyImages(html) {
  const readAttribute = (tag, name) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = tag.match(new RegExp(`\\s${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
    return match ? match.slice(1).find((value) => value !== undefined) : null
  }
  const setAttribute = (tag, name, value) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const escapedValue = decodeHTML(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    const pattern = new RegExp(`\\s${escapedName}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i')
    if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${escapedValue}"`)
    const closing = tag.match(/\s*\/?\s*>$/)?.[0] || '>'
    return `${tag.slice(0, -closing.length)} ${name}="${escapedValue}"${closing}`
  }
  const removeAttribute = (tag, name) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return tag.replace(new RegExp(`\\s${escapedName}(?![\\w:-])(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, 'gi'), '')
  }

  return html.replace(/<img\b[^>]*>/gi, (image) => {
    const lazySrc = readAttribute(image, 'data-src')
    const actualSrc = readAttribute(image, 'src')
    if (lazySrc && (!actualSrc || /^data:image\//i.test(actualSrc))) {
      image = setAttribute(image, 'src', lazySrc)
    }
    const lazySrcset = readAttribute(image, 'data-srcset')
    if (lazySrcset && !readAttribute(image, 'srcset')) image = setAttribute(image, 'srcset', lazySrcset)
    const lazySizes = readAttribute(image, 'data-sizes')
    if (lazySizes && !readAttribute(image, 'sizes')) image = setAttribute(image, 'sizes', lazySizes)
    return ['data-src', 'data-srcset', 'data-sizes'].reduce(removeAttribute, image)
  })
}

/** Replaces a balanced div with a known ID, preserving surrounding serialized markup. */
function replaceElementById(html, id, placeholder) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const openPattern = new RegExp(`<div\\b(?=[^>]*\\bid=(['"])${escapedId}\\1)[^>]*>`, 'i')
  const opening = openPattern.exec(html)
  if (!opening) return html
  const start = opening.index
  let depth = 1
  const tags = /<\/?div\b[^>]*>/gi
  tags.lastIndex = start + opening[0].length
  let match
  while ((match = tags.exec(html))) {
    if (/^<\//.test(match[0])) depth -= 1
    else if (!/\/\s*>$/.test(match[0])) depth += 1
    if (depth === 0) return `${html.slice(0, start)}${placeholder}${html.slice(tags.lastIndex)}`
  }
  return html
}

/** Rewrites same-site WordPress URLs to this build's route aliases and preserves external URLs. */
function localPathOrExternal(value) {
  try {
    const parsed = new URL(value, WORDPRESS_ORIGIN)
    if (parsed.username || parsed.password) return ''
    if (['mailto:', 'tel:'].includes(parsed.protocol)) return parsed.href
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    const siteHostname = new URL(WORDPRESS_ORIGIN).hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== siteHostname) return parsed.href
    const path = decodeURI(parsed.pathname)
    const lookupPath = path.endsWith('/') ? path : `${path}/`
    return `${SITE_PROFILE.internalRouteAliases.get(lookupPath) || path}${parsed.search}${parsed.hash}`
  } catch {
    return ''
  }
}

/** Converts WordPress links and form actions to the Eleventy site's canonical local paths. */
function rewriteInternalLinks(html = '') {
  return html.replace(/<(a|area|form)\b[^>]*>/gi, (tag) => {
    const isForm = /^<form\b/i.test(tag)
    const expression = new RegExp(`(\\s${isForm ? 'action' : 'href'}=)(['"])(.*?)\\2`, 'i')
    const match = tag.match(expression)
    if (!match) return tag
    const rewritten = localPathOrExternal(decodeHTML(match[3]))
    const escaped = rewritten.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    return tag.replace(expression, `${match[1]}"${escaped}"`)
  })
}

/** Converts recognized WordPress button anchors and preserves the enclosing style variant. */
function convertWordPressButtonLinks(html, style = 'fill') {
  const appearance = style === 'outline' ? 'outlined' : 'filled'
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (tag, attributes, content) => {
    const classes = attributes.match(/\bclass=(['"])(.*?)\1/i)?.[2] || ''
    if (!/(?:^|\s)(?:wp-block-button__link|wp-element-button)(?:\s|$)/.test(classes)) return tag
    return `<wa-button data-cd-button-style="${style}" appearance="${appearance}" variant="brand"${attributes}>${content}</wa-button>`
  })
}

/** Converts core button wrappers while retaining the source fill or outline treatment. */
function convertWordPressButtons(html = '') {
  const ranges = []
  const openings = /<div\b[^>]*>/gi
  const divTags = /<\/?div\b[^>]*>/gi
  let opening

  while ((opening = openings.exec(html))) {
    const classes = opening[0].match(/\bclass=(['"])(.*?)\1/i)?.[2] || ''
    if (!/(?:^|\s)wp-block-button(?:\s|$)/.test(classes)) continue

    let depth = 1
    divTags.lastIndex = openings.lastIndex
    let closing
    while ((closing = divTags.exec(html))) {
      if (/^<\//.test(closing[0])) depth -= 1
      else if (!/\/\s*>$/.test(closing[0])) depth += 1
      if (depth === 0) {
        ranges.push({
          start: opening.index,
          openEnd: openings.lastIndex,
          closeStart: closing.index,
          closeEnd: divTags.lastIndex,
          style: /(?:^|\s)is-style-outline(?:\s|$)/.test(classes) ? 'outline' : 'fill',
        })
        break
      }
    }
  }

  for (const range of ranges.reverse()) {
    const content = convertWordPressButtonLinks(
      html.slice(range.openEnd, range.closeStart),
      range.style,
    )
    html = `${html.slice(0, range.openEnd)}${content}${html.slice(range.closeStart)}`
  }

  // Some custom blocks render the core button class without its standard wrapper.
  return convertWordPressButtonLinks(html, 'fill')
}

/** Converts imported native buttons to Web Awesome controls and labels gallery navigation. */
function convertNativeButtons(html = '') {
  return html.replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (_tag, attributes, content) => {
    const classes = attributes.match(/\bclass=(['"])(.*?)\1/i)?.[2] || ''
    const previous = /(?:^|\s)nav-button__prev(?:\s|$)/.test(classes)
    const next = /(?:^|\s)nav-button__next(?:\s|$)/.test(classes)
    const hasLabel = /\baria-label\s*=/.test(attributes)
    const label = previous ? 'Image précédente' : next ? 'Image suivante' : 'Action'
    const cleanedAttributes = attributes
    const icon = previous ? 'arrow-left' : next ? 'arrow-right' : null
    const inner = content.trim() && !/^<svg\b[^>]*>\s*<\/svg>$/i.test(content.trim())
      ? content
      : (icon ? `<wa-icon library="pro" name="${icon}" aria-hidden="true"></wa-icon>` : '')
    return `<wa-button appearance="plain"${cleanedAttributes}${hasLabel ? '' : ` aria-label="${label}"`}>${inner}</wa-button>`
  })
}

/** Maps imported Font Awesome class markup to the project's registered Web Awesome icon library. */
function convertFontAwesomeIcons(html = '') {
  return html.replace(/<i\b([^>]*)>[\s\S]*?<\/i>/gi, (tag, attributes) => {
    const classes = attributes.match(/\bclass=(['"])(.*?)\1/i)?.[2]?.split(/\s+/) || []
    const iconName = classes.find((className) => /^fa-[a-z0-9-]+$/i.test(className) && !/^fa-(?:solid|regular|brands|light|thin|duotone|fw|lg|xs|sm|[0-9]+x|spin|pulse|flip-.*|rotate-.*)$/i.test(className))
      ?.replace(/^fa-/i, '')
    if (!iconName) return tag

    const family = classes.some((className) => ['fab', 'fa-brands'].includes(className)) ? 'brands' : null
    const variant = classes.some((className) => ['far', 'fa-regular'].includes(className)) ? 'regular' : 'solid'
    const label = attributes.match(/\baria-label=(['"])(.*?)\1/i)?.[0]
    const ariaHidden = attributes.match(/\baria-hidden=(['"])(.*?)\1/i)?.[0]
    const passthrough = attributes
      .replace(/\s*aria-hidden=(['"])[^'"]*\1/i, '')
      .replace(/\s*aria-label=(['"])[^'"]*\1/i, '')
    const accessibleAttribute = label ? ` ${label}` : ariaHidden ? ` ${ariaHidden}` : ' aria-hidden="true"'
    return `<wa-icon${passthrough} library="pro" name="${iconName}" variant="${variant}"${family ? ` family="${family}"` : ''}${accessibleAttribute}></wa-icon>`
  })
}

/** Promotes known text-only plugin wrappers without moving nested block-level content. */
function convertWordPressContentDivs(html = '') {
  const semanticTags = new Map([
    ['wp-block-getwid-recent-posts__entry-meta', 'p'],
    ['wp-block-getwid-recent-posts__post-content', 'p'],
    ['wc-block-grid__product-title', 'h3'],
    ['wc-block-grid__product-price', 'p'],
  ])
  const replacements = []
  const openings = /<div\b[^>]*>/gi
  let opening

  while ((opening = openings.exec(html))) {
    const classes = opening[0].match(/\bclass=(['"])(.*?)\1/i)?.[2].split(/\s+/) || []
    const tagName = classes.map((className) => semanticTags.get(className)).find(Boolean)
    if (!tagName) continue

    const range = findElementRange(html, 'div', opening.index)
    if (!range) continue
    const inner = html.slice(range.openEnd, range.closeStart)
    // These known text blocks should contain only phrasing content. Leave any
    // unexpected nested block structure intact for a later explicit renderer.
    if (/<(?:div|p|h[1-6]|ul|ol|table|figure|blockquote|section|article|header|footer)\b/i.test(inner)) continue

    replacements.push({
      start: range.start,
      end: range.end,
      value: `${opening[0].replace(/^<div\b/i, `<${tagName}`)}${inner}</${tagName}>`,
    })
  }

  for (const replacement of replacements.reverse()) {
    html = `${html.slice(0, replacement.start)}${replacement.value}${html.slice(replacement.end)}`
  }
  return html
}

/** Maps legacy site-owned `cd-*` classes to the WordPress class contract. */
function normalizeLegacyWordPressClass(sourceClass) {
  return sourceClass
    .replace(/^cd-post-listing/, 'wp-block-getwid-recent-posts')
    .replace(/^cd-editorial-section/, 'wp-block-getwid-section')
    .replace(/^cd-spacer-advanced/, 'wp-block-getwid-advanced-spacer')
    .replace(/^cd-block-/, 'wp-block-')
    .replace(/^cd-commerce-/, 'wc-block-')
    .replace(/^cd-has-/, 'has-')
    .replace(/^cd-is-/, 'is-')
    .replace(/^cd-align/, 'align')
}

/** Maps known WordPress and legacy classes to the adapter's stable semantic data attributes. */
function semanticAttributesForWordPressClass(sourceClass) {
  const className = normalizeLegacyWordPressClass(sourceClass)
  const overlayOpacity = className.match(/^has-background-dim-(\d+)$/)
  if (overlayOpacity) return ['data-cd-overlay-opacity', overlayOpacity[1]]
  if (className.startsWith('wp-duotone-')) return ['data-cd-duotone', className.slice('wp-duotone-'.length)]

  const recentPostsPrefix = 'wp-block-getwid-recent-posts'
  if (className.startsWith(recentPostsPrefix)) {
    const part = className.slice(recentPostsPrefix.length).replace(/^__/, '')
    const roles = {
      post: 'post-card',
      'post-wrapper': 'post-wrapper',
      'post-thumbnail': 'post-thumbnail',
      'content-wrapper': 'post-content',
      'entry-header': 'post-header',
      'entry-meta': 'post-meta',
      'post-content': 'post-excerpt',
      'post-title': 'post-title',
      'post-date': 'post-date',
      'entry-footer': 'post-footer',
      'post-categories': 'post-categories',
      wrapper: 'posts-grid',
    }
    return part
      ? ['data-cd-role', roles[part] || part.replaceAll('__', '-')]
      : ['data-cd-block', 'recent-posts']
  }

  const sectionPrefix = 'wp-block-getwid-section'
  if (className.startsWith(sectionPrefix)) {
    const part = className.slice(sectionPrefix.length).replace(/^__/, '')
    const roles = {
      wrapper: 'section-wrapper',
      'inner-wrapper': 'section-inner',
      'background-holder': 'section-background-holder',
      background: 'section-background',
      foreground: 'section-foreground',
      content: 'section-content',
      'inner-content': 'section-inner-content',
      'background-image-wrapper': 'section-background-image',
    }
    return part
      ? ['data-cd-role', roles[part] || part.replaceAll('__', '-')]
      : ['data-cd-block', 'section']
  }

  if (className.startsWith('wp-block-getwid-advanced-spacer')) return ['data-cd-block', 'spacer']
  if (/^(?:wp-container-|wp-elements-|wp-custom-css-)/.test(className)) return null
  if (className === 'wp-post-image') return ['data-cd-role', 'post-image']
  const mediaId = className.match(/^(?:wp-image-|cd-image-)(\d+)$/)
  if (mediaId) return ['data-cd-media-id', mediaId[1]]

  const coverPart = className.match(/^(?:wp-block-cover|cd-block-cover)__(.+)$/)
  if (coverPart) {
    const roles = {
      'image-background': 'cover-image',
      background: 'cover-overlay',
      'inner-container': 'cover-content',
    }
    return ['data-cd-role', roles[coverPart[1]] || coverPart[1].replaceAll('__', '-')]
  }

  const blockLayout = className.match(/^(?:wp-block-|cd-block-).+-is-layout-(flow|flex|grid|constrained)$/)
  if (blockLayout) return ['data-cd-layout', blockLayout[1]]

  const commercePart = className.match(/^wc-block-grid__(.+)$/)
  if (commercePart) {
    const roles = {
      products: 'product-list',
      product: 'product-card',
      'product-link': 'product-link',
      'product-image': 'product-image',
      'product-title': 'product-title',
      'product-price': 'product-price',
      'product-add-to-cart': 'product-actions',
    }
    return ['data-cd-role', roles[commercePart[1]] || commercePart[1].replaceAll('__', '-')]
  }
  if (/^(?:wc-block-grid|wc-block-handpicked-products)$/.test(className)) return ['data-cd-block', 'product-grid']
  if (/^(?:wc-block-product-category|wp-block-woocommerce-product-category)$/.test(className)) return ['data-cd-block', 'product-category']
  if (/^(?:wp-block-woocommerce-handpicked-products)$/.test(className)) return ['data-cd-block', 'product-grid']
  if (className.startsWith('wc-block-')) return ['data-cd-role', className.slice('wc-block-'.length)]

  if (className === 'center-on-mobile') return ['data-cd-mobile-text-align', 'center']
  if (className === 'center-children-on-mobile') return ['data-cd-mobile-align-items', 'center']
  if (className === 'getwid-columns' || className === 'panel-grid') return ['data-cd-block', 'columns']
  const getwidColumns = className.match(/^getwid-columns-(\d+)$/)
  if (getwidColumns) return ['data-cd-columns', getwidColumns[1]]
  if (className === 'panel-grid-cell') return ['data-cd-block', 'column']
  if (className === 'panel-layout') return ['data-cd-layout', 'grid']
  if (className === 'coblocks-gallery') return ['data-cd-block', 'gallery']
  if (className === 'coblocks-gallery-carousel-swiper-container') return ['data-cd-role', 'gallery-viewport']
  if (className === 'coblocks-gallery--item') return ['data-cd-role', 'gallery-item']
  if (className === 'coblocks-gallery--figure') return ['data-cd-role', 'gallery-figure']
  if (className === 'coblocks-gallery--caption' || className === 'coblocks-gallery--primary-caption') return ['data-cd-role', 'gallery-caption']
  if (className === 'swiper-wrapper') return ['data-cd-role', 'carousel-track']
  if (className === 'swiper-slide') return ['data-cd-role', 'carousel-slide']
  if (className === 'layout-2-columns-title-background') return ['data-cd-style', 'two-column-title-background']
  if (className === 'siteorigin-widget-tinymce' || className === 'textwidget') return ['data-cd-role', 'widget-content']

  const block = className.match(/^(?:wp-block-|cd-block-)([a-z0-9-]+)(?:__(.+))?$/)
  if (block) {
    if (block[2]) return ['data-cd-role', block[2].replaceAll('__', '-')]
    return ['data-cd-block', block[1]]
  }
  if (/^(?:wp-|cd-container-|cd-elements-|cd-custom-css-)/.test(className)) return null

  const textAlignment = className.match(/^has-text-align-(left|center|right|justify)$/)
  if (textAlignment) return ['data-cd-text-align', textAlignment[1]]
  if (className === 'has-text-color' || className === 'has-link-color') return null
  if (className === 'has-border-color' || className === 'has-custom-border') return ['data-cd-has-border', 'true']
  const fontFamily = className.match(/^has-(.+)-font-family$/)
  if (fontFamily) {
    const families = {
      'great-vibes': 'script',
      'made-mirage': 'heading',
      'menu-font': 'menu',
      'text-font': 'body',
      'button-font': 'button',
    }
    return ['data-cd-font-family', families[fontFamily[1]] || fontFamily[1]]
  }
  const fontSize = className.match(/^has-(small|normal|medium|large|xl|x-large|xxl)-font-size$/)
  if (fontSize) return ['data-cd-font-size', fontSize[1]]
  const paletteName = (name) => ({ 'couleur-1': 'primary', 'couleur-2': 'secondary', 'couleur-3': 'tertiary', 'couleur-4': 'quaternary', 'couleur-5': 'text', 'couleur-texte': 'text' })[name] || name
  const backgroundColor = className.match(/^has-(.+)-background-color$/)
  if (backgroundColor) return ['data-cd-background-color', paletteName(backgroundColor[1])]
  const borderColor = className.match(/^has-(.+)-border-color$/)
  if (borderColor) return ['data-cd-border-color', paletteName(borderColor[1])]
  const textColor = className.match(/^has-(.+)-color$/)
  if (textColor && !['inline', 'link'].includes(textColor[1])) return ['data-cd-text-color', paletteName(textColor[1])]

  const layout = className.match(/^is-layout-(flow|flex|grid|constrained)$/)
  if (layout) return ['data-cd-layout', layout[1]]
  const verticalAlignment = className.match(/^(?:is|are)-vertically-aligned-(top|center|bottom|stretch)$/)
  if (verticalAlignment) return ['data-cd-align-items', verticalAlignment[1]]
  const justification = className.match(/^is-content-justification-(left|center|right|space-between)$/)
  if (justification) return ['data-cd-justify', justification[1]]
  const style = className.match(/^is-style-(.+)$/)
  if (style) return ['data-cd-style', style[1]]
  const alignment = className.match(/^align-?(left|right|center|wide|full|none)$/)
  if (alignment) return ['data-cd-align', alignment[1]]

  const hideOn = className.match(/^hide-on-(mobile|desktop)$/)
  if (hideOn) return ['data-cd-hide', hideOn[1]]
  if (className === 'is-nowrap') return ['data-cd-wrap', 'nowrap']
  if (className === 'is-vertical') return ['data-cd-direction', 'vertical']
  if (className === 'is-cropped') return ['data-cd-cropped', 'true']
  if (className === 'is-resized') return ['data-cd-resized', 'true']
  if (className === 'is-light') return ['data-cd-appearance', 'light']
  if (className === 'has-background') return ['data-cd-has-background', 'true']
  if (className === 'has-border-color' || className === 'has-custom-border') return ['data-cd-has-border', 'true']
  if (className === 'has-inline-color') return ['data-cd-inline-color', 'true']
  const mediaType = className.match(/^is-type-(.+)$/)
  if (mediaType) return ['data-cd-media-type', mediaType[1]]
  const mediaProvider = className.match(/^is-provider-(.+)$/)
  if (mediaProvider) return ['data-cd-media-provider', mediaProvider[1]]
  const columns = className.match(/^has-(\d+)-columns$/)
  if (columns) return ['data-cd-columns', columns[1]]
  if (className === 'has-multiple-rows') return ['data-cd-multiple-rows', 'true']
  if (className === 'has-aligned-buttons') return ['data-cd-aligned-buttons', 'true']
  if (className === 'is-not-stacked-on-mobile') return ['data-cd-mobile-stack', 'false']
  if (className === 'has-cropped-images') return ['data-cd-cropped-images', 'true']

  return null
}

/** Converts a saved Gutenberg preset reference or custom color to a safe adapter value. */
function gutenbergColorValue(value) {
  const color = String(value || '').trim()
  const preset = color.match(/^var:preset\|color\|([a-z0-9][a-z0-9-]*)$/i)
  if (preset) return { token: preset[1].toLowerCase() }
  return isSafeCssColorValue(color) ? { value: color } : null
}

/** Adds sanitizer-safe inline colors to markup reconstructed for one Gutenberg block. */
function transformGutenbergBlockColors({ block, innerHTML }) {
  const style = block.attrs?.style || {}
  const declarations = []
  const linkDeclarations = []
  const addColor = (sourceValue, property, target) => {
    const color = gutenbergColorValue(sourceValue)
    if (!color) return
    const value = color.token ? `var(--wp--preset--color--${color.token})` : color.value
    target.push(`${property}:${value}`)
  }

  addColor(style.color?.text, 'color', declarations)
  addColor(style.color?.background, 'background-color', declarations)
  addColor(style.border?.color, 'border-color', declarations)
  addColor(style.elements?.link?.color?.text, 'color', linkDeclarations)

  const addInlineStyles = (tag, addedDeclarations) => {
    if (!addedDeclarations.length) return tag
    let opening = tag
    const styleAttribute = /\sstyle=(['"])(.*?)\1/i.exec(opening)
    const existing = styleAttribute ? decodeHTML(styleAttribute[2]).trim().replace(/;+\s*$/, '') : ''
    const combined = [existing, ...addedDeclarations].filter(Boolean).join(';')
    if (styleAttribute) opening = opening.replace(styleAttribute[0], ` style="${escapeAttributeValue(combined)}"`)
    else opening = opening.replace(/\s*\/?\s*>$/, (closing) => ` style="${escapeAttributeValue(combined)}"${closing}`)
    return opening
  }

  let transformed = innerHTML.replace(/<[a-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/i, (tag) => addInlineStyles(tag, declarations))
  if (linkDeclarations.length) {
    transformed = transformed.replace(/<a(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/gi, (tag) => addInlineStyles(tag, linkDeclarations))
  }
  return transformed
}

/** Removes WordPress implementation classes and maps recognized semantics to stable data attributes. */
function normalizeWordPressMarkup(html = '', contentContext = {}, recordStyleContext = {}) {
  return html.replace(/<[a-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi, (tag) => {
    const classAttribute = /\sclass=(['"])(.*?)\1/i.exec(tag)
    if (!classAttribute) return tag

    const classNames = classAttribute[2].split(/\s+/).filter(Boolean)
    const semanticAttributes = new Map()
    for (const className of classNames) {
      const attribute = semanticAttributesForWordPressClass(className)
      if (attribute && !semanticAttributes.has(attribute[0])) semanticAttributes.set(attribute[0], attribute[1])
      const linkColor = recordStyleContext.elementLinkColors?.get?.(className)
      if (/^wp-elements-[a-z0-9][a-z0-9-]*$/i.test(className) && isSafeCssColorValue(linkColor || '') && !semanticAttributes.has('data-cd-link-color-value')) {
        semanticAttributes.set('data-cd-link-color-value', linkColor)
      }
    }

    // Gutenberg's generic text-color class has a theme default even without a named preset.
    const sourceStyle = /\sstyle=(['"])(.*?)\1/i.exec(tag)
    if (classNames.includes('has-text-color') && !semanticAttributes.has('data-cd-text-color') &&
      !/(?:^|;)\s*color\s*:/i.test(sourceStyle ? decodeHTML(sourceStyle[2]) : '')) {
      semanticAttributes.set('data-cd-text-color', 'text')
    }

    const layoutDeclarations = classNames
      .map((className) => recordStyleContext.blockLayoutStyles?.get?.(className))
      .filter(Boolean)
      .join(';')
    if (layoutDeclarations) {
      const declarations = [layoutDeclarations, sourceStyle ? decodeHTML(sourceStyle[2]) : ''].filter(Boolean).join(';')
      tag = sourceStyle
        ? tag.replace(sourceStyle[0], ` style="${escapeAttributeValue(declarations)}"`)
        : tag.replace(/\s*\/?\s*>$/, (closing) => ` style="${escapeAttributeValue(declarations)}"${closing}`)
    }

    const retainedClasses = classNames.filter((className) => {
      if (className === 'cd-form-mount') return true
      const normalizedClassName = normalizeLegacyWordPressClass(className)
      return !/^(?:wp-|wc-|has-|is-|align(?:left|right|center|wide|full|none)$|align-(?:left|right|center|wide|full|none)$|size-|attachment-|cd-container-|cd-elements-|cd-custom-css-|lazyload$)/i.test(normalizedClassName)
    })
    const replacement = retainedClasses.length
      ? ` class="${escapeAttributeValue(retainedClasses.join(' '))}"`
      : ''
    let normalized = tag.replace(classAttribute[0], replacement)
    if (classNames.includes('coblocks-gallery--item')) {
      normalized = normalized
        .replace(/\srole=(['"])button\1/i, ' role="group"')
        .replace(/\stabindex=(['"])-?\d+\1/i, '')
    }
    const existingAttributes = new Set([...normalized.matchAll(/\s(data-cd-[\w-]+)=/gi)].map((match) => match[1].toLowerCase()))
    const additions = [...semanticAttributes]
      .filter(([name]) => !existingAttributes.has(name.toLowerCase()))
      .map(([name, value]) => ` ${name}="${escapeAttributeValue(value)}"`)
      .join('')
    if (!additions) return normalized
    const closing = normalized.endsWith('/>') ? '/>' : '>'
    normalized = `${normalized.slice(0, -closing.length)}${additions}${closing}`
    return normalized
  }).replace(/font-family\s*:\s*(['"]?)(great-vibes|made-mirage|menu-font|text-font|button-font)\1/gi, (_match, _quote, family) => {
    const fonts = {
      'great-vibes': 'script',
      'made-mirage': 'heading',
      'menu-font': 'menu',
      'text-font': 'body',
      'button-font': 'button',
    }
    return `font-family:var(--cd2027--font-${fonts[family.toLowerCase()]})`
  }).replace(/--wp--preset--spacing--/g, '--cd2027--space-')
    .replace(/--wp--preset--color--([a-z0-9][a-z0-9-]*)/gi, (_match, rawSlug) => {
      const slug = rawSlug.toLowerCase()
      const palette = contentContext.wordpressColorPalette
      const hasPaletteValue = palette instanceof Map ? palette.has(slug) : Boolean(palette?.[slug])
      if (hasPaletteValue) return `--cd2027--wordpress-color-${slug}`
      const aliases = { 'couleur-1': 'primary', 'couleur-2': 'secondary', 'couleur-3': 'tertiary', 'couleur-4': 'quaternary', 'couleur-5': 'text' }
      return `--cd2027--color-${aliases[slug] || slug}`
    })
    .replace(/--wp--preset--font-family--great-vibes/g, '--cd2027--font-script')
    .replace(/--wp--preset--font-family--made-mirage/g, '--cd2027--font-heading')
    .replace(/--wp--preset--font-family--menu-font/g, '--cd2027--font-menu')
    .replace(/--wp--preset--font-family--text-font/g, '--cd2027--font-body')
    .replace(/--wp--preset--font-family--button-font/g, '--cd2027--font-button')
    .replace(/--wp--preset--font-family--/g, '--cd2027--font-')
    .replace(/--wp--preset--font-size--/g, '--cd2027--font-size-')
}

/** Extracts safe Gutenberg container layout declarations from public block-support styles. */
function extractWordPressBlockLayoutStyles(html = '') {
  const layouts = new Map()
  const properties = new Set(['flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap', 'row-gap', 'column-gap'])
  for (const style of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    let depth = 0
    let ruleStart = 0
    let bodyStart = 0
    let quote = ''
    let comment = false
    let nested = false
    for (let index = 0; index < style[1].length; index += 1) {
      const character = style[1][index]
      const next = style[1][index + 1]
      if (comment) {
        if (character === '*' && next === '/') { comment = false; index += 1 }
        continue
      }
      if (quote) {
        if (character === '\\') index += 1
        else if (character === quote) quote = ''
        continue
      }
      if (character === '/' && next === '*') { comment = true; index += 1; continue }
      if (character === '"' || character === "'") { quote = character; continue }
      if (style[1][index] === '{') {
        if (depth === 0) { bodyStart = index + 1; nested = false }
        else nested = true
        depth += 1
      } else if (style[1][index] === '}') {
        depth -= 1
        if (depth !== 0) continue
        const selector = style[1].slice(ruleStart, bodyStart - 1).replace(/\/\*[\s\S]*?\*\//g, '').trim()
        const body = style[1].slice(bodyStart, index).replace(/\/\*[\s\S]*?\*\//g, '')
        ruleStart = index + 1
        const className = /^\.(wp-container-[a-z0-9-]+)$/i.exec(selector)?.[1]
        // Nested at-rules and descendant selectors cannot become unconditional element styles.
        if (!className || nested) continue
        const declarations = body.split(';').filter((declaration) => properties.has(declaration.split(':')[0].trim().toLowerCase())).join(';')
        if (!declarations) continue
        const safeMarkup = sanitizeWordPressHtml(`<div style="${escapeAttributeValue(declarations)}"></div>`)
        const safeDeclarations = /\sstyle="([^"]*)"/i.exec(safeMarkup)?.[1]
        if (safeDeclarations) layouts.set(className, [layouts.get(className), decodeHTML(safeDeclarations)].filter(Boolean).join(';'))
      }
    }
  }
  return layouts
}

/** Builds a stable CSS scope class from a record's type, ID, slug, or route. */
function markPageClass(record = {}) {
  const pageIdentity = [record.kind || 'page', record.id || record.slug || record.path || 'home'].join(':')
  return `cd-mark-page-${createHash('sha256').update(pageIdentity).digest('hex').slice(0, 10)}`
}

/** Detects the authored three-corner petal image treatment so it is not mistaken for a callout. */
function hasThreeHalfRoundedCorners(declarations = '') {
  const cornerRadii = new Map()
  for (const match of declarations.matchAll(/(?:^|;)\s*border-(top|bottom)-(left|right)-radius\s*:\s*([^;]+)/gi)) {
    cornerRadii.set(`${match[1].toLowerCase()}-${match[2].toLowerCase()}`, match[3].trim())
  }
  if (cornerRadii.size !== 4) return false

  const isHalfRounded = (value) => {
    const radius = /^(\d+(?:\.\d+)?)(%|rem|px)$/i.exec(value.replace(/\s*!important\s*$/i, '').trim())
    if (!radius) return false
    const amount = Number(radius[1])
    const unit = radius[2].toLowerCase()
    // WordPress exports petal corners as oversized 10–20rem radii rather than percentages.
    return unit === '%' ? amount >= 50 : unit === 'rem' ? amount >= 10 : amount >= 160
  }

  return [...cornerRadii.values()].filter(isHalfRounded).length === 3
}

/** Removes only empty paragraph and spacer artifacts inside explicit callouts. */
function stripCalloutLayoutArtifacts(content = '') {
  const ranges = []
  for (const match of content.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const tagName = match[1].toLowerCase()
    const blockType = /\bdata-cd-block=(['"])(.*?)\1/i.exec(match[0])?.[2]?.toLowerCase()
    if (blockType === 'spacer') {
      const range = findElementRange(content, tagName, match.index)
      if (range) ranges.push(range)
    }
  }

  for (const match of content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const blockType = /\bdata-cd-block=(['"])(.*?)\1/i.exec(match[0])?.[2]?.toLowerCase()
    const visibleContent = match[1]
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/&nbsp;|&#160;/gi, '')
      .replace(/<br\s*\/?>/gi, '')
      .trim()
    if (blockType === 'paragraph' && !visibleContent) {
      ranges.push({ start: match.index, end: match.index + match[0].length })
    }
  }

  let normalized = content
  for (const range of ranges.sort((left, right) => right.start - left.start)) {
    normalized = `${normalized.slice(0, range.start)}${normalized.slice(range.end)}`
  }
  return normalized
}

/**
 * Converts elements with `callout-*` classes to Web Awesome callouts.
 * Only `callout-icon-<name>` supplies an icon; other callout classes remain icon-free.
 * @param {string} html WordPress-rendered content HTML.
 * @returns {string} Converted HTML with source content and attributes preserved.
 */
function convertClassedElementsToCallouts(html = '') {
  const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  const candidates = []
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const tagName = match[1].toLowerCase()
    if (tagName === 'wa-callout' || voidElements.has(tagName) || /\/\s*>$/.test(match[0])) continue

    const classAttribute = /\bclass=(['"])(.*?)\1/i.exec(match[0])
    if (!classAttribute) continue
    const classes = classAttribute[2].split(/\s+/).filter(Boolean)
    // Class prefix is the complete callout signal; visual geometry is not inferred here.
    if (!classes.some((className) => className.toLowerCase().startsWith('callout-'))) continue

    const iconClass = classes.find((className) => /^callout-icon-[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(className))
    const iconName = iconClass ? iconClass.slice('callout-icon-'.length).toLowerCase() : ''
    candidates.push({ start: match.index, tagName, iconName })
  }

  for (const candidate of candidates.reverse()) {
    const range = findElementRange(html, candidate.tagName, candidate.start)
    if (!range) continue
    const originalOpening = html.slice(range.start, range.openEnd)
    const originalClasses = /\bclass=(['"])(.*?)\1/i.exec(originalOpening)?.[2].split(/\s+/).filter(Boolean) || []
    const preservedAttributes = [...originalOpening.matchAll(/\s+(id|title|role|aria-[\w-]+|data-cd-[\w-]+)\s*=\s*("[^"]*"|'[^']*')/gi)]
      .filter((attribute) => !/^data-cd-(?:block|role)$/i.test(attribute[1]))
      .map((attribute) => `${attribute[1]}=${attribute[2]}`)
    const classes = [...new Set([...originalClasses, 'cd-callout'])].join(' ')
    const attributes = [...preservedAttributes, `class="${classes}"`].join(' ')
    const icon = candidate.iconName
      ? `<wa-icon slot="icon" library="pro" name="${candidate.iconName}" variant="solid" aria-hidden="true"></wa-icon>`
      : ''
    const opening = `<wa-callout appearance="plain" variant="brand" data-cd-block="callout" data-cd-role="callout" ${attributes}>${icon}`
    const content = stripCalloutLayoutArtifacts(html.slice(range.openEnd, range.closeStart))
    html = `${html.slice(0, range.start)}${opening}${content}</wa-callout>${html.slice(range.end)}`
  }
  return html
}

/** Accepts only the selector shapes generated by the content-style adapter. */
function isSafeCachedStyleSelector(selector) {
  const styleClass = String.raw`\.cd-content-style-[a-f\d]{12}\[class\]`
  return selector === ':root' ||
    new RegExp(`^:root ${styleClass}$`, 'i').test(selector) ||
    new RegExp(`^:root ${styleClass}, :root wa-button\\.cd-content-style-[a-f\\d]{12}\\[class\\]::part\\(button\\)$`, 'i').test(selector) ||
    new RegExp(`^:root ${styleClass} :where\\(a:not\\(\\.wp-element-button\\)\\)$`, 'i').test(selector) ||
    new RegExp(`^mark\\.cd-mark-page-[a-f\\d]{10}\\.cd-content-style-[a-f\\d]{12}\\[class\\]$`, 'i').test(selector)
}

/** Allows only stable theme tokens that the content normalizer can generate. */
function isSafeCachedStyleVariable(name, palette) {
  if (/^--cd2027--(?:color-[a-z\d-]+|font-[a-z\d-]+|space-[a-z\d-]+|page-padding-inline|editorial-color-[a-f\d]{3,8})$/i.test(name)) return true
  const wordpressColor = /^--cd2027--wordpress-color-([a-z\d-]+)$/i.exec(name)
  return Boolean(wordpressColor && palette[wordpressColor[1]] && isSafeCssColorValue(palette[wordpressColor[1]]))
}

/** Revalidates the cached CSS boundary instead of trusting rules from an older build. */
function sanitizeCachedContentStyleRules(cached) {
  const palette = Object.fromEntries(Object.entries(cached.wordpressColorPalette || {})
    .filter(([slug, color]) => /^[a-z\d][a-z\d-]*$/i.test(slug) && typeof color === 'string' && isSafeCssColorValue(color)))
  cached.wordpressColorPalette = palette
  const rootPaletteRule = wordpressColorPaletteRule(new Map(Object.entries(palette)))
  const safeRules = rootPaletteRule ? [rootPaletteRule] : []

  for (const rule of Array.isArray(cached.contentStyleRules) ? cached.contentStyleRules : []) {
    if (!rule || typeof rule.selector !== 'string' || rule.selector === ':root' || !isSafeCachedStyleSelector(rule.selector)) continue
    if (typeof rule.declarations !== 'string' || rule.declarations.length > 10000) continue
    const cssVariables = [...new Set([...rule.declarations.matchAll(/var\(\s*(--[a-z][a-z\d-]*)/gi)]
      .map((match) => match[1])
      .filter((name) => isSafeCachedStyleVariable(name, palette))) ]
    const safeHtml = sanitizeWordPressHtml(`<i style="${escapeAttributeValue(rule.declarations)}"></i>`, {
      additionalFontFamilies: SITE_HTML_SANITIZER_OPTIONS.additionalFontFamilies,
      allowedBackgroundImagePrefixes: SITE_HTML_SANITIZER_OPTIONS.allowedBackgroundImagePrefixes,
      allowedCssVariables: cssVariables,
    })
    const style = /\sstyle="([^"]*)"/i.exec(safeHtml)?.[1]
    const declarations = style ? decodeHTML(style).trim() : ''
    if (declarations) safeRules.push({ selector: rule.selector, declarations })
  }
  cached.contentStyleRules = safeRules
}

/** Normalizes navigation URLs stored in the previous public snapshot. */
function sanitizeCachedNavigation(items) {
  if (!Array.isArray(items)) return []
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const children = sanitizeCachedNavigation(item.items)
    const normalizedItem = {
      ...item,
      label: String(item.label || ''),
      href: localPathOrExternal(item.href) || '#',
    }
    if (children.length) normalizedItem.items = children
    else delete normalizedItem.items
    return [normalizedItem]
  })
}

/** Restores petal image markers and sanitizes HTML when serving an older public snapshot. */
function markPetalImagesInCachedMarkup(cached) {
  sanitizeCachedContentStyleRules(cached)
  cached.navigation = sanitizeCachedNavigation(cached.navigation)
  cached.shopNavigation = sanitizeCachedNavigation(cached.shopNavigation)
  cached.footerNavigation = sanitizeCachedNavigation(cached.footerNavigation)
  if (cached.footer && typeof cached.footer === 'object') {
    cached.footer.logo = safePublicHttpUrl(cached.footer.logo) || ''
    if (cached.footer.profileLink) {
      cached.footer.profileLink = {
        ...cached.footer.profileLink,
        label: String(cached.footer.profileLink.label || ''),
        href: localPathOrExternal(cached.footer.profileLink.href) || '#',
      }
    }
    cached.footer.links = sanitizeCachedNavigation(cached.footer.links)
    cached.footer.socialLinks = (Array.isArray(cached.footer.socialLinks) ? cached.footer.socialLinks : [])
      .flatMap((item) => {
        const href = localPathOrExternal(item?.href)
        if (!href || !/^[a-z\d-]+$/i.test(item?.icon || '')) return []
        return [{ ...item, href, label: String(item.label || '') }]
      })
  }
  const petalClasses = new Set()
  for (const rule of cached.contentStyleRules || []) {
    if (!hasThreeHalfRoundedCorners(rule.declarations || '')) continue
    for (const match of rule.selector.matchAll(/\.(cd-content-style-[\da-f]+)/g)) petalClasses.add(match[1])
  }
  const markHtml = (html = '') => html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\sdata-cd-image-shape=/i.test(tag)) return tag
    const classAttribute = /\sclass=(['"])(.*?)\1/i.exec(tag)
    if (!classAttribute || !classAttribute[2].split(/\s+/).some((className) => petalClasses.has(className))) return tag
    return tag.replace(/\s*\/?\s*>$/, (closing) => ` data-cd-image-shape="petal"${closing}`)
  })
  const normalizeHtml = (html = '') => sanitizeWordPressHtml(
    convertClassedElementsToCallouts(markHtml(html)),
    SITE_HTML_SANITIZER_OPTIONS,
  )

  cached.homepageHtml = normalizeHtml(cached.homepageHtml)
  for (const collection of ['home', 'pages', 'posts', 'products']) {
    const records = Array.isArray(cached[collection]) ? cached[collection] : [cached[collection]]
    for (const record of records) {
      if (!record) continue
      if ('image' in record) record.image = safePublicHttpUrl(record.image)
      if (Array.isArray(record.images)) {
        record.images = record.images.flatMap((image) => {
          const src = safePublicHttpUrl(image?.src)
          return src ? [{ ...image, src, alt: String(image.alt || '') }] : []
        })
      }
      for (const field of ['contentHtml', 'descriptionHtml', 'shortDescriptionHtml', 'archiveIntroHtml', 'archiveOutroHtml']) {
        if (record[field]) record[field] = normalizeHtml(record[field])
      }
    }
  }
  for (const collection of ['postCategories', 'postCategoryArchives', 'productCategories', 'blogArchives']) {
    const records = Array.isArray(cached[collection]) ? cached[collection] : [cached[collection]]
    for (const record of records) {
      if (!record) continue
      for (const field of ['descriptionHtml', 'contentHtml', 'archiveIntroHtml', 'archiveOutroHtml']) {
        if (record[field]) record[field] = normalizeHtml(record[field])
      }
    }
  }
  return cached
}

// Preserve block-specific geometry and imagery in a deterministic external stylesheet.
/**
 * Moves imported inline declarations into deterministic page-scoped external CSS rules.
 * The build context owns the rule map so templates can emit a stylesheet without inline styles.
 * @param {string} html Normalized WordPress HTML.
 * @param {object} [record] Record identity used to scope page-specific styles.
 * @param {{contentStyleRules: Map}} contentContext Build-scoped style rule registry.
 * @returns {string} HTML with inline declarations removed and stable style classes attached.
 */
function externalizeContentStyles(html, record = {}, contentContext) {
  contentContext ||= { contentStyleRules: new Map(), wordpressColorPalette: new Map() }
  contentContext.contentStyleRules ||= new Map()
  const pageClass = markPageClass(record)
  return html.replace(/<[a-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi, (tag) => {
    const isMark = /^<mark\b/i.test(tag)
    const attribute = /\sstyle\s*=\s*(['"])(.*?)\1/i.exec(tag)
    const textColorAttribute = /\sdata-cd-text-color=(['"])(.*?)\1/i.exec(tag)
    const backgroundColorAttribute = /\sdata-cd-background-color=(['"])(.*?)\1/i.exec(tag)
    const borderColorAttribute = /\sdata-cd-border-color=(['"])(.*?)\1/i.exec(tag)
    const linkColorAttribute = /\sdata-cd-link-color=(['"])(.*?)\1/i.exec(tag)
    const linkColorValueAttribute = /\sdata-cd-link-color-value=(['"])(.*?)\1/i.exec(tag)
    const colorToken = (token) => ({ primary: 'primary', secondary: 'secondary', tertiary: 'tertiary', quaternary: 'quaternary', text: 'text', lightgray: 'lightgray', contrast: 'contrast-foreground', base: 'base-foreground', 'couleur-1': 'primary', 'couleur-2': 'secondary', 'couleur-3': 'tertiary', 'couleur-4': 'quaternary', 'couleur-5': 'text', 'couleur-texte': 'text', white: 'base-foreground', blanc: 'base-foreground', black: 'contrast-foreground', noir: 'contrast-foreground', foreground: 'contrast-foreground', background: 'base' })[token]
    const palette = contentContext.wordpressColorPalette || new Map()
    const colorForToken = (rawToken) => {
      const token = String(rawToken || '').toLowerCase()
      if (!/^[a-z0-9][a-z0-9-]*$/.test(token)) return null
      const hasPaletteValue = palette instanceof Map ? palette.has(token) : Boolean(palette?.[token])
      if (hasPaletteValue) return `var(--cd2027--wordpress-color-${token})`
      const fallbackToken = colorToken(token)
      return fallbackToken ? `var(--cd2027--color-${fallbackToken})` : null
    }
    let declarations = attribute ? decodeHTML(attribute[2]).trim() : ''
    if (attribute) {
      declarations = declarations
      .replace(/--wp--style--root--padding-(?:left|right)|--wp--custom--gap--horizontal/g, '--cd2027--page-padding-inline')
      .replace(/--wp--style--block-gap/g, '--cd2027--space-40')
      .replace(/var\(\s*--cd2027--wordpress-color-([a-z0-9][a-z0-9-]*)\s*\)/gi, (_match, rawSlug) => {
        const token = rawSlug.toLowerCase()
        const hasPaletteValue = palette instanceof Map ? palette.has(token) : Boolean(palette?.[token])
        const fallbackToken = colorToken(token)
        return hasPaletteValue ? `var(--cd2027--wordpress-color-${token})` : fallbackToken ? `var(--cd2027--color-${fallbackToken})` : 'currentColor'
      })
      .replace(/--couleur-texte\b/g, '--cd2027--color-text')
      .replace(/--texte-principal\b/g, '--cd2027--font-body')
      .replace(/(^|;)\s*color\s*:\s*#fff(?:fff)?\b/gi, '$1color:var(--cd2027--color-base-foreground)')
      .replace(/#fff(?:fff)?\b/gi, 'var(--cd2027--color-base)')
      .replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, (_match, hex) => {
        const palette = { ecc8c8: 'primary', ddb5b7: 'secondary', '8f6b6b': 'tertiary', f9bfc1: 'quaternary', '737373': 'text', b97a6a: 'lightgray', '000000': 'contrast', '000': 'contrast' }
        return palette[hex.toLowerCase()] ? `var(--cd2027--color-${palette[hex.toLowerCase()]})` : `var(--cd2027--editorial-color-${hex.toLowerCase()})`
      })
    }
    const textColor = textColorAttribute && colorForToken(textColorAttribute[2])
    const backgroundColor = backgroundColorAttribute && colorForToken(backgroundColorAttribute[2])
    const borderColor = borderColorAttribute && colorForToken(borderColorAttribute[2])
    if (textColor) declarations += `${declarations ? ';' : ''}color:${textColor} !important`
    if (backgroundColor) declarations += `${declarations ? ';' : ''}background-color:${backgroundColor} !important`
    if (borderColor) declarations += `${declarations ? ';' : ''}border-color:${borderColor} !important`
    const linkColor = linkColorAttribute && colorForToken(linkColorAttribute[2])
    const linkColorValue = linkColorValueAttribute ? decodeHTML(linkColorValueAttribute[2]).trim() : ''
    const linkDeclarations = linkColor
      ? `color:${linkColor} !important`
      : isSafeCssColorValue(linkColorValue) ? `color:${linkColorValue} !important` : ''
    const pageScopedDeclarations = isMark ? `${pageClass}|${declarations}|${linkDeclarations}` : `${declarations}|${linkDeclarations}`
    const className = `cd-content-style-${createHash('sha256').update(pageScopedDeclarations).digest('hex').slice(0, 12)}`
    const markSelector = isMark ? `mark.${pageClass}.${className}[class]` : null
    const isPetalImage = /^<img\b/i.test(tag) && hasThreeHalfRoundedCorners(declarations)
    const selector = /^<wa-button\b/i.test(tag)
      ? `:root .${className}[class], :root wa-button.${className}[class]::part(button)`
      : markSelector || `:root .${className}[class]`
    if (declarations) contentContext.contentStyleRules.set(className, { selector, declarations })
    if (linkDeclarations) {
      contentContext.contentStyleRules.set(`${className}-links`, {
        selector: `:root .${className}[class] :where(a:not(.wp-element-button))`,
        declarations: linkDeclarations,
      })
    }
    const hasExternalStyles = Boolean(declarations || linkDeclarations)
    let cleaned = attribute ? tag.replace(attribute[0], '') : tag
    if (linkColorAttribute) cleaned = cleaned.replace(linkColorAttribute[0], '')
    if (linkColorValueAttribute) cleaned = cleaned.replace(linkColorValueAttribute[0], '')
    if (isPetalImage && !/\sdata-cd-image-shape=/i.test(cleaned)) {
      cleaned = cleaned.replace(/\s*\/?\s*>$/, (closing) => ` data-cd-image-shape="petal"${closing}`)
    }
    if (isMark) cleaned = cleaned.replace(/\sdata-cd-(?:text-color|background-color|inline-color)=(['"])[^'"]*\1/gi, '')
    if (/\sclass=(['"])(.*?)\1/i.test(cleaned)) {
      cleaned = cleaned.replace(/\sclass=(['"])(.*?)\1/i, (_match, _quote, classes) => ` class="${classes}${isMark ? ` ${pageClass}` : ''}${hasExternalStyles ? ` ${className}` : ''}"`)
    } else {
      const classes = [isMark ? pageClass : '', hasExternalStyles ? className : ''].filter(Boolean).join(' ')
      if (!classes) return cleaned
      cleaned = cleaned.replace(/\s*\/?\s*>$/, (closing) => ` class="${classes}"${closing}`)
    }
    return cleaned
  })
}

/**
 * Applies the ordered content, route, form, icon, callout, and external-style transformations.
 * @param {string} html WordPress rendered or serialized HTML.
 * @param {object} [record] Record identity used by page-specific transforms.
 * @param {{contentStyleRules: Map}} [contentContext] Build-scoped stylesheet accumulator.
 * @returns {string} Normalized HTML ready for Eleventy templates.
 */
function normalizeRenderedHtml(html = '', record = {}, contentContext = { contentStyleRules: new Map(), wordpressColorPalette: new Map() }, recordStyleContext = {}) {
  const formMounts = []
  const createFormMountMarker = (provider, id) => {
    const marker = `CD2027FORMPLACEHOLDER${randomBytes(16).toString('hex')}`
    formMounts.push({ marker, provider, id })
    return marker
  }
  let normalized = activateLazyImages(String(html || ''))
  normalized = normalized.replace(
    /<form\b[^>]*id=(['"])forminator-module-(\d+)\1[^>]*>[\s\S]*?<\/form>/gi,
    (_match, _quote, formId) => createFormMountMarker('forminator', formId),
  )
  for (const match of [...normalized.matchAll(/id=(['"])mailpoet_form_(\d+)\1/gi)]) {
    normalized = replaceElementById(
      normalized,
      `mailpoet_form_${match[2]}`,
      createFormMountMarker('mailpoet', match[2]),
    )
  }
  // Remove active markup and source-controlled adapter attributes before any transformation
  // can consume the source HTML as structured input.
  normalized = sanitizeWordPressHtml(normalized, {
    additionalFontFamilies: SITE_HTML_SANITIZER_OPTIONS.additionalFontFamilies,
    allowedBackgroundImagePrefixes: SITE_HTML_SANITIZER_OPTIONS.allowedBackgroundImagePrefixes,
    allowedCssVariables: SITE_HTML_SANITIZER_OPTIONS.allowedCssVariables,
  })
  for (const [missingUrl, availableUrl] of SITE_PROFILE.mediaUrlFallbacks) {
    normalized = normalized.replaceAll(missingUrl, availableUrl)
  }
  normalized = rewriteInternalLinks(normalized)
  normalized = convertWordPressButtons(normalized)
  normalized = convertNativeButtons(normalized)
  normalized = convertWordPressContentDivs(normalized)
  normalized = convertFontAwesomeIcons(normalized)
  normalized = normalizeWordPressMarkup(normalized, contentContext, recordStyleContext)
  normalized = markLectureAkashiqueTestimonials(normalized, record)
  normalized = externalizeContentStyles(normalized, record, contentContext)
  normalized = convertClassedElementsToCallouts(normalized)
  for (const { marker, provider, id } of formMounts) {
    normalized = normalized.replaceAll(marker, `<div class="cd-form-mount" data-cd-form="${provider}" data-form-id="${id}"></div>`)
  }
  return sanitizeWordPressHtml(normalized, SITE_HTML_SANITIZER_OPTIONS)
}

/** Adds the testimonials section marker only to the configured testimonial page's matching section. */
function markLectureAkashiqueTestimonials(html, record) {
  if (record.slug !== SITE_PROFILE.testimonialsPageSlug) return html

  const heading = /<h2\b(?=[^>]*data-cd-block=(['"])heading\1)[^>]*>[\s\S]*?Témoignages[\s\S]*?<\/h2>/i.exec(html)
  if (!heading) return html

  const divTags = /<\/?div\b[^>]*>/gi
  const ancestors = []
  let match
  while ((match = divTags.exec(html)) && match.index < heading.index) {
    if (/^<\//.test(match[0])) ancestors.pop()
    else ancestors.push(match)
  }

  const section = ancestors.reverse().find((ancestor) =>
    /\bdata-cd-align=(['"])full\1/i.test(ancestor[0]) &&
    /\bdata-cd-background-color=(['"])primary\1/i.test(ancestor[0]),
  )
  if (!section || /\bdata-cd-role=/.test(section[0])) return html

  const markedOpeningTag = section[0].replace(/>$/, ' data-cd-role="testimonials-section">')
  return `${html.slice(0, section.index)}${markedOpeningTag}${html.slice(section.index + section[0].length)}`
}

/** Finds the balanced source range for one same-name nested HTML element. */
function findElementRange(html, tagName, searchFrom = 0) {
  const openPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi')
  openPattern.lastIndex = searchFrom
  const opening = openPattern.exec(html)
  if (!opening) return null
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = opening.index
  let depth = 0
  let match
  while ((match = tagPattern.exec(html))) {
    if (/^<\//.test(match[0])) depth -= 1
    else if (!/\/\s*>$/.test(match[0])) depth += 1
    if (depth === 0) return {
      start: opening.index,
      openEnd: openPattern.lastIndex,
      closeStart: match.index,
      end: tagPattern.lastIndex,
    }
  }
  return null
}

/**
 * Fetches the public homepage and extracts the content and shared footer used by Eleventy.
 * @param {{contentStyleRules: Map}} contentContext Build-scoped CSS rule accumulator.
 * @returns {Promise<{content: string, footer: object}>} Normalized homepage content and shared footer.
 * @throws {Error} When the public page does not contain the expected shared header/footer structure.
 */
async function fetchRenderedFrontPage(contentContext) {
  const response = await fetchWithRetry(`${WORDPRESS_ORIGIN}/`, 'homepage', { headers: { Accept: 'text/html' } })
  const html = await response.text()
  const colorPalette = extractWordPressColorPalette(html)
  contentContext.wordpressColorPalette = new Map(Object.entries(colorPalette))
  const elementLinkColors = new Map(Object.entries(extractWordPressLinkColors(html, { colorPalette })))
  const blockLayoutStyles = extractWordPressBlockLayoutStyles(html)
  const bodyStart = html.indexOf('<body')
  const blocksIndex = html.indexOf('<div class="wp-site-blocks"', bodyStart)
  const header = findElementRange(html, 'header', blocksIndex)
  const footer = header && findElementRange(html, 'footer', header.end)
  if (!header || !footer || footer.start <= header.end) {
    throw new Error('Could not isolate the public homepage content from its WordPress header/footer.')
  }
  // The current WP template puts the visual homepage hero inside the header
  // template part, after the global logo/social/navigation row.
  const heroStart = html.indexOf('<div class="wp-block-cover', header.start)
  const contentStart = heroStart >= 0 && heroStart < header.end ? heroStart : header.end
  const content = `${html.slice(contentStart, header.end).replace(/<\/header>\s*$/i, '')}${html.slice(header.end, footer.start)}`
  const footerHtml = html.slice(footer.openEnd, footer.closeStart)
  const headingLinks = [...footerHtml.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].map((match) => {
    const anchors = [...match[1].matchAll(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)]
    const anchor = anchors.find((item) => textFromHtml(item[3]))
    if (!anchor) return null
    const href = localPathOrExternal(decodeHTML(anchor[2]))
    return href ? { label: textFromHtml(match[1]), href } : null
  }).filter(Boolean)
  const logoTag = footerHtml.match(/<img\b[^>]*>/i)?.[0] || ''
  const logo = logoTag.match(/\bdata-src=(['"])(.*?)\1/i)?.[2] || logoTag.match(/\bsrc=(['"])(.*?)\1/i)?.[2]
  const socialLinks = [...footerHtml.matchAll(/<li\b[^>]*class=(['"])[^'"]*wp-social-link-([\w-]+)[^'"]*\1[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => ({
    icon: match[2],
    label: { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', pinterest: 'Pinterest' }[match[2]] || match[2],
    href: localPathOrExternal(decodeHTML(match[3].match(/<a\b[^>]*href=(['"])(.*?)\1/i)?.[2] || '')),
  })).filter((item) => item.href)
  const safeLogo = safePublicHttpUrl(decodeHTML(logo || ''))
  if (!safeLogo || headingLinks.length < 2) throw new Error('The public WordPress footer is missing its logo or navigation.')
  return {
    content: normalizeRenderedHtml(content, { kind: 'page', slug: 'home' }, contentContext, { elementLinkColors, blockLayoutStyles }),
    elementLinkColors,
    footer: { logo: safeLogo, profileLink: headingLinks[0], links: headingLinks.slice(1), socialLinks },
  }
}

/** Fetches page-local WordPress color and layout rules only for records that reference them. */
async function fetchWordPressElementLinkColors(records, contentContext) {
  contentContext.recordBlockLayoutStyles = new Map()
  const requests = records.flatMap(({ record, kind }) => {
    const html = [record.content?.rendered, record.description, record.short_description].filter((value) => typeof value === 'string').join('\n')
    if (!/\b(?:wp-elements|wp-container)-[a-z0-9][a-z0-9-]*\b/i.test(html)) return []
    const sourceUrl = record.link || record.permalink
    if (!sourceUrl) return []
    try {
      const route = localPath(sourceUrl)
      if (!route) return []
      return [{ record, kind, url: new URL(route, WORDPRESS_ORIGIN) }]
    } catch {
      return []
    }
  })
  const results = new Map()
  let nextRequest = 0
  const worker = async () => {
    while (nextRequest < requests.length) {
      const request = requests[nextRequest++]
      const key = `${request.kind}:${request.record.id}`
      try {
        const response = await fetchWithRetry(request.url, `color styles for ${request.kind} ${request.record.slug || request.record.id}`, {
          headers: { Accept: 'text/html' },
        })
        const html = await response.text()
        contentContext.recordBlockLayoutStyles.set(key, extractWordPressBlockLayoutStyles(html))
        const pagePalette = extractWordPressColorPalette(html)
        for (const [slug, value] of Object.entries(pagePalette)) {
          if (!contentContext.wordpressColorPalette.has(slug)) contentContext.wordpressColorPalette.set(slug, value)
        }
        const colorPalette = Object.fromEntries(contentContext.wordpressColorPalette)
        const colors = new Map(Object.entries(extractWordPressLinkColors(html, { colorPalette })))
        if (colors.size) results.set(key, colors)
      } catch (error) {
        console.warn(`[wordpress] Could not extract link colors for ${request.kind} ${request.record.slug || request.record.id}: ${error.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, requests.length) }, worker))
  return results
}

/** Builds the external root variables that preserve the source WordPress palette values. */
function wordpressColorPaletteRule(palette) {
  const declarations = [...palette]
    .filter(([slug, color]) => /^[a-z0-9][a-z0-9-]*$/i.test(slug) && isSafeCssColorValue(color))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([slug, color]) => `--cd2027--wordpress-color-${slug}:${color}`)
    .join(';')
  return declarations ? { selector: ':root', declarations } : null
}

/**
 * Normalizes WordPress source data into the site-specific template record contract.
 * @param {object} record WordPress REST resource.
 * @param {string} kind Site content family such as `page`, `post`, or `product`.
 * @param {{contentStyleRules: Map}} contentContext Build-scoped style accumulator.
 * @returns {object} Public record with canonical route, normalized content, and presentation fields.
 * @throws {Error} When its public permalink resolves outside the WordPress site.
 */
function normalizeWpRecord(record, kind, contentContext) {
  const route = resolveSiteRecordRoute({ ...record, type: kind })
  const recordStyleContext = {
    elementLinkColors: contentContext.recordElementLinkColors?.get(`${kind}:${record.id}`) || new Map(),
    blockLayoutStyles: contentContext.recordBlockLayoutStyles?.get(`${kind}:${record.id}`) || new Map(),
  }
  const rawTitle = record.title?.rendered || record.name || ''
  const description =
    record.yoast_head_json?.description || record.excerpt?.rendered || record.short_description || ''
  const contentPolicy = resolveWordPressContentPolicy(SITE_PROFILE.content, kind)
  const wordpressRecord = normalizeWordPressRecord(record, {
    type: kind,
    contentPolicy,
    routeResolver: resolveSiteRecordRoute,
    customFields: SITE_PROFILE.publicCustomFields?.[kind] || [],
    transformBlock: transformGutenbergBlockColors,
    transformHtml: (html) => normalizeRenderedHtml(html, { ...record, kind }, contentContext, recordStyleContext),
  })
  const publicContent = record.content && typeof record.content === 'object'
    ? { ...record.content }
    : record.content
  if (publicContent && typeof publicContent === 'object') delete publicContent.raw
  const publicRecord = { ...record, content: publicContent }
  delete publicRecord.meta
  delete publicRecord.acf
  delete publicRecord._embedded
  if (publicRecord.author && typeof publicRecord.author === 'object') publicRecord.author = wordpressRecord.author?.id ?? null
  const images = (Array.isArray(record.images) ? record.images : []).flatMap((item) => {
    const src = safePublicHttpUrl(item?.src)
    return src ? [{ ...item, src, alt: String(item.alt || '') }] : []
  })
  const image = safePublicHttpUrl(record.images?.[0]?.src || record._embedded?.['wp:featuredmedia']?.[0]?.source_url || '')
  const alt = record.images?.[0]?.alt || record._embedded?.['wp:featuredmedia']?.[0]?.alt_text || textFromHtml(rawTitle)
  return {
    ...publicRecord,
    kind,
    titleText: textFromHtml(rawTitle),
    descriptionText: textFromHtml(description),
    descriptionHtml: convertWordPressContent({
      renderedHtml: description,
      mode: 'rendered',
      transformHtml: (html) => normalizeRenderedHtml(html, { ...record, kind }, contentContext, recordStyleContext),
    }).html,
    shortDescriptionHtml: convertWordPressContent({
      renderedHtml: record.short_description || '',
      mode: 'rendered',
      transformHtml: (html) => normalizeRenderedHtml(html, { ...record, kind }, contentContext, recordStyleContext),
    }).html,
    author: wordpressRecord.author,
    taxonomies: wordpressRecord.taxonomies,
    customFields: wordpressRecord.customFields,
    route: wordpressRecord.route,
    contentHtml: wordpressRecord.content.html,
    contentMode: contentPolicy.mode,
    contentSource: wordpressRecord.content.source,
    contentBlockTypes: wordpressRecord.content.blockTypes,
    unsupportedContentBlocks: wordpressRecord.content.unsupportedBlockNames,
    contentFallbackReason: wordpressRecord.content.fallbackReason,
    link: route.canonicalUrl,
    path: route.path,
    outputPath: route.outputPath,
    image,
    imageAlt: alt,
    excerptText: textFromHtml(record.excerpt?.rendered || record.short_description || ''),
    publishedAt: record.date || record.date_created || record.date_modified || '',
    categoryIds: (record.categories || []).map((category) =>
      typeof category === 'object' ? category.id : category,
    ),
    images,
    price: record.prices || null,
    purchasable: record.is_purchasable ?? true,
    inStock: record.is_in_stock ?? true,
  }
}

/**
 * Normalizes a taxonomy record using the same content conversion policy as pages and products.
 * @param {object} term WordPress taxonomy record.
 * @param {string} kind Site-specific taxonomy family.
 * @param {{contentStyleRules: Map}} contentContext Build-scoped CSS rule accumulator.
 * @returns {object} Normalized taxonomy record with route and rendered description.
 */
function normalizeTerm(term, kind, contentContext) {
  const recordStyleContext = {
    elementLinkColors: contentContext.recordElementLinkColors?.get(`${kind}:${term.id}`) || new Map(),
    blockLayoutStyles: contentContext.recordBlockLayoutStyles?.get(`${kind}:${term.id}`) || new Map(),
  }
  const normalized = normalizeWpRecord(
    { ...term, type: kind, title: { rendered: term.name }, content: { rendered: term.description || '' } },
    kind,
    contentContext,
  )
  const taxonomy = normalizeWordPressTaxonomy({ ...term, type: kind }, {
    taxonomy: kind,
    routeResolver: resolveSiteRecordRoute,
  })
  return {
    ...normalized,
    ...taxonomy,
    kind,
    titleText: textFromHtml(term.name || ''),
    descriptionHtml: normalizeRenderedHtml(term.description || '', { ...term, kind }, contentContext, recordStyleContext),
    descriptionText: textFromHtml(term.description || ''),
    count: term.count ?? term.products ?? 0,
  }
}

/**
 * Resolves a content record only after confirming that its source link belongs to WordPress.
 * @param {object} record WordPress REST record or normalized author/taxonomy.
 * @returns {object} Canonical route metadata from the shared route resolver.
 * @throws {Error} When the source permalink is external or cannot form a valid route.
 */
function resolveSiteRecordRoute(record) {
  if (record.type === 'author') return wordpressRoutes(record)
  const path = localPath(record.link || record.permalink || record.sourceUrl)
  if (!path) throw new Error(`Unexpected external ${record.type || 'WordPress'} permalink for record ${record.id}`)
  return wordpressRoutes({ ...record, type: record.type || record.kind }, { route: path })
}

/** Reconstructs nested navigation data from rendered WordPress list markup. */
function parseNavigationItems(html = '') {
  const roots = []
  const stack = []
  const tokenPattern = /<li\b[^>]*>|<\/li>|<a\b[^>]*>[\s\S]*?<\/a>/gi
  for (const match of html.matchAll(tokenPattern)) {
    const token = match[0]
    if (/^<li\b/i.test(token)) {
      const item = { label: '', href: '#', items: [] }
      const parent = stack.at(-1)
      ;(parent ? parent.items : roots).push(item)
      stack.push(item)
      continue
    }
    if (/^<\/li>/i.test(token)) {
      stack.pop()
      continue
    }
    const current = stack.at(-1)
    if (!current) continue
    const tag = token.match(/^<a\b[^>]*>/i)?.[0] || ''
    const href = tag.match(/\bhref=(['"])(.*?)\1/i)?.[2] || '#'
    const labelHtml = token.match(/<span[^>]*wp-block-navigation-item__label[^>]*>([\s\S]*?)<\/span>/i)?.[1]
      || token.replace(/^<a\b[^>]*>|<\/a>$/gi, '')
    current.href = localPathOrExternal(decodeHTML(href)) || '#'
    current.label = textFromHtml(labelHtml)
  }
  const clean = (items) => items
    .map((item) => ({ ...item, items: clean(item.items) }))
    .filter((item) => item.label)
    .map((item) => (item.items.length ? item : { label: item.label, href: item.href }))
  return clean(roots)
}

/** Fails the build if two selected records claim the same public path. */
function checkRouteCollisions(records) {
  assertNoWordPressRouteCollisions(records)
}

/** Builds stable archive-page records and previous/current/next navigation metadata. */
function paginatedArchives({ base, records, pageSize, kind, category = null }) {
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize))
  const pageLinks = Array.from({ length: totalPages }, (_, index) => {
    const pageNumber = index + 1
    const path = pageNumber === 1 ? base.path : `${base.path}page/${pageNumber}/`
    return { pageNumber, path, outputPath: outputPath(path), label: String(pageNumber) }
  })

  return pageLinks.map((page, index) => ({
    kind,
    id: `${kind}-${category?.id ?? 'all'}-${page.pageNumber}`,
    titleText: category?.titleText || base.titleText,
    descriptionText: category?.descriptionText || base.descriptionText || '',
    path: page.path,
    link: new URL(page.path, SITE_ORIGIN).href,
    outputPath: page.outputPath,
    pageNumber: page.pageNumber,
    totalPages,
    posts: records.slice(index * pageSize, (index + 1) * pageSize),
    pageLinks: pageLinks.map((item) => ({ ...item, current: item.pageNumber === page.pageNumber })),
    previousPage: pageLinks[index - 1] || null,
    nextPage: pageLinks[index + 1] || null,
    category,
  }))
}

/** Aggregates content-source, fallback, unsupported-block, and block-type counts for build logs. */
function summarizeContentPipeline(records) {
  const summary = {
    records: records.length,
    modes: {},
    sources: {},
    blockTypes: {},
    fallbackReasons: {},
    unsupportedBlocks: {},
  }

  for (const record of records) {
    const modeKey = `${record.kind}:${record.contentMode || 'auto'}`
    summary.modes[modeKey] = (summary.modes[modeKey] || 0) + 1
    summary.sources[record.contentSource] = (summary.sources[record.contentSource] || 0) + 1
    if (record.contentFallbackReason) {
      summary.fallbackReasons[record.contentFallbackReason] = (summary.fallbackReasons[record.contentFallbackReason] || 0) + 1
    }
    for (const [name, count] of Object.entries(record.contentBlockTypes || {})) {
      summary.blockTypes[name] = (summary.blockTypes[name] || 0) + count
    }
    for (const name of record.unsupportedContentBlocks || []) {
      summary.unsupportedBlocks[name] = (summary.unsupportedBlocks[name] || 0) + 1
    }
  }

  return summary
}

/**
 * Fetches, normalizes, selects, and assembles all public data consumed by Eleventy templates.
 * @returns {Promise<object>} Complete site data, route selection, diagnostics, and style rules.
 * @throws {Error} When canonical public content cannot be fetched or route conflicts are found.
 */
async function loadWordPressData() {
  const contentContext = { contentStyleRules: new Map(), wordpressColorPalette: new Map() }
  const pagePolicy = resolveWordPressContentPolicy(SITE_PROFILE.content, 'page')
  const postPolicy = resolveWordPressContentPolicy(SITE_PROFILE.content, 'post')
  const rawPages = await fetchCollection('wp/v2/pages', 'pages', {
    params: { _embed: 1, status: 'publish' },
    policy: pagePolicy,
  })
  const rawPosts = await fetchCollection('wp/v2/posts', 'posts', {
    params: { _embed: 1, status: 'publish' },
    policy: postPolicy,
  })
  const rawPostCategories = await fetchCollection('wp/v2/categories', 'post categories', { params: { hide_empty: true } })
  const rawProducts = await wooCommerceStoreApi.listProducts()
  const rawProductCategories = await wooCommerceStoreApi.listCategories()
  const rawNavigation = await fetchCollection('wp/v2/navigation', 'WordPress navigation', { params: { status: 'publish' } })
  const renderedFrontPage = await fetchRenderedFrontPage(contentContext)
  const [recordElementLinkColors, sitemaps] = await Promise.all([
    fetchWordPressElementLinkColors([
      ...rawPages.map((record) => ({ record, kind: 'page' })),
      ...rawPosts.map((record) => ({ record, kind: 'post' })),
      ...rawProducts.map((record) => ({ record, kind: 'product' })),
      ...rawPostCategories.map((record) => ({ record, kind: 'post-category' })),
      ...rawProductCategories.map((record) => ({ record, kind: 'product-category' })),
    ], contentContext),
    fetchPublicSitemaps(),
  ])
  contentContext.recordElementLinkColors = recordElementLinkColors
  const homepageHtml = renderedFrontPage.content

  const sourcePages = rawPages.map((record) => normalizeWpRecord(record, 'page', contentContext))
  const sourcePosts = rawPosts.map((record) => normalizeWpRecord(record, 'post', contentContext))
  const sourceProducts = rawProducts.map((record) => normalizeWpRecord(record, 'product', contentContext))
  const sourcePostCategories = rawPostCategories.map((record) => normalizeTerm(record, 'post-category', contentContext))
  const sourceProductCategories = rawProductCategories.map((record) => normalizeTerm(record, 'product-category', contentContext))
  const contentPipeline = summarizeContentPipeline([...sourcePages, ...sourcePosts, ...sourceProducts])
  console.log(`[wordpress] content conversion: ${JSON.stringify(contentPipeline)}`)
  const home = sourcePages.find((record) => record.path === '/') || sourcePages.find((record) => record.id === SITE_PROFILE.homePageId)
  const blogPage = sourcePages.find((record) => record.slug === SITE_PROFILE.blogPageSlug)
  if (!home) throw new Error('Could not locate the published WordPress front page')
  if (!blogPage) throw new Error('Could not locate the published WordPress blog page')

  const footer = renderedFrontPage.footer || {}
  const selection = selectReferencedRecords({
    recordGroups: {
      pages: sourcePages,
      posts: sourcePosts,
      products: sourceProducts,
      postCategories: sourcePostCategories,
      productCategories: sourceProductCategories,
    },
    sitemapNames: {
      pages: 'page',
      posts: 'post',
      products: 'product',
      postCategories: 'category',
      productCategories: 'product_cat',
    },
    sitemaps,
    rootHtml: [renderedFrontPage.content, ...rawNavigation.map((record) => record.content?.rendered)],
    rootLinks: [footer.profileLink?.href, ...(footer.links || []).map((item) => item.href)],
    alwaysIncludePaths: new Set([home.path, blogPage.path]),
  })
  const { referencedPaths } = selection
  const selectedPages = selection.records.pages
  const pages = selectedPages.filter((record) => record.id !== home.id && record.id !== blogPage.id)
  const posts = selection.records.posts
  const products = selection.records.products
  const postCategories = selection.records.postCategories
  const productCategories = selection.records.productCategories
  const recordSelection = {
    pages: { fetched: sourcePages.length, generated: selectedPages.length, excluded: sourcePages.filter((record) => !selectedPages.includes(record)).map(({ id, titleText, path, outputPath }) => ({ id, title: titleText, path, outputPath })) },
    posts: { fetched: sourcePosts.length, generated: posts.length, excluded: sourcePosts.filter((record) => !posts.includes(record)).map(({ id, titleText, path, outputPath }) => ({ id, title: titleText, path, outputPath })) },
    products: { fetched: sourceProducts.length, generated: products.length, excluded: sourceProducts.filter((record) => !products.includes(record)).map(({ id, titleText, path, outputPath }) => ({ id, title: titleText, path, outputPath })) },
  }
  const cartPage = pages.find((record) => record.slug === 'panier')
  if (cartPage) {
    const recommendationPaths = new Set()
    const productLinks = cartPage.contentHtml.match(/<a\b(?=[^>]*\bdata-cd-role=(['"])product-link\1)[^>]*>/gi) || []
    for (const tag of productLinks) {
      const href = tag.match(/\bhref=(['"])(.*?)\1/i)?.[2]
      if (!href) continue
      try {
        const path = localPath(decodeHTML(href))
        if (path) recommendationPaths.add(path)
      } catch {
        // Ignore malformed recommendation links; the remaining products still render.
      }
    }
    cartPage.recommendationProducts = products.filter((product) => recommendationPaths.has(product.path))
  }
  posts.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
  for (const post of posts) {
    post.categoryTerms = postCategories.filter((category) => post.categoryIds.includes(category.id))
  }
  const mainNavigationRecord = rawNavigation.find((record) => record.slug === SITE_PROFILE.mainNavigationSlug)
  const shopNavigationRecord = rawNavigation.find((record) => record.slug === SITE_PROFILE.shopNavigationSlug)
  const footerNavigationRecord = rawNavigation.find((record) => record.title?.rendered === SITE_PROFILE.footerNavigationTitle)
  const navigation = parseNavigationItems(mainNavigationRecord?.content?.rendered || '')
  const parsedShopNavigation = parseNavigationItems(shopNavigationRecord?.content?.rendered || '')
  const shopNavigation = parsedShopNavigation.length ? parsedShopNavigation : SITE_PROFILE.shopNavigationFallback
  const footerNavigation = parseNavigationItems(footerNavigationRecord?.content?.rendered || '')
  const authors = collectWordPressAuthors(posts, { routeResolver: wordpressRoutes })
  const authorArchives = authors.map((author) => ({
    kind: 'author',
    id: `author-${author.id}`,
    author,
    titleText: author.name,
    descriptionText: author.description || `Articles de ${author.name}.`,
    path: author.path,
    link: author.link,
    outputPath: author.outputPath,
    posts: posts.filter((post) => String(post.author?.id) === String(author.id)),
  }))

  const latestPostsBlock = /<ul\b(?=[^>]*data-cd-block="latest-posts")[^>]*>[\s\S]*?<\/ul>/i.exec(blogPage.contentHtml)
  if (latestPostsBlock) {
    for (const item of latestPostsBlock[0].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const href = item[1].match(/<a\b[^>]*href=(['"])(.*?)\1/i)?.[2]
      const post = posts.find((record) => record.path === href)
      const excerpt = item[1].match(/<div\b[^>]*data-cd-role="post-excerpt"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
      if (post && excerpt) post.archiveExcerptText = textFromHtml(excerpt.replace(/<a\b[\s\S]*$/i, ''))
    }
  }
  blogPage.archiveIntroHtml = latestPostsBlock ? blogPage.contentHtml.slice(0, latestPostsBlock.index) : blogPage.contentHtml
  blogPage.archiveOutroHtml = latestPostsBlock ? blogPage.contentHtml.slice(latestPostsBlock.index + latestPostsBlock[0].length) : ''
  const blogArchives = paginatedArchives({
    base: blogPage,
    records: posts,
    pageSize: SITE_PROFILE.blogArchivePageSize,
    kind: 'blog-archive',
  })
  const postCategoryArchives = postCategories.flatMap((category) => paginatedArchives({
    base: category,
    records: posts.filter((post) => post.categoryIds.includes(category.id)),
    pageSize: SITE_PROFILE.blogArchivePageSize,
    kind: 'post-category-archive',
    category,
  }))
  const routes = [
    ...pages.filter((record) => record.id !== home.id && record.id !== blogPage.id),
    ...posts,
    ...products,
    ...productCategories,
    ...blogArchives,
    ...postCategoryArchives,
    ...authorArchives,
  ]
  checkRouteCollisions(routes)

  const formReferences = collectFormReferences([...pages, ...posts], {
    providers: [
      {
        name: 'forminator',
        findForms: (html) => [...html.matchAll(/data-cd-form="forminator" data-form-id="(\d+)"/g)].map((match) => match[1]),
      },
      {
        name: 'mailpoet',
        findForms: (html) => [...html.matchAll(/data-cd-form="mailpoet" data-form-id="(\d+)"/g)].map((match) => match[1]),
      },
    ],
  })
  const formIds = new Set(formReferences.map((form) => Number(form.id)))

  return {
    contentStyleRules: [wordpressColorPaletteRule(contentContext.wordpressColorPalette), ...contentContext.contentStyleRules.values()].filter(Boolean),
    wordpressColorPalette: Object.fromEntries(contentContext.wordpressColorPalette),
    contentPipeline,
    siteOrigin: SITE_ORIGIN,
    fetchedAt: new Date().toISOString(),
    home,
    homepageHtml,
    footer: renderedFrontPage.footer,
    pages: pages.filter((record) => record.id !== home.id && record.id !== blogPage.id),
    blogPage,
    blogArchives,
    posts,
    products,
    postCategories,
    postCategoryArchives,
    productCategories,
    authors,
    authorArchives,
    navigation,
    shopNavigation,
    footerNavigation,
    authorArchive: authorArchives[0] || null,
    recordSelection,
    sourceSitemaps: Object.fromEntries(Object.entries(sitemaps).map(([kind, paths]) => [kind, [...paths]])),
    referencedPaths: [...referencedPaths],
    formIds: [...formIds],
    formReferences,
    routes: [{ ...home, path: '/', outputPath: 'index.html' }, ...routes].map((record) => record.link),
  }
}

/**
 * Eleventy global-data provider for canonical public WordPress content.
 * @returns {Promise<object>} Normalized site data and generated-route metadata.
 * @sideEffects Fetches WordPress resources and refreshes the private build cache on success.
 */
module.exports = async function () {
  try {
    const data = await loadWordPressData()
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    // Persist only the last successful public snapshot; auth-only raw content is removed upstream.
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data))
    return data
  } catch (error) {
    if (process.env.CD2027_ALLOW_PUBLIC_CACHE === '1' && fs.existsSync(CACHE_FILE)) {
      console.warn(`[wordpress] Using the last successful public content snapshot after a fetch failure: ${error.message}`)
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
      if (!Array.isArray(cached.shopNavigation) || !cached.shopNavigation.length) {
        cached.shopNavigation = SITE_PROFILE.shopNavigationFallback
      }
      return markPetalImagesInCachedMarkup(cached)
    }
    throw error
  }
}

/**
 * Converts rendered HTML or entities to normalized human-readable text.
 * @param {string} [value] Rendered HTML or encoded text.
 * @returns {string} Decoded text with collapsed whitespace.
 */
module.exports.textFromHtml = textFromHtml
/** Converts class-marked WordPress callouts according to the explicit `callout-*` class contract. */
module.exports.convertClassedElementsToCallouts = convertClassedElementsToCallouts
/** Normalizes public or serialized WordPress markup and externalizes its styles for regression checks. */
module.exports.normalizeRenderedHtml = normalizeRenderedHtml
/** Carries saved Gutenberg color attributes into the consumer's markup normalization stage. */
module.exports.transformGutenbergBlockColors = transformGutenbergBlockColors
/** Reads sanitizer-approved container layout declarations from WordPress block-support CSS. */
module.exports.extractWordPressBlockLayoutStyles = extractWordPressBlockLayoutStyles
/** Revalidates public HTML, route links, assets, and style rules from a previous build cache. */
module.exports.markPetalImagesInCachedMarkup = markPetalImagesInCachedMarkup
