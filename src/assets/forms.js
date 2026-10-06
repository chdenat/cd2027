/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/assets/forms.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

import { sanitizeFormHtml } from './form-sanitizer.mjs'

/** Updates the live status message for one mounted form. */
function formStatus(container, text, state = 'success') {
  const status = container.querySelector('.cd-form-status')
  if (!status) return
  status.textContent = text
  status.dataset.state = state
}

/** Extracts label text without duplicating nested form controls or required markers. */
function plainLabelText(label, control) {
  const clone = label.cloneNode(true)
  clone.querySelectorAll('input, textarea, select, button').forEach((node) => node.remove())
  if (control && clone.contains(control)) control.remove()
  return clone.textContent.replace(/\s+/g, ' ').replace(/\s*\*\s*/g, ' ').trim()
}

/** Resolves either a wrapping or `for`-associated label within the source form. */
function associatedLabel(form, field) {
  if (field.closest('label')) return field.closest('label')
  if (!field.id) return null
  return [...form.querySelectorAll('label[for]')].find((label) => label.htmlFor === field.id) || null
}

/** Finds an accessible label across the supported Forminator and MailPoet source structures. */
function getFieldLabel(form, field) {
  const label = associatedLabel(form, field)
  if (label) return plainLabelText(label, field)
  const wrapper = field.closest('.forminator-field, .mailpoet_paragraph, .form-field')
  const providerLabel = wrapper?.querySelector('.forminator-label, .mailpoet_text_label, .mailpoet_textarea_label, legend')
  if (providerLabel) return providerLabel.textContent.replace(/\s+/g, ' ').replace(/\s*\*\s*/g, ' ').trim()
  return field.getAttribute('aria-label') || field.name?.replace(/[_\[\]]+/g, ' ').trim() || 'Votre réponse'
}

/** Copies validation attributes while excluding inline code and source-controlled styles. */
function copyFieldAttributes(source, target, excluded = []) {
  for (const attribute of source.attributes) {
    if (excluded.includes(attribute.name) || attribute.name === 'style' || attribute.name.startsWith('on')) continue
    target.setAttribute(attribute.name, attribute.value)
  }
  target.className = source.className
}

function removeSourceLabel(form, field) {
  const label = associatedLabel(form, field)
  if (label) label.remove()
}

/**
 * Rebuilds each native radio set as a labeled Web Awesome group while preserving its values.
 * @param {HTMLFormElement} form Detached provider form being normalized.
 * @returns {void}
 * @sideEffects Replaces radio inputs and their source labels within `form`.
 */
function convertRadioGroups(form) {
  const radios = [...form.querySelectorAll('input[type="radio"]')]
  const consumed = new Set()
  for (const first of radios) {
    if (consumed.has(first)) continue
    const siblings = radios.filter((radio) => radio.name === first.name)
    siblings.forEach((radio) => consumed.add(radio))
    const field = first.closest('.forminator-field, .mailpoet_paragraph, .form-field') || first.parentElement
    const group = document.createElement('wa-radio-group')
    if (first.name) group.name = first.name
    const heading = field?.querySelector('legend, .forminator-label, .mailpoet_text_label')
    group.label = heading?.textContent.replace(/\s+/g, ' ').trim() || 'Choisissez une option'
    if (siblings.some((radio) => radio.required)) group.required = true
    group.className = field?.className || 'cd-form-radio-group'

    for (const radio of siblings) {
      const choice = document.createElement('wa-radio')
      choice.value = radio.value || 'on'
      choice.checked = radio.checked
      choice.disabled = radio.disabled
      choice.textContent = getFieldLabel(form, radio)
      choice.className = radio.className
      const label = associatedLabel(form, radio)
      const holder = label || radio
      if (radio === first) holder.replaceWith(group)
      else holder.remove()
      group.append(choice)
    }
    field?.querySelectorAll('.forminator-label, .mailpoet_text_label, .mailpoet_textarea_label').forEach((label) => label.remove())
  }
}

/**
 * Removes executable/provider presentation markup and converts supported controls to Web Awesome.
 * @param {HTMLFormElement} form Detached provider form to normalize.
 * @returns {HTMLFormElement} The same form with supported controls converted.
 */
