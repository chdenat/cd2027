const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '_site')
const cachePath = path.resolve(__dirname, '..', '.data', 'wordpress-public-cache.json')
const siteOrigin = new URL(process.env.SITE_URL || 'https://christinedeloupy.fr').origin
if (!fs.existsSync(cachePath)) throw new Error('The build did not save its WordPress source route manifest')
const wordpress = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
const sitemapPath = path.join(root, 'sitemap.xml')
if (!fs.existsSync(sitemapPath)) throw new Error('The build did not produce sitemap.xml')

const sitemap = fs.readFileSync(sitemapPath, 'utf8')
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
if (!urls.length) throw new Error('The generated sitemap contains no routes')
for (const value of urls) {
  if (new URL(value).origin !== siteOrigin) {
    throw new Error(`Sitemap URL does not use SITE_URL (${siteOrigin}): ${value}`)
  }
}

const missing = []
const generatedPages = new Map()
for (const value of urls) {
  const pathname = decodeURIComponent(new URL(value).pathname)
  const output = pathname === '/' ? 'index.html' : `${pathname.replace(/^\/+|\/+$/g, '')}/index.html`
  const file = path.join(root, output)
  if (!fs.existsSync(file)) missing.push(`${pathname} -> ${output}`)
  else generatedPages.set(pathname, fs.readFileSync(file, 'utf8'))
}

if (missing.length) throw new Error(`Missing generated routes:\n${missing.join('\n')}`)

const sourceRecords = [
  wordpress.home,
  wordpress.blogPage,
  ...(wordpress.pages || []),
  ...(wordpress.posts || []),
  ...(wordpress.products || []),
  ...(wordpress.postCategories || []),
  ...(wordpress.productCategories || []),
  ...(wordpress.blogArchives || []),
  ...(wordpress.postCategoryArchives || []),
  wordpress.authorArchive,
].filter((record) => record?.outputPath)
const missingSourceRoutes = sourceRecords
  .filter((record) => !fs.existsSync(path.join(root, record.outputPath)))
  .map((record) => `${record.kind} ${record.id} ${record.path} -> ${record.outputPath}`)
if (missingSourceRoutes.length) {
  throw new Error(`WordPress source records without generated pages:\n${missingSourceRoutes.join('\n')}`)
}
const excludedRecords = Object.values(wordpress.recordSelection || {}).flatMap((selection) => selection.excluded || [])
const staleExcludedRoutes = excludedRecords
  .filter((record) => fs.existsSync(path.join(root, record.outputPath)))
  .map((record) => `${record.path} -> ${record.outputPath}`)
if (staleExcludedRoutes.length) {
  throw new Error(`Unreferenced WordPress records remain in the generated output:\n${staleExcludedRoutes.join('\n')}`)
}

const home = generatedPages.get('/') || ''
if (!home.includes('Bienvenue') || !home.includes('Accompagnement des femmes 50+')) {
  throw new Error('The Eleventy homepage is missing the current WordPress hero content.')
}

const footer = home.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] || ''
if (!/<img\b[^>]*\bsrc="[^"]+"/.test(footer) || !footer.includes('Réseaux sociaux') || !footer.includes('Informations légales')) {
  throw new Error('The shared footer is missing its logo, social links, or legal navigation.')
}

const blog = generatedPages.get('/mon-blog/') || ''
if (!generatedPages.has('/mon-blog/page/2/') || !['/categorie/developpement-personnel/', '/categorie/spiritualite/', '/categorie/rituel/'].every((href) => blog.includes(href))) {
  throw new Error('The paginated blog archive or its category navigation is missing.')
}

const embeddedStyles = [...generatedPages].filter(([, html]) => /<style\b|\sstyle\s*=/i.test(html)).map(([pathname]) => pathname)
if (embeddedStyles.length) throw new Error(`Embedded CSS found in generated pages: ${embeddedStyles.join(', ')}`)

const unproxiedLinks = []
const generatedPaths = new Set(urls.map((value) => {
  let pathname = decodeURI(new URL(value).pathname)
  if (!pathname.endsWith('/') && !/\.[a-z0-9]{2,6}$/i.test(pathname)) pathname += '/'
  return pathname
}))
const stagingGatePaths = process.env.CD2027_WP_AUTH === '1'
  ? new Set(['/__cd2027/login/', '/__cd2027/logout/'])
  : new Set()
const missingInternalLinks = new Map()
for (const [pathname, html] of generatedPages) {
  for (const match of html.matchAll(/<(a|area|form|wa-button|wa-dropdown-item)\b[^>]*>/gi)) {
    const tag = match[0]
    const attribute = /^<form\b/i.test(tag) ? 'action' : (/^<wa-dropdown-item\b/i.test(tag) ? 'data-href' : 'href')
    const value = tag.match(new RegExp(`\\b${attribute}=(['"])(.*?)\\1`, 'i'))?.[2]
    if (value && new URL(value, siteOrigin).origin === siteOrigin && /^https?:\/\//i.test(value)) {
      unproxiedLinks.push(`${pathname}: ${value}`)
    }
    if (!value) continue
    const target = new URL(value, siteOrigin)
    if (target.origin !== siteOrigin) continue
    let targetPath = decodeURI(target.pathname)
    if (!targetPath.endsWith('/') && !/\.[a-z0-9]{2,6}$/i.test(targetPath)) targetPath += '/'
    if (generatedPaths.has(targetPath) || stagingGatePaths.has(targetPath) || /^\/(?:wp-admin|wp-json|wp-content|feed|tag)(?:\/|$)|^\/\d{4}\/\d{2}\/\d{2}(?:\/|$)/i.test(targetPath)) continue
    const sources = missingInternalLinks.get(targetPath) || new Set()
    sources.add(pathname)
    missingInternalLinks.set(targetPath, sources)
  }
}
if (unproxiedLinks.length) throw new Error(`Internal WordPress links were not routed through Eleventy:\n${unproxiedLinks.slice(0, 20).join('\n')}`)
if (missingInternalLinks.size) {
  console.warn(`Internal links without a generated route (check for retired WordPress URLs):\n${[...missingInternalLinks].map(([route, sources]) => `  ${route} ← ${sources.size} source page(s), including ${[...sources].slice(0, 3).join(', ')}`).join('\n')}`)
}

const selection = wordpress.recordSelection || {}
const selectionSummary = ['pages', 'posts', 'products']
  .map((kind) => `${selection[kind]?.generated ?? 0}/${selection[kind]?.fetched ?? 0} ${kind}`)
  .join(', ')
console.log(`Route check passed: ${urls.length} sitemap routes and ${sourceRecords.length} source routes exist in _site (${selectionSummary}).`)
