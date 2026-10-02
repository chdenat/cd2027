const STORAGE_KEY = 'cd2026-color-scheme'
const root = document.documentElement
const preference = window.matchMedia('(prefers-color-scheme: dark)')
const validChoices = new Set(['system', 'light', 'dark'])

function savedChoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return validChoices.has(saved) ? saved : null
  } catch { return null }
}

function applyColorScheme(choice) {
  const selectedChoice = validChoices.has(choice) ? choice : 'system'
  const dark = selectedChoice === 'dark' || (selectedChoice === 'system' && preference.matches)
  root.classList.remove('wa-light', 'wa-dark')
  root.classList.add('wa-theme-cd2026', 'wa-palette-cd2026', dark ? 'wa-dark' : 'wa-light')

  const trigger = document.querySelector('[data-theme-selector-trigger]')
  const triggerIcon = trigger?.querySelector('[data-theme-selector-icon]')
  if (triggerIcon) {
    const icon = { system: 'circle-half-stroke', light: 'sun', dark: 'moon' }[selectedChoice]
    triggerIcon.setAttribute('name', icon)
  }

  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === selectedChoice))
  })
}

applyColorScheme(savedChoice() || 'system')

document.querySelectorAll('[data-theme-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    const choice = button.dataset.themeChoice
    if (!validChoices.has(choice)) return

    try { localStorage.setItem(STORAGE_KEY, choice) } catch { /* Keep the current page usable without storage. */ }
    applyColorScheme(choice)
  })
})

preference.addEventListener?.('change', () => {
  if (!savedChoice() || savedChoice() === 'system') applyColorScheme('system')
})

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) applyColorScheme(savedChoice() || 'system')
})
