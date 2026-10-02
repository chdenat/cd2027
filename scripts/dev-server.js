const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const SITE_DIR = path.join(ROOT, '_site')
const WORDPRESS_ORIGIN = 'https://christinedeloupy.fr'
const PORT = Number(process.env.PORT || 4555)
const HOST = '127.0.0.1'
const MAX_BODY = 1024 * 1024
const FORMINATOR_IDS = new Set([10569, 10671])
const MAILPOET_IDS = new Set([1, 5, 7, 9, 11, 12, 13, 15])

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Request body is too large.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function parseAttributes(tag) {
  const attributes = {}
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attributes
}

function pathFromRequest(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('..')) {
    throw new Error('Invalid form source path.')
  }
  const parsed = new URL(value, WORDPRESS_ORIGIN)
  if (parsed.origin !== WORDPRESS_ORIGIN) throw new Error('Invalid form source path.')
  return parsed
}

async function fetchWordPressPage(pageUrl) {
  const response = await fetch(pageUrl, {
    headers: { Accept: 'text/html', 'User-Agent': 'CD2026 Eleventy local form adapter' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`WordPress page returned ${response.status}.`)
  return response.text()
}

function extractJsonObject(source, startAt) {
  const opening = source.indexOf('{', startAt)
  if (opening < 0) throw new Error('Forminator configuration was not found on the source page.')
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = opening; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return JSON.parse(source.slice(opening, index + 1))
    }
  }
  throw new Error('Forminator configuration was incomplete.')
}

async function loadForminatorForm(pageUrl, formId) {
  const pageHtml = await fetchWordPressPage(pageUrl)
  const callPattern = new RegExp(`renderForminatorAjax\\s*\\(\\s*${formId}\\s*,\\s*`)
  const call = callPattern.exec(pageHtml)
  if (!call) throw new Error(`Forminator form ${formId} is not rendered on this WordPress page.`)
  const config = extractJsonObject(pageHtml, call.index + call[0].length)
  if (Number(config.id) !== formId || config.action !== 'forminator_load_form') {
    throw new Error('The WordPress form configuration did not match the requested form.')
  }
  config.extra = { ...(config.extra || {}), referer_url: pageUrl.href }
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(config)) {
    if (Array.isArray(value)) {
      for (const item of value) body.append(`${key}[]`, typeof item === 'string' ? item : JSON.stringify(item))
    } else if (value && typeof value === 'object') {
      for (const [nestedKey, nestedValue] of Object.entries(value)) body.append(`${key}[${nestedKey}]`, String(nestedValue))
    } else {
      body.append(key, String(value))
    }
  }
  const response = await fetch(`${WORDPRESS_ORIGIN}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Origin: WORDPRESS_ORIGIN,
      Referer: pageUrl.href,
    },
    body,
    signal: AbortSignal.timeout(20000),
  })
  const result = await response.json()
  if (!response.ok || !result.success || !result.data?.html) {
    throw new Error(result.data?.message || `WordPress could not load Forminator form ${formId}.`)
  }
  return { provider: 'forminator', html: result.data.html }
}

async function loadMailPoetForm(pageUrl, formId) {
  const pageHtml = await fetchWordPressPage(pageUrl)
  let formStart = -1
  let formEnd = -1
  for (const inputMatch of pageHtml.matchAll(/<input\b[^>]*>/gi)) {
    const attrs = parseAttributes(inputMatch[0])
    if (attrs.name !== 'data[form_id]' || Number(attrs.value) !== formId) continue
    formStart = pageHtml.lastIndexOf('<form', inputMatch.index)
    const closingTag = pageHtml.indexOf('</form>', inputMatch.index)
    if (formStart < 0 || closingTag < 0) break
    formEnd = closingTag + '</form>'.length
    break
  }
  if (formStart < 0 || formEnd < 0) throw new Error(`MailPoet form ${formId} is not rendered on this WordPress page.`)
  let html = pageHtml.slice(formStart, formEnd)
  html = html.replace(/\saction=(['"])[^'"]*\1/i, ' action="#"')
  return { provider: 'mailpoet', html }
}

async function loadForm(request, response) {
  const payload = JSON.parse((await readBody(request)).toString('utf8') || '{}')
  const provider = payload.provider
  const formId = Number(payload.formId)
  const pageUrl = pathFromRequest(payload.path)
  if (provider === 'forminator' && FORMINATOR_IDS.has(formId)) {
    return sendJson(response, 200, await loadForminatorForm(pageUrl, formId))
  }
  if (provider === 'mailpoet' && MAILPOET_IDS.has(formId)) {
    return sendJson(response, 200, await loadMailPoetForm(pageUrl, formId))
  }
  return sendJson(response, 400, { message: 'This WordPress form has not been enabled in the Eleventy adapter yet.' })
}

async function submitForm(request, response) {
  const rawBody = (await readBody(request)).toString('utf8')
  const outer = new URLSearchParams(rawBody)
  const provider = outer.get('provider')
  const formId = Number(outer.get('formId'))
  const pageUrl = pathFromRequest(outer.get('path'))
  const fields = new URLSearchParams(outer.get('fields') || '')

  if (provider === 'forminator' && FORMINATOR_IDS.has(formId)) {
    if (Number(fields.get('form_id')) !== formId || fields.get('action') !== 'forminator_submit_form_custom-forms') {
      return sendJson(response, 400, { message: 'The Forminator submission did not match the expected form.' })
    }
    const upstream = await fetch(`${WORDPRESS_ORIGIN}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Origin: WORDPRESS_ORIGIN,
        Referer: pageUrl.href,
      },
      body: fields,
      signal: AbortSignal.timeout(20000),
    })
    const payload = await upstream.json().catch(() => ({}))
    return sendJson(response, upstream.status, payload)
  }

  if (provider === 'mailpoet' && MAILPOET_IDS.has(formId)) {
    if (Number(fields.get('data[form_id]')) !== formId || fields.get('mailpoet_method') !== 'subscribe') {
      return sendJson(response, 400, { message: 'The newsletter submission did not match the expected form.' })
    }
    const upstream = await fetch(`${WORDPRESS_ORIGIN}/wp-admin/admin-post.php?action=mailpoet_subscription_form`, {
      method: 'POST',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Origin: WORDPRESS_ORIGIN,
        Referer: pageUrl.href,
      },
      body: fields,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    })
    if (upstream.status >= 400) return sendJson(response, upstream.status, { success: false, message: 'MailPoet could not accept this subscription.' })
    return sendJson(response, 200, {
      success: true,
      message: 'Votre demande a été transmise. Si une confirmation est nécessaire, vous recevrez un e-mail.',
    })
  }

  return sendJson(response, 400, { message: 'This WordPress form has not been enabled in the Eleventy adapter yet.' })
}

