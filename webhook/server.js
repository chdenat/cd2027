import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const secret = Bun.env.WEBHOOK_SECRET
const port = Number(Bun.env.WEBHOOK_PORT || 8787)
const hostname = Bun.env.WEBHOOK_HOST || '127.0.0.1'
const maxBodyBytes = Number(Bun.env.WEBHOOK_MAX_BODY_BYTES || 1024 * 1024)
const storeDir = Bun.env.WEBHOOK_STORE_DIR || '.data/webhooks'
const encoder = new TextEncoder()

if (!secret || secret.length < 16) {
  console.error('WEBHOOK_SECRET doit contenir au moins 16 caractères.')
  process.exit(1)
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function normalizeSignature(value) {
  if (!value) return ''
  return value.trim().replace(/^sha256=/i, '').toLowerCase()
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return difference === 0
}

async function createSignature(body) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function readBody(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > maxBodyBytes) {
    throw new Error('PAYLOAD_TOO_LARGE')
  }

  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalLength += value.byteLength
    if (totalLength > maxBodyBytes) {
      await reader.cancel()
      throw new Error('PAYLOAD_TOO_LARGE')
    }

    chunks.push(value)
  }

  const body = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(body)
}

async function storeEvent({ body, payload, request }) {
  await mkdir(storeDir, { recursive: true })

  const id = crypto.randomUUID()
  const receivedAt = new Date().toISOString()
  const filename = `${receivedAt.replaceAll(':', '-')}-${id}.json`
  const event = {
    id,
    receivedAt,
    event: request.headers.get('x-webhook-event') || payload.event || 'unknown',
    source: request.headers.get('origin') || 'christinedeloupy.fr',
    payload,
    rawBody: body,
  }

  await Bun.write(join(storeDir, filename), JSON.stringify(event, null, 2))
  return { id, receivedAt }
}

async function handleWebhook(request) {
  const body = await readBody(request)
  const providedSignature = normalizeSignature(
    request.headers.get('x-webhook-signature') || request.headers.get('x-hub-signature-256'),
  )
  const expectedSignature = await createSignature(body)

  if (!providedSignature || !timingSafeEqual(providedSignature, expectedSignature)) {
    return json({ ok: false, error: 'Invalid webhook signature' }, 401)
  }

  let payload
  try {
    payload = JSON.parse(body || '{}')
  } catch {
    return json({ ok: false, error: 'Payload must be valid JSON' }, 400)
  }

  const stored = await storeEvent({ body, payload, request })
  console.log(`Webhook reçu: ${stored.id}`)
  return json({ ok: true, ...stored }, 202)
}

const server = Bun.serve({
  hostname,
  port,
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'christine-webhook', receivedAt: new Date().toISOString() })
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/christine') {
      try {
        return await handleWebhook(request)
      } catch (error) {
        if (error.message === 'PAYLOAD_TOO_LARGE') {
          return json({ ok: false, error: 'Payload too large' }, 413)
        }

        console.error('Webhook error:', error)
        return json({ ok: false, error: 'Webhook processing failed' }, 500)
      }
    }

    return json({ ok: false, error: 'Not found' }, 404)
  },
})

console.log(`Webhook listening on http://${server.hostname}:${server.port}`)
