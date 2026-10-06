/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/assets/form-sanitizer.mjs
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

const ALLOWED_TAGS = new Set([
  'form', 'div', 'p', 'span', 'label', 'fieldset', 'legend', 'input', 'textarea',
  'select', 'optgroup', 'option', 'button', 'a', 'ul', 'ol', 'li', 'strong', 'b',
  'em', 'i', 'small', 'br', 'hr',
])

const DROP_CONTENT_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'form',
  'noscript', 'xmp', 'noembed', 'noframes', 'img', 'video', 'audio', 'source',
])

const GLOBAL_ATTRIBUTES = new Set(['class', 'id', 'title', 'role', 'dir', 'lang', 'hidden'])
const TAG_ATTRIBUTES = {
  form: new Set(['name', 'autocomplete', 'novalidate']),
  label: new Set(['for']),
  input: new Set([
    'type', 'name', 'value', 'required', 'disabled', 'checked', 'placeholder', 'autocomplete',
    'min', 'max', 'step', 'minlength', 'maxlength', 'pattern', 'inputmode', 'readonly',
  ]),
  textarea: new Set(['name', 'required', 'disabled', 'placeholder', 'rows', 'cols', 'minlength', 'maxlength', 'readonly']),
  select: new Set(['name', 'required', 'disabled', 'multiple', 'size']),
  optgroup: new Set(['label', 'disabled']),
  option: new Set(['value', 'selected', 'disabled', 'label']),
  button: new Set(['name', 'value', 'type', 'disabled']),
  a: new Set(['href', 'target', 'rel']),
}

const INPUT_TYPES = new Set([
  'button', 'checkbox', 'date', 'datetime-local', 'email', 'file', 'hidden', 'month', 'number',
  'password', 'radio', 'reset', 'search', 'submit', 'tel', 'text', 'time', 'url', 'week',
])
const BUTTON_TYPES = new Set(['button', 'reset', 'submit'])

function isSafeHref(value, targetDocument) {
  const href = String(value || '').trim()
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return null
  try {
    const base = new URL(targetDocument.baseURI)
    const url = new URL(href, base)
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return href
  } catch {
    return null
  }
  return null
}

function copySafeAttributes(source, target, targetDocument) {
  const tag = source.localName.toLowerCase()
  const allowed = new Set([...GLOBAL_ATTRIBUTES, ...(TAG_ATTRIBUTES[tag] || [])])

  // Preserve the source's hidden state without allowing any source CSS into the live document.
  if (source.style?.display === 'none') target.hidden = true

  for (const attribute of source.attributes) {
    const name = attribute.name.toLowerCase()
    if (/^aria-[a-z\d-]+$/.test(name)) {
      target.setAttribute(name, attribute.value)
      continue
    }
    if (!allowed.has(name) || /^on/i.test(name)) continue

    let value = attribute.value
    if (tag === 'a' && name === 'href') {
      value = isSafeHref(value, targetDocument)
      if (!value) continue
    }
    if (tag === 'a' && name === 'target' && !['_blank', '_self', '_parent', '_top'].includes(value)) continue
    if (tag === 'input' && name === 'type' && !INPUT_TYPES.has(value.toLowerCase())) continue
    if (tag === 'button' && name === 'type' && !BUTTON_TYPES.has(value.toLowerCase())) continue
    target.setAttribute(name, value)
  }

  if (tag === 'a' && target.getAttribute('target') === '_blank') {
    const rel = new Set((target.getAttribute('rel') || '').split(/\s+/).filter(Boolean))
    rel.add('noopener')
    rel.add('noreferrer')
    target.setAttribute('rel', [...rel].join(' '))
  }
}

function copyNode(source, targetDocument) {
  if (source.nodeType === 3) return targetDocument.createTextNode(source.nodeValue || '')
  if (source.nodeType !== 1) return null

  const tag = source.localName.toLowerCase()
  if (DROP_CONTENT_TAGS.has(tag)) return null
  if (!ALLOWED_TAGS.has(tag)) {
    const wrapper = targetDocument.createDocumentFragment()
    for (const child of source.childNodes) {
      const safeChild = copyNode(child, targetDocument)
      if (safeChild) wrapper.append(safeChild)
    }
    return wrapper
  }

  if (tag === 'input' && source.getAttribute('type')?.toLowerCase() === 'image') return null
  const safeElement = targetDocument.createElement(tag)
  copySafeAttributes(source, safeElement, targetDocument)
  if (tag === 'input' && !safeElement.hasAttribute('type')) safeElement.setAttribute('type', 'text')
  if (tag === 'button' && !safeElement.hasAttribute('type')) safeElement.setAttribute('type', 'submit')

  if (!['input', 'br', 'hr'].includes(tag)) {
    for (const child of source.childNodes) {
      const safeChild = copyNode(child, targetDocument)
      if (safeChild) safeElement.append(safeChild)
    }
  }
  return safeElement
}

/**
 * Parses provider HTML in an inert document and rebuilds one form from safe native elements only.
 * The returned elements belong to the live target document and carry no source event/style attributes.
 * @param {string} html HTML returned by the same-origin form adapter.
 * @param {{document?: Document, DOMParser?: typeof DOMParser}} [environment] Injectable browser objects for tests.
 * @returns {HTMLFormElement|null} A fresh allowlisted form or null when no form was returned.
 */
export function sanitizeFormHtml(html, { document: targetDocument = document, DOMParser: Parser = DOMParser } = {}) {
  const inertDocument = new Parser().parseFromString(String(html || ''), 'text/html')
  const sourceForm = inertDocument.querySelector('form')
  if (!sourceForm) return null

  const safeForm = targetDocument.createElement('form')
  copySafeAttributes(sourceForm, safeForm, targetDocument)
  for (const child of sourceForm.childNodes) {
    const safeChild = copyNode(child, targetDocument)
    if (safeChild) safeForm.append(safeChild)
  }
  return safeForm
}