function cleanForm(form) {
  form.querySelectorAll('script, style').forEach((node) => node.remove())
  for (const node of [form, ...form.querySelectorAll('[style]')]) {
    if (node.style.display === 'none') node.hidden = true
    node.removeAttribute('style')
  }
  form.querySelectorAll('.forminator-hidden, [aria-hidden="true"]').forEach((node) => { node.hidden = true })
  form.action = '#'
  form.method = 'post'
  form.classList.add('cd-form')
  form.querySelectorAll('[onchange], [onclick]').forEach((node) => {
    node.removeAttribute('onchange')
    node.removeAttribute('onclick')
  })

  convertRadioGroups(form)

  for (const field of [...form.querySelectorAll('input, textarea, select, button')]) {
    if (field.closest('[hidden]')) continue
    if (field.matches('input[type="radio"]')) continue
    const tag = field.tagName.toLowerCase()
    const type = (field.getAttribute('type') || 'text').toLowerCase()
    const label = getFieldLabel(form, field)

    if (tag === 'input' && type === 'hidden') continue
    if (tag === 'input' && ['file', 'image'].includes(type)) continue

    let component
    if (tag === 'textarea') {
      component = document.createElement('wa-textarea')
      copyFieldAttributes(field, component, ['rows'])
      component.label = label
      component.rows = Number(field.getAttribute('rows') || 3)
      component.value = field.value
    } else if (tag === 'select') {
      component = document.createElement('wa-select')
      copyFieldAttributes(field, component, ['size'])
      component.label = label
      for (const option of field.options) {
        const webOption = document.createElement('wa-option')
        webOption.value = option.value
        webOption.textContent = option.textContent
        webOption.selected = option.selected
        webOption.disabled = option.disabled
        component.append(webOption)
      }
    } else if (tag === 'button' || ['button', 'submit', 'reset'].includes(type)) {
      component = document.createElement('wa-button')
      copyFieldAttributes(field, component, ['value'])
      component.type = tag === 'button' ? (field.getAttribute('type') || 'submit') : type
      component.variant = component.type === 'submit' ? 'brand' : 'neutral'
      component.appearance = component.type === 'submit' ? 'outlined' : 'plain'
      component.textContent = tag === 'button' ? field.textContent.trim() : (field.value || 'Envoyer')
    } else if (tag === 'input' && type === 'checkbox') {
      component = document.createElement('wa-checkbox')
      copyFieldAttributes(field, component, ['type', 'checked'])
      component.value = field.value || 'on'
      component.checked = field.checked
      component.textContent = label
    } else {
      component = document.createElement('wa-input')
      copyFieldAttributes(field, component, ['type', 'value'])
      const supportedType = ['date', 'datetime-local', 'email', 'number', 'password', 'search', 'tel', 'text', 'time', 'url'].includes(type) ? type : 'text'
      component.type = supportedType
      component.value = field.value
      component.label = label
    }

    const sourceLabel = associatedLabel(form, field)
    if (sourceLabel?.contains(field)) sourceLabel.replaceWith(component)
    else {
      sourceLabel?.remove()
      field.replaceWith(component)
    }
  }
  return form
}

/**
 * Sends a validated form through the same-origin adapter and reports the backend result.
 * @param {HTMLElement} container Mounted form shell containing provider metadata and status.
 * @param {HTMLFormElement} form Submitted Web Awesome form.
 * @returns {Promise<void>}
 * @sideEffects Posts form data to the same-origin local adapter and updates status text.
 */
async function submitBackendForm(container, form) {
  const provider = container.dataset.provider
  const formId = Number(container.dataset.formId)
  const path = window.location.pathname
  const status = container.querySelector('.cd-form-status')
  const submit = form.querySelector('wa-button[type="submit"], [type="submit"]')
  if (form.querySelector('input[type="file"]')) {
    formStatus(container, 'Ce formulaire contient un fichier joint. Son transfert doit être configuré avec le service WordPress avant utilisation.', 'error')
    return
  }

  const body = new URLSearchParams()
  new FormData(form).forEach((value, key) => body.append(key, String(value)))
  if (submit) submit.disabled = true
  if (status) status.textContent = 'Envoi en cours…'
  try {
    const response = await fetch('/api/forms/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
      body: new URLSearchParams({ provider, formId: String(formId), path, fields: body.toString() }),
    })
    const result = await response.json()
    if (!response.ok || result.success === false || result.data?.success === false) {
      const message = result.data?.message || result.message || 'Le formulaire n’a pas pu être transmis. Réessayez dans quelques instants.'
      throw new Error(message)
    }
    formStatus(container, result.message || result.data?.message || 'Votre demande a bien été transmise. Merci.', 'success')
    if (provider === 'forminator') form.reset()
  } catch (error) {
    formStatus(container, error.message, 'error')
  } finally {
    if (submit) submit.disabled = false
  }
}

/**
 * Loads, sanitizes, and mounts an allowlisted WordPress form into its page placeholder.
 * @param {HTMLElement} container Eleventy form mount carrying provider and form ID data attributes.
 * @returns {Promise<void>}
 * @sideEffects Fetches form markup and replaces the mount's children.
 */
async function mountForm(container) {
  const provider = container.dataset.cdForm
  const formId = Number(container.dataset.formId)
  const mount = document.createElement('div')
  mount.className = 'cd-form-shell'
  mount.dataset.provider = provider
  mount.dataset.formId = String(formId)
  mount.innerHTML = '<p class="cd-form-status" role="status" aria-live="polite">Chargement du formulaire…</p>'
  container.replaceChildren(mount)
  try {
    const response = await fetch('/api/forms/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ provider, formId, path: window.location.pathname }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Le formulaire est momentanément indisponible.')
    const form = sanitizeFormHtml(result.html || '', { document, DOMParser })
    if (!form) throw new Error('Le service de formulaire n’a pas fourni de champs utilisables.')
    mount.replaceChildren(cleanForm(form))
    const status = document.createElement('p')
    status.className = 'cd-form-status'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    mount.append(status)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (form.reportValidity()) submitBackendForm(mount, form)
    })
  } catch (error) {
    const status = mount.querySelector('.cd-form-status') || document.createElement('p')
    status.className = 'cd-form-status'
    status.dataset.state = 'error'
    status.setAttribute('role', 'status')
    status.textContent = error.message
    mount.replaceChildren(status)
  }
}

document.querySelectorAll('[data-cd-form]').forEach(mountForm)
