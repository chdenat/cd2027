/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/assets/theme.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-11-02
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

const STORAGE_KEY = 'cd2027-color-scheme'
const BACKGROUND_PALETTE_STORAGE_KEY = 'cd2027-background-palette'
const LEGACY_PALETTE_STORAGE_KEY = 'cd2027-color-palette'
const BUTTON_PALETTE_STORAGE_KEY = 'cd2027-button-palette'
const LEGACY_BUTTON_PALETTE_STORAGE_KEY = 'cd2027-heading-palette'
const root = document.documentElement
const preference = window.matchMedia('(prefers-color-scheme: dark)')
const validChoices = new Set(['system', 'light', 'dark'])
const backgroundPaletteClasses = {
  rose: 'wa-palette-cd2027',
  green: 'wa-palette-cd2027-green',
  blue: 'wa-palette-cd2027-blue',
  orange: 'wa-palette-cd2027-orange',
}
const validBackgroundPalettes = new Set(Object.keys(backgroundPaletteClasses))
const buttonPaletteClasses = {
  purple: 'cd2027-button-purple',
  rose: 'cd2027-button-rose',
  green: 'cd2027-button-green',
  blue: 'cd2027-button-blue',
  orange: 'cd2027-button-orange',
}
const validButtonPalettes = new Set(Object.keys(buttonPaletteClasses))

/** Reads a validated color-scheme preference; storage failures fall back to the system setting. */
function savedChoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return validChoices.has(saved) ? saved : null
  } catch { return null }
}

/** Reads a validated background palette, migrating an older theme-color preference when present. */
function savedBackgroundPalette() {
  try {
    const saved = localStorage.getItem(BACKGROUND_PALETTE_STORAGE_KEY) || localStorage.getItem(LEGACY_PALETTE_STORAGE_KEY)
    return validBackgroundPalettes.has(saved) ? saved : null
  } catch { return null }
}

/** Reads a validated button palette, migrating the previous heading-color preference when present. */
function savedButtonPalette() {
  try {
    const saved = localStorage.getItem(BUTTON_PALETTE_STORAGE_KEY) || localStorage.getItem(LEGACY_BUTTON_PALETTE_STORAGE_KEY)
    return validButtonPalettes.has(saved) ? saved : null
  } catch { return null }
}

/**
 * Applies one known background palette and synchronizes its selector accessibility state.
 * @param {string} palette Palette key from `validBackgroundPalettes`.
 * @returns {void}
 */
function applyBackgroundPalette(palette) {
  const selectedPalette = validBackgroundPalettes.has(palette) ? palette : 'rose'
  root.classList.remove(...Object.values(backgroundPaletteClasses))
  root.classList.add(backgroundPaletteClasses[selectedPalette])
  document.querySelectorAll('[data-background-palette]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.backgroundPalette === selectedPalette))
  })
}

/**
 * Applies one known button palette and synchronizes its selector accessibility state.
 * @param {string} palette Key from `validButtonPalettes`.
 * @returns {void}
 */
function applyButtonPalette(palette) {
  const selectedPalette = validButtonPalettes.has(palette) ? palette : 'purple'
  root.classList.remove(...Object.values(buttonPaletteClasses))
  root.classList.add(buttonPaletteClasses[selectedPalette])
  document.querySelectorAll('[data-button-palette]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.buttonPalette === selectedPalette))
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

applyBackgroundPalette(savedBackgroundPalette() || 'rose')
applyButtonPalette(savedButtonPalette() || 'purple')
applyColorScheme(savedChoice() || 'light')

document.querySelectorAll('[data-theme-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    const choice = button.dataset.themeChoice
    if (!validChoices.has(choice)) return

    try { localStorage.setItem(STORAGE_KEY, choice) } catch { /* Keep the current page usable without storage. */ }
    applyColorScheme(choice)
  })
})

document.querySelectorAll('[data-background-palette]').forEach((button) => {
  button.addEventListener('click', () => {
    const palette = button.dataset.backgroundPalette
    if (!validBackgroundPalettes.has(palette)) return

    try { localStorage.setItem(BACKGROUND_PALETTE_STORAGE_KEY, palette) } catch { /* Keep the current page usable without storage. */ }
    applyBackgroundPalette(palette)
  })
})

document.querySelectorAll('[data-button-palette]').forEach((button) => {
  button.addEventListener('click', () => {
    const palette = button.dataset.buttonPalette
    if (!validButtonPalettes.has(palette)) return

    try { localStorage.setItem(BUTTON_PALETTE_STORAGE_KEY, palette) } catch { /* Keep the current page usable without storage. */ }
    applyButtonPalette(palette)
  })
})

preference.addEventListener?.('change', () => {
  if (savedChoice() === 'system') applyColorScheme('system')
})

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) applyColorScheme(savedChoice() || 'light')
  if ([BACKGROUND_PALETTE_STORAGE_KEY, LEGACY_PALETTE_STORAGE_KEY, null].includes(event.key)) {
    applyBackgroundPalette(savedBackgroundPalette() || 'rose')
  }
  if ([BUTTON_PALETTE_STORAGE_KEY, LEGACY_BUTTON_PALETTE_STORAGE_KEY, null].includes(event.key)) {
    applyButtonPalette(savedButtonPalette() || 'purple')
  }
})
