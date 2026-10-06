/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/assets/theme.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

const STORAGE_KEY = 'cd2027-color-scheme'
const PALETTE_STORAGE_KEY = 'cd2027-color-palette'
const root = document.documentElement
const preference = window.matchMedia('(prefers-color-scheme: dark)')
const validChoices = new Set(['system', 'light', 'dark'])
const paletteClasses = {
  rose: 'wa-palette-cd2027',
  green: 'wa-palette-cd2027-green',
  blue: 'wa-palette-cd2027-blue',
  orange: 'wa-palette-cd2027-orange',
}
const validPalettes = new Set(Object.keys(paletteClasses))

/** Reads a validated color-scheme preference; storage failures fall back to the system setting. */
function savedChoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return validChoices.has(saved) ? saved : null
  } catch { return null }
}

/** Reads a validated palette preference without making storage availability a page requirement. */
function savedPalette() {
  try {
    const saved = localStorage.getItem(PALETTE_STORAGE_KEY)
    return validPalettes.has(saved) ? saved : null
  } catch { return null }
}

/**
 * Applies one known project palette and synchronizes selector accessibility state.
 * @param {string} palette Palette key from `validPalettes`.
 * @returns {void}
 */
function applyPalette(palette) {
  const selectedPalette = validPalettes.has(palette) ? palette : 'rose'
  root.classList.remove(...Object.values(paletteClasses))
  root.classList.add(paletteClasses[selectedPalette])
  document.querySelectorAll('[data-theme-palette]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themePalette === selectedPalette))
  })
}

/**
 * Applies system, light, or dark mode and updates the selector icon and pressed states.
 * @param {'system'|'light'|'dark'} choice User color-scheme preference.
 * @returns {void}
 */
function applyColorScheme(choice) {
  const selectedChoice = validChoices.has(choice) ? choice : 'system'
  const dark = selectedChoice === 'dark' || (selectedChoice === 'system' && preference.matches)
  root.classList.remove('wa-light', 'wa-dark')
  root.classList.add('wa-theme-cd2027', dark ? 'wa-dark' : 'wa-light')

  const trigger = document.querySelector('[data-theme-selector-trigger]')
  const triggerIcon = trigger?.querySelector('[data-theme-selector-icon]')
  if (triggerIcon) {
    const icon = { system: 'circle-half-stroke', light: 'sun-bright', dark: 'moon' }[selectedChoice]
    triggerIcon.setAttribute('name', icon)
  }

  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === selectedChoice))
  })
}

applyPalette(savedPalette() || 'rose')
applyColorScheme(savedChoice() || 'system')

document.querySelectorAll('[data-theme-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    const choice = button.dataset.themeChoice
    if (!validChoices.has(choice)) return

    try { localStorage.setItem(STORAGE_KEY, choice) } catch { /* Keep the current page usable without storage. */ }
    applyColorScheme(choice)
  })
})

document.querySelectorAll('[data-theme-palette]').forEach((button) => {
  button.addEventListener('click', () => {
    const palette = button.dataset.themePalette
    if (!validPalettes.has(palette)) return

    try { localStorage.setItem(PALETTE_STORAGE_KEY, palette) } catch { /* Keep the current page usable without storage. */ }
    applyPalette(palette)
  })
})

preference.addEventListener?.('change', () => {
  if (!savedChoice() || savedChoice() === 'system') applyColorScheme('system')
})

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) applyColorScheme(savedChoice() || 'system')
  if (event.key === PALETTE_STORAGE_KEY || event.key === null) applyPalette(savedPalette() || 'rose')
})
