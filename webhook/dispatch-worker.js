const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOT = path.resolve(__dirname, '..')
const PENDING_DIR = path.resolve(process.env.WEBHOOK_STORE_DIR || path.join(ROOT, '.data/webhooks/pending'))
const PROCESSED_DIR = path.resolve(process.env.WEBHOOK_PROCESSED_DIR || path.join(ROOT, '.data/webhooks/processed'))
const LOCK_FILE = path.resolve(process.env.WEBHOOK_DISPATCH_LOCK || path.join(ROOT, '.data/webhooks/dispatcher.lock'))
const TOKEN = process.env.GITHUB_DISPATCH_TOKEN
const REPOSITORY = process.env.GITHUB_REPOSITORY
const EVENT_TYPE = process.env.GITHUB_DISPATCH_EVENT_TYPE || 'cd2026_staging_deploy'
const API_VERSION = '2026-03-10'

function atomicWrite(filename, content) {
  const temporary = `${filename}.${process.pid}.${crypto.randomUUID()}.tmp`
  return fs.writeFile(temporary, content).then(() => fs.rename(temporary, filename))
}

async function claimWorkerLock() {
  await fs.mkdir(path.dirname(LOCK_FILE), { recursive: true })
  try {
    const handle = await fs.open(LOCK_FILE, 'wx', 0o600)
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
    await handle.close()
    return true
  } catch (error) {
    if (error.code === 'EEXIST') {
      const lockStat = await fs.stat(LOCK_FILE).catch(() => null)
      if (!lockStat || Date.now() - lockStat.mtimeMs > 10 * 60 * 1000) {
        await fs.rm(LOCK_FILE, { force: true })
        return claimWorkerLock()
      }
      return false
    }
    throw error
  }
}

async function dispatch(jobs) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': API_VERSION,
    },
    body: JSON.stringify({
      event_type: EVENT_TYPE,
      client_payload: {
        batch_id: crypto.randomUUID(),
        event_count: jobs.length,
      },
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (response.status !== 204) {
    throw new Error(`GitHub repository_dispatch returned HTTP ${response.status}.`)
  }
}

async function retryLater(jobPath, job, error) {
  job.dispatchAttempts = Number(job.dispatchAttempts || 0) + 1
  job.lastDispatchError = error.message
  const delay = Math.min(60 * 60 * 1000, 15_000 * 2 ** Math.min(job.dispatchAttempts - 1, 8))
  job.nextAttemptAt = new Date(Date.now() + delay).toISOString()
  await atomicWrite(jobPath, JSON.stringify(job, null, 2))
  console.error(`Webhook ${job.payload?.event_id || path.basename(jobPath)} dispatch failed; retry scheduled.`)
}

async function processPending() {
  let names
  try {
    names = await fs.readdir(PENDING_DIR)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }

  await fs.mkdir(PROCESSED_DIR, { recursive: true })
  const eligible = []
  for (const name of names.filter((filename) => filename.endsWith('.json')).sort()) {
    const jobPath = path.join(PENDING_DIR, name)
    try {
      const job = JSON.parse(await fs.readFile(jobPath, 'utf8'))
      const event = job.payload
      if (!event || typeof event.event_id !== 'string' || !event.event_id) {
        throw new Error('Queued webhook has no stable event ID.')
      }
      if (Date.parse(job.nextAttemptAt || job.receivedAt || 0) > Date.now()) continue
      const processedPath = path.join(PROCESSED_DIR, name)
      try {
        await fs.access(processedPath)
        await fs.unlink(jobPath)
        continue
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      eligible.push({ jobPath, processedPath, job })
    } catch (error) {
      console.error(`Could not process queued webhook ${name}: ${error.message}`)
    }
  }

  if (!eligible.length) return
  try {
    await dispatch(eligible.map(({ job }) => job))
    const dispatchedAt = new Date().toISOString()
    for (const { jobPath, processedPath, job } of eligible) {
      job.status = 'dispatched'
      job.dispatchedAt = dispatchedAt
      delete job.lastDispatchError
      await atomicWrite(processedPath, JSON.stringify(job, null, 2))
      await fs.unlink(jobPath)
    }
    console.log(`Dispatched ${eligible.length} WordPress event(s) in one staging build request.`)
  } catch (error) {
    for (const { jobPath, job } of eligible) await retryLater(jobPath, job, error)
  }
}

async function main() {
  if (!TOKEN) throw new Error('GITHUB_DISPATCH_TOKEN is required.')
  if (!REPOSITORY || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(REPOSITORY)) {
    throw new Error('GITHUB_REPOSITORY must be set to owner/repository.')
  }
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(EVENT_TYPE)) throw new Error('Invalid GITHUB_DISPATCH_EVENT_TYPE.')

  if (!(await claimWorkerLock())) {
    console.log('Another webhook dispatch worker is already running.')
    return
  }

  try {
    await processPending()
  } finally {
    await fs.rm(LOCK_FILE, { force: true })
  }
}

main().catch((error) => {
  console.error(`[webhook-dispatch] ${error.message}`)
  process.exitCode = 1
})
