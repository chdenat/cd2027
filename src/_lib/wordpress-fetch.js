/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/_lib/wordpress-fetch.js
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

/** Waits for a retry delay without blocking the event loop. */
function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/**
 * Parses a Retry-After header as delay seconds or an HTTP date.
 * @param {string|null} value Retry-After response header.
 * @param {number} now Current time in milliseconds since the Unix epoch.
 * @returns {number|null} Non-negative delay in milliseconds, or null for an invalid header.
 */
function parseRetryAfterDelay(value, now) {
  if (typeof value !== 'string' || !value.trim()) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000

  const retryAt = Date.parse(value)
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : null
}

/**
 * Calculates bounded exponential backoff, honoring Retry-After and spreading concurrent retries.
 * @param {{attempt:number,retryAfter:string|null,retryDelayMs:number,maxRetryDelayMs:number,maxRetryAfterMs:number,jitterRatio:number,nowImpl:()=>number,randomImpl:()=>number}} options Retry attempt, response header, delay limits, and injectable clock/random source.
 * @returns {number} Delay before the next attempt in milliseconds.
 */
function calculateRetryDelayMs({ attempt, retryAfter, retryDelayMs, maxRetryDelayMs, maxRetryAfterMs, jitterRatio, nowImpl, randomImpl }) {
  const exponentialDelayMs = Math.min(maxRetryDelayMs, retryDelayMs * (2 ** (attempt - 1)))
  // Jitter prevents parallel sitemap requests from retrying against the host in lockstep.
  const jitterMultiplier = 1 - jitterRatio + randomImpl() * 2 * jitterRatio
  const jitteredBackoffMs = Math.min(maxRetryDelayMs, Math.round(exponentialDelayMs * jitterMultiplier))
  const retryAfterMs = parseRetryAfterDelay(retryAfter, nowImpl()) ?? 0
  return Math.min(maxRetryAfterMs, Math.max(jitteredBackoffMs, retryAfterMs))
}

/**
 * Fetches a resource with bounded retries for transient HTTP and transport failures.
 * @param {string|URL} url Resource URL.
 * @param {string} label Resource description used in errors and retry diagnostics.
 * @param {RequestInit} [requestOptions] Fetch headers and other request options.
 * @param {object} [retryOptions] Retry policy and optional injectable dependencies for deterministic tests.
 * @param {number} [retryOptions.maxAttempts=4] Total attempts, including the first request.
 * @param {number} [retryOptions.retryDelayMs=500] Initial exponential-backoff delay.
 * @param {number} [retryOptions.maxRetryDelayMs=2000] Maximum exponential-backoff delay.
 * @param {number} [retryOptions.maxRetryAfterMs] Maximum honored Retry-After delay; defaults to maxRetryDelayMs.
 * @param {number} [retryOptions.jitterRatio=0] Jitter fraction from zero to half the calculated delay.
 * @param {number} [retryOptions.timeoutMs=20000] Timeout for each request.
 * @param {typeof fetch} [retryOptions.fetchImpl=fetch] Fetch implementation.
 * @param {(milliseconds: number) => Promise<void>} [retryOptions.sleepImpl=wait] Delay implementation.
 * @param {() => number} [retryOptions.nowImpl=Date.now] Clock used to parse HTTP-date Retry-After values.
 * @param {() => number} [retryOptions.randomImpl=Math.random] Random source used to spread retries.
 * @param {(details: {url:string,label:string,status:number|null,attempt:number,nextAttempt:number,maxAttempts:number,delayMs:number,error:Error}) => void} [retryOptions.onRetry] Called before waiting for another attempt.
 * @returns {Promise<Response>} Successful HTTP response.
 * @throws {Error} For permanent HTTP errors or when all retry attempts fail.
 */
async function fetchWithRetry(url, label, requestOptions = {}, retryOptions = {}) {
  const {
    maxAttempts = 4,
    retryDelayMs = 500,
    maxRetryDelayMs = 2000,
    jitterRatio = 0,
    timeoutMs = 20000,
    fetchImpl = globalThis.fetch,
    sleepImpl = wait,
    nowImpl = Date.now,
    randomImpl = Math.random,
    onRetry,
  } = retryOptions
  const maxRetryAfterMs = retryOptions.maxRetryAfterMs ?? maxRetryDelayMs

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive integer.')
  }
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 0.5) {
    throw new RangeError('jitterRatio must be between 0 and 0.5.')
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A Fetch implementation is required.')

  let lastError
  let retryAfter = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...requestOptions,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (response.ok) return response

      const error = new Error(`WordPress ${label} failed: ${response.status} ${response.statusText} (${url})`)
      error.status = response.status
      retryAfter = response.headers?.get?.('retry-after') ?? null
      error.retryAfter = retryAfter
      if (response.status < 500 && response.status !== 429) throw error
      lastError = error
    } catch (error) {
      lastError = error
      if (error.status && error.status < 500 && error.status !== 429) break
      retryAfter = error.retryAfter ?? null
    }

    if (attempt === maxAttempts) break

    const delayMs = calculateRetryDelayMs({
      attempt,
      retryAfter,
      retryDelayMs,
      maxRetryDelayMs,
      maxRetryAfterMs,
      jitterRatio,
      nowImpl,
      randomImpl,
    })
    onRetry?.({
      url: String(url),
      label,
      status: lastError.status ?? null,
      attempt,
      nextAttempt: attempt + 1,
      maxAttempts,
      delayMs,
      error: lastError,
    })
    await sleepImpl(delayMs)
  }

  throw lastError
}

module.exports = { fetchWithRetry }
