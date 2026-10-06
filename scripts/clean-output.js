/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/clean-output.js
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
const path = require('node:path')

/** Removes and recreates only this repository's Eleventy output directory. */
function cleanOutput() {
  const projectRoot = path.resolve(__dirname, '..')
  const outputDirectory = path.resolve(projectRoot, '_site')

  if (outputDirectory !== path.join(projectRoot, '_site')) {
    throw new Error(`Refusing to clean an unexpected output directory: ${outputDirectory}`)
  }

  // Keep the deletion boundary explicit: source, caches, and user files are outside this path.
  fs.rmSync(outputDirectory, { recursive: true, force: true })
  fs.mkdirSync(outputDirectory, { recursive: true })
}

module.exports = cleanOutput

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) cleanOutput()
