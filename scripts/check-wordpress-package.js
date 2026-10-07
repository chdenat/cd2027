/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/check-wordpress-package.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-07
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

'use strict'

const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { dirname, join } = require('node:path')
const api = require('wp-awesome')

// Check the installed dependency through its public names, independently of the package checkout.
for (const subpath of ['content', 'rest-client', 'records', 'routes', 'styles', 'policies', 'eleventy']) {
  const entry = require(`wp-awesome/${subpath}`)
  for (const [name, implementation] of Object.entries(entry)) assert.equal(api[name], implementation)
}
assert.equal(typeof require('wp-awesome/integrations/woocommerce').createWooCommerceStoreApi, 'function')
assert.equal(typeof require('wp-awesome/integrations/yoast').createYoastSitemapIntegration, 'function')
assert.equal(typeof require('wp-awesome/integrations/forms').collectFormReferences, 'function')
for (const file of ['wp-awesome.php', 'lifecycle.php', 'uninstall.php']) {
  assert.ok(existsSync(join(dirname(require.resolve('wp-awesome')), 'wordpress-plugin', file)), `Installed plugin file missing: ${file}`)
}

const routeResolver = api.createWordPressRouteResolver({ siteUrl: 'https://site.example', routes: { page: '/{slug}/' } })
const record = api.normalizeWordPressRecord({
  id: 42, type: 'page', status: 'publish', slug: 'package-check',
  title: { rendered: 'Package check' }, content: { rendered: '<p>Public content.</p><script>unsafe()</script>' },
}, { type: 'page', routeResolver, contentPolicy: { mode: 'rendered' } })
assert.equal(record.route.path, '/package-check/')
assert.doesNotMatch(record.content.html, /script|unsafe/)

// Loading the real site adapter exercises its imports and integration setup without fetching content.
assert.ok(require('../src/_lib/wordpress-data.js'))
console.log('Verified the installed wp-awesome exports and CD2027 adapter imports.')
