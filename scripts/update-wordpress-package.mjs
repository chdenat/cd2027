/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/update-wordpress-package.mjs
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Site repository whose dependency and lockfile are refreshed. */
const siteRoot = fileURLToPath(new URL('..', import.meta.url))
/** Standalone checkout; an explicit path can be supplied as the first argument. */
const packageRoot = resolve(process.argv[2] || join(siteRoot, '../wp-awesome'))
/** Package identity and release version used to name the generated archive. */
const metadata = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
if (metadata.name !== 'wp-awesome' || !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
  throw new Error('Expected the standalone wp-awesome package with a stable version.')
}

/**
 * Run one verification or dependency operation without shell interpolation.
 * @param {string[]} args Bun arguments.
 * @param {string} cwd Working directory.
 * @returns {void}
 */
const run = (args, cwd) => {
  const result = spawnSync('bun', args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`bun ${args.join(' ')} failed.`)
}

// A self-contained archive keeps clean CI installs working before the first remote release.
run(['run', 'verify'], packageRoot)
mkdirSync(join(siteRoot, 'vendor'), { recursive: true })
const temporary = mkdtempSync(join(tmpdir(), 'cd2027-wp-awesome-'))
let dependency
try {
  run(['pm', 'pack', '--ignore-scripts', '--destination', temporary], packageRoot)
  const source = join(temporary, `wp-awesome-${metadata.version}.tgz`)
  const digest = createHash('sha256').update(readFileSync(source)).digest('hex').slice(0, 12)
  const filename = `wp-awesome-${metadata.version}-${digest}.tgz`
  // Changing the path avoids Bun reusing a locked tarball with the same name and version.
  copyFileSync(source, join(siteRoot, 'vendor', filename))
  dependency = `file:vendor/${filename}`
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
const manifestPath = join(siteRoot, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.dependencies['wp-awesome'] = dependency
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
run(['install'], siteRoot)
console.log('Updated the checked wp-awesome archive, site dependency and Bun lockfile. Run bun run check before committing.')
