/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/build-fontawesome-icons.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

/** Bundles the project's explicitly allowlisted Font Awesome icons for browser modules. */
const result = await Bun.build({
  entrypoints: ['scripts/fontawesome-icons.entry.js'],
  outdir: '.build',
  naming: 'fontawesome-icons.js',
  target: 'browser',
  format: 'esm',
  minify: true,
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
