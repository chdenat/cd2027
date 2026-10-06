/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/stop-dev-server.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-03
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SITE_DIR = path.join(ROOT, '_site')
const DEV_SERVER_PATH = path.join(ROOT, 'scripts', 'dev-server.js')
const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4555)

/** Sends a bounded request to the local server to verify its identity or request shutdown. */
function request(pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const headers = method === 'POST' ? { 'x-cd2027-dev-command': 'restart' } : {}
    const clientRequest = http.request({ host: HOST, port: PORT, path: pathname, method, headers }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, body }))
    })
    const timeout = setTimeout(() => {
      const error = new Error('Timed out while contacting the local dev server.')
      error.code = 'ETIMEDOUT'
      clientRequest.destroy(error)
    }, 3000)
    clientRequest.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    clientRequest.on('close', () => clearTimeout(timeout))
    clientRequest.end()
  })
}

function isConnectionRefused(error) {
  return error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET'
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/** Checks whether the configured loopback port can be bound without contacting another service. */
function isPortAvailable() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolve(false)
      else reject(error)
    })
    probe.listen(PORT, HOST, () => probe.close(() => resolve(true)))
  })
}

/** Matches a Linux process by both repository working directory and the exact dev-server script. */
function isThisDevServer(pid) {
  try {
    const cwd = fs.realpathSync(`/proc/${pid}/cwd`)
    const argumentsList = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean)
    return cwd === ROOT && argumentsList.some((argument) => path.resolve(cwd, argument) === DEV_SERVER_PATH)
  } catch {
    return false
  }
}

/** Finds only this checkout's dev-server processes; unrelated Node/Bun processes are ignored. */
function findLinuxDevServers() {
  if (process.platform !== 'linux') return []
  let entries
  try {
    entries = fs.readdirSync('/proc')
  } catch {
    return []
  }
  return entries.filter((entry) => /^\d+$/.test(entry) && isThisDevServer(Number(entry))).map(Number)
}

/** Sends SIGTERM only to previously identified project processes and waits for their exit. */
async function stopBySignal(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }

  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const remaining = pids.filter(isThisDevServer)
    if (!remaining.length) return
    await delay(100)
  }
  throw new Error(`The existing CD2027 dev server did not stop within 10 seconds (PID ${pids.join(', ')}).`)
}

/** Waits until the port is free or reports if a different service takes it over. */
async function waitUntilStopped() {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (await isPortAvailable()) return
    try {
      const response = await request('/health')
      if (response.status !== 200) throw new Error(`Port ${PORT} was taken by another service while stopping the dev server.`)
      const health = JSON.parse(response.body)
      if (health.output !== SITE_DIR) throw new Error(`Port ${PORT} is now serving a different project.`)
    } catch (error) {
      if (isConnectionRefused(error)) return
      throw error
    }
    await delay(100)
  }
  throw new Error(`The existing dev server did not stop within 10 seconds on port ${PORT}.`)
}

/** Stops an existing CD2027 server through its verified local control route when needed. */
async function stopExistingServer() {
  const localProcesses = findLinuxDevServers()
  if (localProcesses.length) {
    console.log(`Stopping the existing CD2027 dev server (PID ${localProcesses.join(', ')}).`)
    await stopBySignal(localProcesses)
    return
  }

  if (await isPortAvailable()) return

  let healthResponse
  try {
    healthResponse = await request('/health')
  } catch (error) {
    if (isConnectionRefused(error)) return
    throw error
  }

  let health
  try {
    health = JSON.parse(healthResponse.body)
  } catch {
    throw new Error(`Port ${PORT} is already in use by a service that is not the CD2027 dev server.`)
  }
  if (healthResponse.status !== 200 || health.output !== SITE_DIR) {
    throw new Error(`Port ${PORT} is already in use by a service that is not the CD2027 dev server.`)
  }

  // The server accepts shutdown only with its private restart marker and no Origin header.
  const shutdownResponse = await request('/__dev/shutdown', 'POST')
  if (shutdownResponse.status !== 202) {
    throw new Error('The existing CD2027 dev server does not support automatic shutdown. Stop it once, then run bun run dev again.')
  }
  await waitUntilStopped()
  console.log(`Stopped the existing CD2027 dev server on port ${PORT}.`)
}

stopExistingServer().catch((error) => {
  console.error(`[dev] ${error.message}`)
  process.exitCode = 1
})
