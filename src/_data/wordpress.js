const WORDPRESS_ORIGIN = (process.env.WORDPRESS_ORIGIN || 'https://christinedeloupy.fr').replace(/\/$/, '')
const SITE_ORIGIN = (process.env.SITE_URL || 'https://christinedeloupy.fr').replace(/\/$/, '')
const API_ORIGIN = `${WORDPRESS_ORIGIN}/wp-json`
const PER_PAGE = 100
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const contentStyleRules = new Map()
const { decodeHTML } = require('entities')
const CACHE_FILE = path.resolve(__dirname, '../..', '.data', 'wordpress-public-cache.json')
const INTERNAL_ROUTE_ALIASES = new Map([
  ['/std-boutique/', '/boutique/'],
  ['/seance-clarté/', '/seance-clarte/'],
  ['/accompagnements/lecture-akashique/', '/mes-accompagnements/lecture-akashique/'],
  ['/accompagnements/', '/mes-accompagnements/'],
])
const SHOP_NAVIGATION_FALLBACK = [
  { label: 'Boutique', href: '/boutique/' },
  { label: 'Panier', href: '/panier/' },
  { label: 'Retour', href: '/' },
]
// A few old pages still point to removed attachments. Prefer retained
// WordPress copies or closely related images already in the site's media library.
const MEDIA_URL_FALLBACKS = new Map([
  [
    `${WORDPRESS_ORIGIN}/wp-content/uploads/2022/09/Mon-cadeau-pour-toi.jpg`,
    `${WORDPRESS_ORIGIN}/wp-content/uploads/2022/09/Mon-cadeau-pour-toi-1.jpg`,
  ],
  [
    `${WORDPRESS_ORIGIN}/wp-content/uploads/2020/04/bel2-1500x2000.jpg`,
    `${WORDPRESS_ORIGIN}/wp-content/uploads/2020/04/20200406_174408-rotated.jpg`,
  ],
])

async function fetchWithRetry(url, label, options = {}) {
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) })
      if (response.ok) return response
      const error = new Error(`WordPress ${label} failed: ${response.status} ${response.statusText} (${url})`)
      if (response.status < 500 && response.status !== 429) throw error
      lastError = error
    } catch (error) {
      lastError = error
      if (attempt === 3) break
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
  }
  throw lastError
}

async function fetchJson(url, label) {
  const response = await fetchWithRetry(url, `API ${label}`, { headers: { Accept: 'application/json' } })
  return { response, data: await response.json() }
}

async function fetchCollection(endpoint, label) {
  const firstUrl = new URL(`${API_ORIGIN}/${endpoint}`)
  firstUrl.searchParams.set('per_page', String(PER_PAGE))
  firstUrl.searchParams.set('page', '1')
  const first = await fetchJson(firstUrl, label)
  const pageCount = Number(first.response.headers.get('x-wp-totalpages') || 1)
  const remaining = []
  for (let page = 2; page <= pageCount; page += 1) {
    const url = new URL(firstUrl)
    url.searchParams.set('page', String(page))
    remaining.push((await fetchJson(url, `${label} page ${page}`)).data)
  }
  return first.data.concat(...remaining)
}

