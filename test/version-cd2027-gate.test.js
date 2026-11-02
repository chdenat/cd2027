/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: test/version-cd2027-gate.test.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-11-02
 * Last modified: 2026-11-02
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

'use strict'

const assert = require('node:assert/strict')
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const nunjucks = require('nunjucks')
const versionCd2027Gate = require('../scripts/version-cd2027-gate.js')

const validGateSource = '<?php\ndeclare(strict_types=1);\nhttp_response_code(200);\n'
const apacheTemplate = 'RewriteRule ^cd2027-gate.php$ @@CD2027_GATE_FILE@@ [L]\n# @@CD2027_GATE_REGEX@@\n'

/** Creates an isolated build-output fixture and removes it after the test completes. */
function createBuildOutput(t, gateSource) {
  const outputDir = mkdtempSync(path.join(os.tmpdir(), 'cd2027-gate-test-'))
  t.after(() => rmSync(outputDir, { recursive: true, force: true }))
  writeFileSync(path.join(outputDir, 'cd2027-gate.php'), gateSource)
  writeFileSync(path.join(outputDir, '.htaccess'), apacheTemplate)
  return outputDir
}

test('renders the Eleventy gate template with strict_types as its first PHP statement', () => {
  const templatePath = path.join(__dirname, '..', 'src', 'cd2027-gate.php.njk')
  const templateSource = readFileSync(templatePath, 'utf8')
  const templateBody = templateSource.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '')
  const rendered = nunjucks.renderString(templateBody, { site: { privateView: true } })

  assert.match(rendered, /^<\?php\s*declare\s*\(\s*strict_types\s*=\s*1\s*\)\s*;/)
})

test('versions a gate that starts with its PHP strict_types declaration', (t) => {
  const outputDir = createBuildOutput(t, validGateSource)
  const versionedFile = versionCd2027Gate(outputDir, 'release-41476654414')

  assert.equal(versionedFile, 'cd2027-gate-release-4147.php')
  assert.equal(readFileSync(path.join(outputDir, versionedFile), 'utf8'), validGateSource)
  assert.match(readFileSync(path.join(outputDir, '.htaccess'), 'utf8'), /cd2027-gate-release-4147\.php/)
})

test('rejects whitespace before the PHP opening tag before changing release files', (t) => {
  const outputDir = createBuildOutput(t, `\n${validGateSource}`)

  assert.throws(
    () => versionCd2027Gate(outputDir, 'bad-gate'),
    /must start with its PHP opening tag and strict_types declaration/,
  )
  assert.equal(readFileSync(path.join(outputDir, 'cd2027-gate.php'), 'utf8'), `\n${validGateSource}`)
  assert.equal(readFileSync(path.join(outputDir, '.htaccess'), 'utf8'), apacheTemplate)
})
