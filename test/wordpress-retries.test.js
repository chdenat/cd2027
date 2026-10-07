/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: test/wordpress-retries.test.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-07
 * Last modified: 2026-10-07
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { fetchWithRetry } = require('../src/_lib/wordpress-fetch.js')

function response(status, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 503 ? 'Service Unavailable' : status === 200 ? 'OK' : 'Not Found',
    headers: new Headers(headers),
  }
}

const baseRetryOptions = {
  maxAttempts: 6,
  retryDelayMs: 5000,
  maxRetryDelayMs: 30000,
  maxRetryAfterMs: 120000,
  jitterRatio: 0.2,
  timeoutMs: 1000,
  randomImpl: () => 0.5,
}

test('a temporary 503 is retried with bounded exponential waits and then succeeds', async () => {
  const statuses = [503, 503, 200]
  const delays = []
  const retries = []
  let requests = 0

  const result = await fetchWithRetry('https://wordpress.example/category-sitemap.xml', 'Yoast category sitemap', {}, {
    ...baseRetryOptions,
    fetchImpl: async () => response(statuses[requests++]),
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
    onRetry: (details) => retries.push(details),
  })

  assert.equal(result.status, 200)
  assert.equal(requests, 3)
  assert.deepEqual(delays, [5000, 10000])
  assert.deepEqual(retries.map(({ attempt, nextAttempt, status }) => ({ attempt, nextAttempt, status })), [
    { attempt: 1, nextAttempt: 2, status: 503 },
    { attempt: 2, nextAttempt: 3, status: 503 },
  ])
})

test('ordinary WordPress fetches keep the existing short, unjittered retry schedule by default', async () => {
  const delays = []
  let requests = 0

  await assert.rejects(fetchWithRetry('https://wordpress.example/page/', 'page styles', {}, {
    maxAttempts: 4,
    retryDelayMs: 500,
    maxRetryDelayMs: 2000,
    fetchImpl: async () => {
      requests += 1
      return response(503)
    },
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
  }), (error) => error.status === 503)

  assert.equal(requests, 4)
  assert.deepEqual(delays, [500, 1000, 2000])
})

test('Retry-After HTTP dates are honored without sleeping during the test', async () => {
  const now = Date.parse('Wed, 07 Oct 2026 00:00:00 GMT')
  const delays = []
  let requests = 0

  await fetchWithRetry('https://wordpress.example/category-sitemap.xml', 'Yoast category sitemap', {}, {
    ...baseRetryOptions,
    fetchImpl: async () => requests++ === 0
      ? response(503, { 'retry-after': new Date(now + 45000).toUTCString() })
      : response(200),
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
    nowImpl: () => now,
  })

  assert.deepEqual(delays, [45000])
})

test('retry jitter spreads requests while keeping the backoff inside its configured cap', async () => {
  const firstRetryDelay = async (randomValue) => {
    const delays = []
    let requests = 0

    await fetchWithRetry('https://wordpress.example/category-sitemap.xml', 'Yoast category sitemap', {}, {
      ...baseRetryOptions,
      fetchImpl: async () => response(requests++ === 0 ? 503 : 200),
      sleepImpl: async (milliseconds) => delays.push(milliseconds),
      randomImpl: () => randomValue,
    })

    return delays[0]
  }

  const fasterRetry = await firstRetryDelay(0)
  const slowerRetry = await firstRetryDelay(0.999)
  assert.equal(fasterRetry, 4000)
  assert.ok(slowerRetry > fasterRetry)
  assert.ok(slowerRetry <= 6000)
})

test('Retry-After waits are capped at the configured maximum', async () => {
  const delays = []
  let requests = 0

  await fetchWithRetry('https://wordpress.example/category-sitemap.xml', 'Yoast category sitemap', {}, {
    ...baseRetryOptions,
    fetchImpl: async () => requests++ === 0
      ? response(503, { 'retry-after': '300' })
      : response(200),
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
  })

  assert.deepEqual(delays, [120000])
})

test('permanent client errors fail immediately without retrying', async () => {
  const delays = []
  let requests = 0

  await assert.rejects(fetchWithRetry('https://wordpress.example/category-sitemap.xml', 'Yoast category sitemap', {}, {
    ...baseRetryOptions,
    fetchImpl: async () => {
      requests += 1
      return response(404)
    },
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
  }), (error) => error.status === 404)

  assert.equal(requests, 1)
  assert.deepEqual(delays, [])
})

test('transient failures stop after the configured number of attempts', async () => {
  const delays = []
  let requests = 0

  await assert.rejects(fetchWithRetry('https://wordpress.example/category-sitemap.xml', 'Yoast category sitemap', {}, {
    ...baseRetryOptions,
    fetchImpl: async () => {
      requests += 1
      return response(503)
    },
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
  }), (error) => error.status === 503)

  assert.equal(requests, 6)
  assert.deepEqual(delays, [5000, 10000, 20000, 30000, 30000])
})