function textFromHtml(value = '') {
  return decodeHTML(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function escapeAttributeValue(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function localPath(url) {
  const parsed = new URL(url, WORDPRESS_ORIGIN)
  if (parsed.hostname.replace(/^www\./i, '').toLowerCase() !== new URL(WORDPRESS_ORIGIN).hostname.replace(/^www\./i, '').toLowerCase()) return null
  const pathname = decodeURI(parsed.pathname)
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

async function fetchSitemapPaths(name) {
  const response = await fetchWithRetry(`${WORDPRESS_ORIGIN}/${name}-sitemap.xml`, `Yoast ${name} sitemap`, {
    headers: { Accept: 'application/xml,text/xml' },
  })
  const xml = await response.text()
  if (!/<urlset\b/i.test(xml)) throw new Error(`WordPress ${name} sitemap did not contain a URL set.`)
  const paths = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => {
      try {
        return localPath(decodeHTML(match[1].trim()))
      } catch {
        return null
      }
    })
    .filter(Boolean)
  return new Set(paths)
}

async function fetchPublicSitemaps() {
  const names = ['page', 'post', 'product', 'category', 'product_cat', 'author']
  const entries = await Promise.all(names.map(async (name) => [name, await fetchSitemapPaths(name)]))
  return Object.fromEntries(entries)
}

function collectInternalReferences(htmlValues) {
  const paths = new Set()
  for (const html of htmlValues) {
    for (const match of String(html || '').matchAll(/<(?:a|area|form|wa-button|wa-dropdown-item)\b[^>]*?(?:href|action|data-href)=(['"])(.*?)\1[^>]*>/gi)) {
      try {
        const path = localPath(localPathOrExternal(decodeHTML(match[2])))
        if (path) paths.add(path)
      } catch {
        // Malformed and external links do not identify a local content route.
      }
    }
  }
  return paths
}

function addLocalReference(paths, value) {
  if (!value) return
  try {
    const path = localPath(localPathOrExternal(decodeHTML(value)))
    if (path) paths.add(path)
  } catch {
    // External and malformed links do not identify a local content route.
  }
}

function selectReferencedRecords({ recordGroups, sitemapNames, sitemaps, rootHtml, rootLinks, alwaysIncludePaths }) {
  const selected = Object.fromEntries(Object.entries(recordGroups).map(([kind]) => [kind, new Set()]))
  for (const [kind, records] of Object.entries(recordGroups)) {
    const sitemapPaths = sitemaps[sitemapNames[kind]]
    for (const record of records) {
      if (sitemapPaths?.has(record.path) || alwaysIncludePaths.has(record.path)) selected[kind].add(record)
    }
  }

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

function outputPath(pathname) {
  return pathname === '/' ? 'index.html' : `${pathname.replace(/^\/+|\/+$/g, '')}/index.html`
}

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

function localPathOrExternal(value) {
  try {
    const parsed = new URL(value, WORDPRESS_ORIGIN)
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    const siteHostname = new URL(WORDPRESS_ORIGIN).hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== siteHostname) return parsed.href
    const path = decodeURI(parsed.pathname)
    const lookupPath = path.endsWith('/') ? path : `${path}/`
    return `${INTERNAL_ROUTE_ALIASES.get(lookupPath) || path}${parsed.search}${parsed.hash}`
  } catch {
    return value
  }
}

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

function convertWordPressButtonLinks(html, style = 'fill') {
  const appearance = style === 'outline' ? 'outlined' : 'filled'
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (tag, attributes, content) => {
    const classes = attributes.match(/\bclass=(['"])(.*?)\1/i)?.[2] || ''
    if (!/(?:^|\s)(?:wp-block-button__link|wp-element-button)(?:\s|$)/.test(classes)) return tag
    return `<wa-button data-cd-button-style="${style}" appearance="${appearance}" variant="brand"${attributes}>${content}</wa-button>`
  })
}

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
  if (className === 'text-2-columns') return ['data-cd-text-columns', '2']
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
  if (className === 'has-cropped-images') return ['data-cd-cropped-images', 'true']

  return null
}

function normalizeWordPressMarkup(html = '') {
  return html.replace(/<[a-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi, (tag) => {
    const classAttribute = /\sclass=(['"])(.*?)\1/i.exec(tag)
    if (!classAttribute) return tag

    const classNames = classAttribute[2].split(/\s+/).filter(Boolean)
    const semanticAttributes = new Map()
    for (const className of classNames) {
      const attribute = semanticAttributesForWordPressClass(className)
      if (attribute && !semanticAttributes.has(attribute[0])) semanticAttributes.set(attribute[0], attribute[1])
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
    .replace(/--wp--preset--color--couleur-1\b/g, '--cd2027--color-primary')
    .replace(/--wp--preset--color--couleur-2\b/g, '--cd2027--color-secondary')
    .replace(/--wp--preset--color--couleur-3\b/g, '--cd2027--color-tertiary')
    .replace(/--wp--preset--color--couleur-4\b/g, '--cd2027--color-quaternary')
    .replace(/--wp--preset--color--couleur-5\b/g, '--cd2027--color-text')
    .replace(/--wp--preset--color--/g, '--cd2027--color-')
    .replace(/--wp--preset--font-family--great-vibes/g, '--cd2027--font-script')
    .replace(/--wp--preset--font-family--made-mirage/g, '--cd2027--font-heading')
    .replace(/--wp--preset--font-family--menu-font/g, '--cd2027--font-menu')
    .replace(/--wp--preset--font-family--text-font/g, '--cd2027--font-body')
    .replace(/--wp--preset--font-family--button-font/g, '--cd2027--font-button')
    .replace(/--wp--preset--font-family--/g, '--cd2027--font-')
    .replace(/--wp--preset--font-size--/g, '--cd2027--font-size-')
}

function markPageClass(record = {}) {
  const pageIdentity = [record.kind || 'page', record.id || record.slug || record.path || 'home'].join(':')
  return `cd-mark-page-${createHash('sha256').update(pageIdentity).digest('hex').slice(0, 10)}`
}

// Preserve block-specific geometry and imagery in a deterministic external stylesheet.
function externalizeContentStyles(html, record = {}) {
  const pageClass = markPageClass(record)
  return html.replace(/<[a-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi, (tag) => {
    const isMark = /^<mark\b/i.test(tag)
    const attribute = /\sstyle\s*=\s*(['"])(.*?)\1/i.exec(tag)
    const textColorAttribute = isMark ? /\sdata-cd-text-color=(['"])(.*?)\1/i.exec(tag) : null
    const backgroundColorAttribute = isMark ? /\sdata-cd-background-color=(['"])(.*?)\1/i.exec(tag) : null
    const colorToken = (token) => ({ primary: 'primary', secondary: 'secondary', tertiary: 'tertiary', quaternary: 'quaternary', text: 'text', lightgray: 'lightgray', contrast: 'contrast-foreground', base: 'base-foreground', 'couleur-1': 'primary', 'couleur-2': 'secondary', 'couleur-3': 'tertiary', 'couleur-4': 'quaternary', 'couleur-5': 'text', 'couleur-texte': 'text', white: 'base-foreground', blanc: 'base-foreground', black: 'contrast-foreground', noir: 'contrast-foreground', foreground: 'contrast-foreground', background: 'base' })[token]
    let declarations = attribute ? decodeHTML(attribute[2]).trim() : ''
    if (attribute) {
      declarations = declarations
      .replace(/--wp--style--root--padding-(?:left|right)|--wp--custom--gap--horizontal/g, '--cd2027--page-padding-inline')
      .replace(/--wp--style--block-gap/g, '--cd2027--space-40')
      .replace(/--couleur-texte\b/g, '--cd2027--color-text')
      .replace(/--texte-principal\b/g, '--cd2027--font-body')
      .replace(/(^|;)\s*color\s*:\s*#fff(?:fff)?\b/gi, '$1color:var(--cd2027--color-base-foreground)')
      .replace(/#fff(?:fff)?\b/gi, 'var(--cd2027--color-base)')
      .replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, (_match, hex) => {
        const palette = { ecc8c8: 'primary', ddb5b7: 'secondary', '8f6b6b': 'tertiary', f9bfc1: 'quaternary', '737373': 'text', b97a6a: 'lightgray', '000000': 'contrast', '000': 'contrast' }
        return palette[hex.toLowerCase()] ? `var(--cd2027--color-${palette[hex.toLowerCase()]})` : `var(--cd2027--editorial-color-${hex.toLowerCase()})`
      })
    }
    if (textColorAttribute && colorToken(textColorAttribute[2])) declarations += `${declarations ? ';' : ''}color:var(--cd2027--color-${colorToken(textColorAttribute[2])}) !important`
    if (backgroundColorAttribute && colorToken(backgroundColorAttribute[2])) declarations += `${declarations ? ';' : ''}background-color:var(--cd2027--color-${colorToken(backgroundColorAttribute[2])}) !important`
    const pageScopedDeclarations = isMark ? `${pageClass}|${declarations}` : declarations
    const className = `cd-content-style-${createHash('sha256').update(pageScopedDeclarations).digest('hex').slice(0, 12)}`
    const markSelector = isMark ? `mark.${pageClass}.${className}[class]` : null
    const selector = /^<wa-button\b/i.test(tag)
      ? `:root .${className}[class], :root wa-button.${className}[class]::part(button)`
      : markSelector || `:root .${className}[class]`
    if (declarations) contentStyleRules.set(className, { selector, declarations })
    let cleaned = attribute ? tag.replace(attribute[0], '') : tag
    if (isMark) cleaned = cleaned.replace(/\sdata-cd-(?:text-color|background-color|inline-color)=(['"])[^'"]*\1/gi, '')
    if (/\sclass=(['"])(.*?)\1/i.test(cleaned)) {
      cleaned = cleaned.replace(/\sclass=(['"])(.*?)\1/i, (_match, _quote, classes) => ` class="${classes}${isMark ? ` ${pageClass}` : ''}${declarations ? ` ${className}` : ''}"`)
    } else {
      const classes = [isMark ? pageClass : '', declarations ? className : ''].filter(Boolean).join(' ')
      if (!classes) return cleaned
      cleaned = cleaned.replace(/\s*\/?\s*>$/, (closing) => ` class="${classes}"${closing}`)
    }
    return cleaned
  })
}

function normalizeRenderedHtml(html = '', record = {}) {
  let normalized = activateLazyImages(html)
  for (const [missingUrl, availableUrl] of MEDIA_URL_FALLBACKS) {
    normalized = normalized.replaceAll(missingUrl, availableUrl)
  }
  normalized = rewriteInternalLinks(normalized)
  normalized = convertWordPressButtons(normalized)
  normalized = normalized.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  normalized = convertNativeButtons(normalized)
  normalized = convertWordPressContentDivs(normalized)
  normalized = normalized.replace(
    /<form\b[^>]*id=(['"])forminator-module-(\d+)\1[^>]*>[\s\S]*?<\/form>/gi,
    (_, _quote, formId) => `<div class="cd-form-mount" data-cd-form="forminator" data-form-id="${formId}"></div>`,
  )
  for (const match of [...normalized.matchAll(/id=(['"])mailpoet_form_(\d+)\1/gi)]) {
    normalized = replaceElementById(
      normalized,
      `mailpoet_form_${match[2]}`,
      `<div class="cd-form-mount" data-cd-form="mailpoet" data-form-id="${match[2]}"></div>`,
    )
  }
  normalized = convertFontAwesomeIcons(normalized)
  return externalizeContentStyles(normalizeWordPressMarkup(normalized), record)
}

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

async function fetchRenderedFrontPage() {
  const response = await fetchWithRetry(`${WORDPRESS_ORIGIN}/`, 'homepage', { headers: { Accept: 'text/html' } })
  const html = await response.text()
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
    return { label: textFromHtml(match[1]), href: localPathOrExternal(decodeHTML(anchor[2])) }
  }).filter(Boolean)
  const logoTag = footerHtml.match(/<img\b[^>]*>/i)?.[0] || ''
  const logo = logoTag.match(/\bdata-src=(['"])(.*?)\1/i)?.[2] || logoTag.match(/\bsrc=(['"])(.*?)\1/i)?.[2]
  const socialLinks = [...footerHtml.matchAll(/<li\b[^>]*class=(['"])[^'"]*wp-social-link-([\w-]+)[^'"]*\1[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => ({
    icon: match[2],
    label: { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', pinterest: 'Pinterest' }[match[2]] || match[2],
    href: decodeHTML(match[3].match(/<a\b[^>]*href=(['"])(.*?)\1/i)?.[2] || ''),
  })).filter((item) => item.href)
  if (!logo || headingLinks.length < 2) throw new Error('The public WordPress footer is missing its logo or navigation.')
  return { content: normalizeRenderedHtml(content, { kind: 'page', slug: 'home' }), footer: { logo: decodeHTML(logo), profileLink: headingLinks[0], links: headingLinks.slice(1), socialLinks } }
}

function normalizeWpRecord(record, kind) {
  const path = localPath(record.link || record.permalink)
  if (!path) throw new Error(`Unexpected external ${kind} permalink for record ${record.id}`)
  const rawTitle = record.title?.rendered || record.name || ''
  const description =
    record.yoast_head_json?.description || record.excerpt?.rendered || record.short_description || ''
  const content = record.content?.rendered || record.description || ''
  const image = record.images?.[0]?.src || record._embedded?.['wp:featuredmedia']?.[0]?.source_url || null
  const alt = record.images?.[0]?.alt || record._embedded?.['wp:featuredmedia']?.[0]?.alt_text || textFromHtml(rawTitle)
  return {
    ...record,
    kind,
    titleText: textFromHtml(rawTitle),
    descriptionText: textFromHtml(description),
    descriptionHtml: normalizeRenderedHtml(description, { ...record, kind }),
    shortDescriptionHtml: normalizeRenderedHtml(record.short_description || '', { ...record, kind }),
    contentHtml: normalizeRenderedHtml(content, { ...record, kind }),
    link: new URL(path, SITE_ORIGIN).href,
    path,
    outputPath: outputPath(path),
    image,
    imageAlt: alt,
    excerptText: textFromHtml(record.excerpt?.rendered || record.short_description || ''),
    publishedAt: record.date || record.date_created || record.date_modified || '',
    categoryIds: (record.categories || []).map((category) =>
      typeof category === 'object' ? category.id : category,
    ),
    images: record.images || [],
    price: record.prices || null,
    purchasable: record.is_purchasable ?? true,
    inStock: record.is_in_stock ?? true,
  }
}

function normalizeTerm(term, kind) {
  const normalized = normalizeWpRecord(
    { ...term, title: { rendered: term.name }, content: { rendered: term.description || '' } },
    kind,
  )
  return { ...normalized, descriptionHtml: normalizeRenderedHtml(term.description || '', { ...term, kind }), count: term.count ?? term.products ?? 0 }
}

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
    current.href = localPathOrExternal(decodeHTML(href))
    current.label = textFromHtml(labelHtml)
  }
  const clean = (items) => items
    .map((item) => ({ ...item, items: clean(item.items) }))
    .filter((item) => item.label)
    .map((item) => (item.items.length ? item : { label: item.label, href: item.href }))
  return clean(roots)
}

function checkRouteCollisions(records) {
  const paths = new Map()
  for (const record of records) {
    const previous = paths.get(record.path)
    if (previous) {
      throw new Error(`Published route collision at ${record.path}: ${previous.kind} ${previous.id} and ${record.kind} ${record.id}`)
    }
    paths.set(record.path, record)
  }
}

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

async function loadWordPressData() {
  contentStyleRules.clear()
  const rawPages = await fetchCollection('wp/v2/pages?_embed=1&status=publish', 'pages')
  const rawPosts = await fetchCollection('wp/v2/posts?_embed=1&status=publish', 'posts')
  const rawPostCategories = await fetchCollection('wp/v2/categories?hide_empty=true', 'post categories')
  const rawProducts = await fetchCollection('wc/store/v1/products', 'WooCommerce products')
  const rawProductCategories = await fetchCollection('wc/store/v1/products/categories?hide_empty=true', 'WooCommerce product categories')
  const rawNavigation = await fetchCollection('wp/v2/navigation?status=publish', 'WordPress navigation')
  const renderedFrontPage = await fetchRenderedFrontPage()
  const sitemaps = await fetchPublicSitemaps()
  const homepageHtml = renderedFrontPage.content

  const sourcePages = rawPages.map((record) => normalizeWpRecord(record, 'page'))
  const sourcePosts = rawPosts.map((record) => normalizeWpRecord(record, 'post'))
  const sourceProducts = rawProducts.map((record) => normalizeWpRecord(record, 'product'))
  const sourcePostCategories = rawPostCategories.map((record) => normalizeTerm(record, 'post-category'))
  const sourceProductCategories = rawProductCategories.map((record) => normalizeTerm(record, 'product-category'))
  const home = sourcePages.find((record) => record.path === '/') || sourcePages.find((record) => record.id === 10343)
  const blogPage = sourcePages.find((record) => record.slug === 'mon-blog')
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
  const mainNavigationRecord = rawNavigation.find((record) => record.slug === 'main-menu')
  const shopNavigationRecord = rawNavigation.find((record) => record.slug === 'boutique')
  const footerNavigationRecord = rawNavigation.find((record) => record.title?.rendered === 'Menu Bas de Page')
  const navigation = parseNavigationItems(mainNavigationRecord?.content?.rendered || '')
  const parsedShopNavigation = parseNavigationItems(shopNavigationRecord?.content?.rendered || '')
  const shopNavigation = parsedShopNavigation.length ? parsedShopNavigation : SHOP_NAVIGATION_FALLBACK
  const footerNavigation = parseNavigationItems(footerNavigationRecord?.content?.rendered || '')
  const authorArchive = {
    kind: 'author',
    id: 'christine',
    titleText: 'Christine',
    path: '/author/christine/',
    link: `${SITE_ORIGIN}/author/christine/`,
    outputPath: 'author/christine/index.html',
  }

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
    pageSize: 9,
    kind: 'blog-archive',
  })
  const postCategoryArchives = postCategories.flatMap((category) => paginatedArchives({
    base: category,
    records: posts.filter((post) => post.categoryIds.includes(category.id)),
    pageSize: 9,
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
    authorArchive,
  ]
  checkRouteCollisions(routes)

  const formIds = new Set()
  for (const record of [...pages, ...posts]) {
    for (const match of record.contentHtml.matchAll(/data-cd-form="(?:forminator|mailpoet)" data-form-id="(\d+)"/g)) {
      formIds.add(Number(match[1]))
    }
  }

  return {
    contentStyleRules: [...contentStyleRules.values()],
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
    navigation,
    shopNavigation,
    footerNavigation,
    authorArchive,
    recordSelection,
    sourceSitemaps: Object.fromEntries(Object.entries(sitemaps).map(([kind, paths]) => [kind, [...paths]])),
    referencedPaths: [...referencedPaths],
    formIds: [...formIds],
    routes: [{ ...home, path: '/', outputPath: 'index.html' }, ...routes].map((record) => record.link),
  }
}

module.exports = async function () {
  try {
    const data = await loadWordPressData()
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data))
    return data
  } catch (error) {
    if (process.env.CD2027_ALLOW_PUBLIC_CACHE === '1' && fs.existsSync(CACHE_FILE)) {
      console.warn(`[wordpress] Using the last successful public content snapshot after a fetch failure: ${error.message}`)
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
      if (!Array.isArray(cached.shopNavigation) || !cached.shopNavigation.length) {
        cached.shopNavigation = SHOP_NAVIGATION_FALLBACK
      }
      return cached
    }
    throw error
  }
}

module.exports.textFromHtml = textFromHtml
