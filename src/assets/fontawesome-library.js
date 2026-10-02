import { registerIconLibrary } from '/assets/webawesome/webawesome.js'
import { fontAwesomeIconDefinitions } from '/assets/fontawesome-icons.js'

function asSvgDataUrl(definition) {
  const [width, height, , , iconPaths] = definition.icon
  const paths = (Array.isArray(iconPaths) ? iconPaths : [iconPaths])
    .map((path) => `<path fill="currentColor" d="${path}"/>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${paths}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

registerIconLibrary('pro', {
  resolver(name, family) {
    const pack = family === 'brands' ? fontAwesomeIconDefinitions.brands : fontAwesomeIconDefinitions.solid
    const definition = pack[name] || fontAwesomeIconDefinitions.solid[name]
    if (!definition) return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22/%3E'
    return asSvgDataUrl(definition)
  },
})
