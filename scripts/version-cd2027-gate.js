/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/version-cd2027-gate.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-04
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

const fs = require('node:fs')
const path = require('node:path')

/**
 * Versions the private-site PHP gate and fills its Apache filename placeholders after a build.
 * @param {string} outputDir Eleventy output directory containing the gate and `.htaccess` template.
 * @param {string} [buildId] Identifier sanitized and truncated for the versioned gate filename.
 * @returns {string} Versioned gate filename written into `outputDir`.
 * @throws {Error} When either input file is missing, placeholders are absent, or the target exists.
 * @sideEffects Renames the gate file and rewrites the generated `.htaccess` file.
 */
module.exports = function versionCd2027Gate(outputDir, buildId = process.env.GITHUB_SHA || process.env.CD2027_BUILD_ID || 'local') {
  const version = String(buildId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'local'
  const gateFile = `cd2027-gate-${version}.php`
  const gatePath = path.join(outputDir, 'cd2027-gate.php')
  const versionedGatePath = path.join(outputDir, gateFile)
  const htaccessPath = path.join(outputDir, '.htaccess')
  const gateExists = fs.existsSync(gatePath) && fs.statSync(gatePath).isFile()
  const htaccessExists = fs.existsSync(htaccessPath) && fs.statSync(htaccessPath).isFile()

  if (!gateExists || !htaccessExists) {
    throw new Error('The private CD2027 gate or its Apache rules are missing from the build output.')
  }
  if (fs.existsSync(versionedGatePath)) {
    throw new Error(`The versioned CD2027 gate already exists: ${gateFile}`)
  }

  const htaccessTemplate = fs.readFileSync(htaccessPath, 'utf8')
  if (!htaccessTemplate.includes('@@CD2027_GATE_REGEX@@') || !htaccessTemplate.includes('@@CD2027_GATE_FILE@@')) {
    throw new Error('The Apache rules do not contain the CD2027 gate filename placeholders.')
  }

  const escapedGateFile = gateFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Apache must reference the unique gate filename so caches cannot serve a stale auth script.
  fs.renameSync(gatePath, versionedGatePath)
  fs.writeFileSync(
    htaccessPath,
    htaccessTemplate
      .replaceAll('@@CD2027_GATE_REGEX@@', escapedGateFile)
      .replaceAll('@@CD2027_GATE_FILE@@', gateFile),
  )

  return gateFile
}
