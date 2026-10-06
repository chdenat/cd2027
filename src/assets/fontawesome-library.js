/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/assets/fontawesome-library.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

import { registerIconLibrary } from '/assets/webawesome/webawesome.js'
import { fontAwesomeIconDefinitions } from '/assets/fontawesome-icons.js'

/**
 * Serializes a trusted bundled Font Awesome definition as an encoded SVG data URL.
 * @param {object} definition Font Awesome icon definition from the local build allowlist.
 * @returns {string} Encoded SVG data URL for Web Awesome's icon resolver.
 */
function asSvgDataUrl(definition) {
  const [width, height, , , iconPaths] = definition.icon
  const paths = (Array.isArray(iconPaths) ? iconPaths : [iconPaths])
    .map((path) => `<path fill="currentColor" d="${path}"/>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${paths}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// Resolve only bundled definitions; unknown names return an empty icon rather than fetching URLs.
registerIconLibrary('pro', {
  resolver(name, family) {
    const pack = family === 'brands' ? fontAwesomeIconDefinitions.brands : fontAwesomeIconDefinitions.solid
    const definition = pack[name] || fontAwesomeIconDefinitions.solid[name]
    if (!definition) return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22/%3E'
    return asSvgDataUrl(definition)
  },
})
