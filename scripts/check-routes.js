const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '_site')
const siteOrigin = new URL(process.env.SITE_URL || 'https://christinedeloupy.fr').origin
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
for (const [pathname, html] of generatedPages) {
  for (const match of html.matchAll(/<(a|area|form|wa-button|wa-dropdown-item)\b[^>]*>/gi)) {
    const tag = match[0]
    const attribute = /^<form\b/i.test(tag) ? 'action' : (/^<wa-dropdown-item\b/i.test(tag) ? 'data-href' : 'href')
    const value = tag.match(new RegExp(`\\b${attribute}=(['"])(.*?)\\1`, 'i'))?.[2]
    if (value && new URL(value, siteOrigin).origin === siteOrigin && /^https?:\/\//i.test(value)) {
      unproxiedLinks.push(`${pathname}: ${value}`)
    }
  }
}
if (unproxiedLinks.length) throw new Error(`Internal WordPress links were not routed through Eleventy:\n${unproxiedLinks.slice(0, 20).join('\n')}`)

console.log(`Route check passed: ${urls.length} WordPress and paginated archive routes exist in _site/.`)