async function proxyStoreApi(request, response, localUrl) {
  const storePath = localUrl.pathname.replace(/^\/wp-json\/wc\/store\/v1/, '') || '/'
  if (!/^\/(cart|checkout|products)(?:\/|$)/.test(storePath) || storePath.includes('..')) {
    return sendJson(response, 404, { message: 'Store API route is not available in the local proxy.' })
  }
  const method = request.method.toUpperCase()
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) {
    return sendJson(response, 405, { message: 'Method not allowed.' }, { Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' })
  }
  if (method === 'OPTIONS') {
    response.writeHead(204, { Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' })
    return response.end()
  }

  const headers = { Accept: 'application/json' }
  for (const name of ['content-type', 'cart-token', 'nonce']) {
    const value = request.headers[name]
    if (value) headers[name] = value
  }
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(request)
  const upstream = await fetch(`${WORDPRESS_ORIGIN}${localUrl.pathname}${localUrl.search}`, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  })
  const responseHeaders = { 'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  for (const name of ['cart-token', 'nonce', 'nonce-timestamp']) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders[name] = value
  }
  const payload = Buffer.from(await upstream.arrayBuffer())
  response.writeHead(upstream.status, responseHeaders)
  response.end(payload)
}

function serveStatic(request, response, url) {
  let pathname
  try { pathname = decodeURIComponent(url.pathname) } catch { response.writeHead(400).end('Bad request'); return }
  const requested = path.resolve(SITE_DIR, `.${pathname}`)
  if (requested !== SITE_DIR && !requested.startsWith(`${SITE_DIR}${path.sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  let file = requested
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
  } catch {
    if (!path.extname(file)) file = path.join(file, 'index.html')
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(SITE_DIR, '404.html')
    response.statusCode = 404
  }
  const contentType = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
  response.setHeader('Content-Type', contentType)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Cache-Control', path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=300')
  if (request.method === 'HEAD') return response.end()
  fs.createReadStream(file).pipe(response)
}

let eleventy

function startEleventy() {
  eleventy = spawn(process.execPath, [path.join(ROOT, 'node_modules/@11ty/eleventy/cmd.cjs'), '--watch'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, CD2026_ALLOW_PUBLIC_CACHE: '1' },
  })
  eleventy.on('exit', (code, signal) => {
    if (signal) console.error(`Eleventy stopped with signal ${signal}.`)
    else if (code) console.error(`Eleventy watch exited with status ${code}.`)
  })

}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${HOST}:${PORT}`)
  try {
    if (url.pathname === '/health') return sendJson(response, 200, { status: 'ok', output: SITE_DIR })
    if (url.pathname === '/api/forms/load' && request.method === 'POST') return await loadForm(request, response)
    if (url.pathname === '/api/forms/submit' && request.method === 'POST') return await submitForm(request, response)
    if (url.pathname.startsWith('/wp-json/wc/store/v1/')) return await proxyStoreApi(request, response, url)
    if (['GET', 'HEAD'].includes(request.method)) return serveStatic(request, response, url)
    return sendJson(response, 404, { message: 'Route not found.' })
  } catch (error) {
    console.error(`[local-server] ${request.method} ${url.pathname}: ${error.message}`)
    if (!response.headersSent) return sendJson(response, 502, { message: error.message || 'The upstream service failed.' })
    response.end()
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Eleventy + WordPress local frontend: http://${HOST}:${PORT}`)
  console.log('WooCommerce Store API and supported form requests use same-origin local proxies.')
  startEleventy()
})

function stop() {
  server.close()
  eleventy?.kill('SIGTERM')
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
