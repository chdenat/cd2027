/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/check-file-headers.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

import assert from 'node:assert/strict'
import { buildHeader, isSupportedSourceFile, updateHeader } from './update-file-headers.mjs'

const date = '2026-10-04'
const header = buildHeader('src/assets/styles.css', date, date)

assert.match(header, /This file is part of the CD2027 project\./)
assert.match(header, /File: src\/assets\/styles\.css/)
assert.match(header, /Author: Christian Denat/)
assert.match(header, /Email: christian\.denat@orange\.fr/)
assert.match(header, /Created on: 2026-10-04/)
assert.match(header, /Last modified: 2026-10-04/)
assert.match(header, /Copyright © 2026 Christian Denat/)

const javascript = updateHeader('export const answer = 42\n', 'src/example.js', date, date)
assert.match(javascript, /^\/\*\*+/)
assert.match(javascript, /\* This file is part of the CD2027 project\./)
assert.equal(updateHeader(javascript, 'src/example.js', date, date), javascript)
const javascriptWithLeadingBlankLines = updateHeader('\n\nexport const answer = 42\n', 'src/example.js', date, date)
assert.match(javascriptWithLeadingBlankLines, /\*\/\n\n\n\nexport const answer = 42/)

const template = updateHeader('---\nlayout: layouts/base.njk\n---\n<h1>Page</h1>\n', 'src/example.njk', date, date)
assert.match(template, /^---\nlayout: layouts\/base\.njk\n---\n\{#/)
assert.match(template, /\{#\n \* This file is part of the CD2027 project\./)
const frontMatterOnly = updateHeader('---\npermalink: /example/\n---\n', 'src/example.njk', date, date)
assert.equal(frontMatterOnly.endsWith('#}\n'), true)

const markdown = updateHeader('---\ntitle: Guide\n---\n# Guide\n', 'docs/guide.md', date, date)
assert.match(markdown, /^---\ntitle: Guide\n---\n<!--/)

const shell = updateHeader('#!/usr/bin/env bash\nset -euo pipefail\n', 'scripts/example.sh', date, date)
assert.match(shell, /^#!\/usr\/bin\/env bash\n# \*+/)

const php = updateHeader('<?php\ndeclare(strict_types=1);\n', 'wordpress/plugin.php', date, date)
assert.match(php, /^<\?php\n\/\*\*+/)

const yaml = updateHeader('name: cd2027\n', '.github/workflows/example.yml', date, date)
assert.match(yaml, /^# \*+/)
assert.match(yaml, /# This file is part of the CD2027 project\./)

const packageDocumentation = buildHeader('docs/reusable-wordpress-eleventy-content-pipeline.md', date, date)
assert.match(packageDocumentation, /This file is part of the wp-awesome package\./)
assert.doesNotMatch(packageDocumentation, /CD2027|christinedeloupy|orange\.fr/i)

const xml = updateHeader('<?xml version="1.0" encoding="UTF-8"?>\n<root />\n', 'config/site.xml', date, date)
assert.match(xml, /^<\?xml[^\n]+\n<!--/)

assert.equal(isSupportedSourceFile('package.json'), false)
assert.equal(isSupportedSourceFile('_site/index.html'), false)
assert.equal(isSupportedSourceFile('node_modules/library/index.js'), false)
assert.equal(isSupportedSourceFile('.githooks/pre-commit'), true)
assert.equal(isSupportedSourceFile('src/assets/styles.css'), true)
assert.equal(isSupportedSourceFile('src/_lib/wordpress-data.js'), true)

console.log('Source file header checks passed.')
