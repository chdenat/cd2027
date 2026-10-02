const CART_TOKEN_KEY = 'cd2026-cart-token'
const API_ROOT = '/wp-json/wc/store/v1'

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return entities[character]
  })
}

function getToken() {
  try { return sessionStorage.getItem(CART_TOKEN_KEY) || '' } catch { return '' }
}

function saveToken(token) {
  if (!token) return
  try { sessionStorage.setItem(CART_TOKEN_KEY, token) } catch { /* Private mode can disable storage. */ }
}

async function storeApi(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (getToken()) headers.set('Cart-Token', getToken())
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers, cache: 'no-store' })
  saveToken(response.headers.get('Cart-Token'))
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.message || data.code || `La boutique a répondu ${response.status}.`
    throw new Error(message)
  }
  return data
}

function money(value, currency = 'EUR', minorUnit = 2) {
  const amount = Number(value || 0) / 10 ** Number(minorUnit || 0)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount)
}

function updateCartCount(cart) {
  const count = Number(cart?.items_count || 0)
  document.querySelectorAll('[data-cart-count]').forEach((node) => {
    node.textContent = String(count)
    node.closest('[data-cart-badge]')?.toggleAttribute('hidden', count < 1)
  })
}

async function loadHeaderCartCount() {
  try {
    updateCartCount(await storeApi('/cart'))
  } catch {
    updateCartCount({ items_count: 0 })
  }
}

function statusNode() {
  return document.querySelector('[data-commerce-status]')
}

function showStatus(message, isError = false) {
  const node = statusNode()
  if (!node) return
  node.textContent = message
  node.toggleAttribute('data-error', isError)
}

function cartItemMarkup(item) {
  const image = item.images?.[0]?.thumbnail || item.images?.[0]?.src || ''
  const subtotal = item.totals?.line_subtotal || item.totals?.line_total || '0'
  const prices = item.prices || {}
  return `<wa-card class="cart-row" appearance="outlined" data-cart-key="${escapeHtml(item.key)}">
    <div class="cart-row__layout">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" />` : ''}
      <div class="cart-row__details"><h3>${escapeHtml(item.name)}</h3><p>${money(subtotal, prices.currency_code, prices.currency_minor_unit)}</p></div>
      <div class="cart-row__actions">
      <wa-input label="Quantité de ${escapeHtml(item.name)}" type="number" min="1" step="1" value="${Number(item.quantity) || 1}" data-cart-quantity></wa-input>
      <wa-button appearance="plain" variant="danger" data-cart-remove>Retirer</wa-button>
      </div>
    </div>
  </wa-card>`
}

function renderCart(cart) {
  updateCartCount(cart)
  const root = document.querySelector('#cart-view')
  if (!root) return
  const recommendations = document.querySelector('[data-cart-recommendations]')
  if (recommendations) recommendations.hidden = Boolean(cart.items?.length)
  if (!cart.items?.length) {
    root.innerHTML = `<wa-card class="commerce-panel" appearance="outlined"><p>Votre panier est vide pour le moment.</p><p><wa-button href="/boutique/" variant="brand" appearance="outlined">Découvrir la boutique</wa-button></p></wa-card>`
    return
  }
  const totals = cart.totals || {}
  const prices = totals
  const itemRows = cart.items.map(cartItemMarkup).join('')
  root.innerHTML = `<wa-card class="commerce-panel cart-items-panel" appearance="outlined"><div class="cart-items">${itemRows}</div></wa-card>
    <wa-card class="commerce-panel cart-summary" appearance="outlined"><h2>Récapitulatif</h2>
      <div class="cart-total-line"><span>Sous-total</span><strong>${money(totals.total_items, prices.currency_code, prices.currency_minor_unit)}</strong></div>
      ${Number(totals.total_discount || 0) ? `<div class="cart-total-line"><span>Réductions</span><strong>−${money(totals.total_discount, prices.currency_code, prices.currency_minor_unit)}</strong></div>` : ''}
      ${totals.total_shipping ? `<div class="cart-total-line"><span>Livraison</span><strong>${money(totals.total_shipping, prices.currency_code, prices.currency_minor_unit)}</strong></div>` : ''}
      <div class="cart-total-line cart-total-line--grand"><span>Total</span><strong>${money(totals.total_price, prices.currency_code, prices.currency_minor_unit)}</strong></div>
      <p><wa-button href="/commande/" variant="brand" appearance="outlined">Continuer la commande</wa-button></p>
      <p><wa-button href="/boutique/" appearance="plain">Retourner à la boutique</wa-button></p>
      <p class="form-message" data-commerce-status role="status" aria-live="polite"></p>
    </wa-card>`
}

const billingFields = [
  ['first_name', 'Prénom', 'text', true], ['last_name', 'Nom', 'text', true],
  ['company', 'Entreprise (facultatif)', 'text', false], ['address_1', 'Adresse', 'text', true],
  ['address_2', 'Complément d’adresse', 'text', false], ['postcode', 'Code postal', 'text', true],
  ['city', 'Ville', 'text', true], ['country', 'Pays (code ISO)', 'text', true],
  ['email', 'Adresse e-mail', 'email', true], ['phone', 'Téléphone', 'tel', false],
]

function makeAddressFields(prefix, address = {}, disabled = false) {
  return billingFields.map(([key, label, type, required]) => {
    const value = address[key] || (key === 'country' ? 'FR' : '')
    return `<wa-input label="${label}" type="${type}" name="${prefix}[${key}]" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} ${key === 'email' ? 'autocomplete="email"' : ''}></wa-input>`
  }).join('')
}

function paymentLabel(method) {
  const labels = { bacs: 'Virement bancaire', paypal: 'PayPal', stripe: 'Carte bancaire', cheque: 'Chèque' }
  return labels[method] || method.replace(/[_-]+/g, ' ')
}

function renderShippingRates(cart) {
  const root = document.querySelector('#shipping-methods')
  if (!root) return
  const groups = cart.shipping_rates || []
  const rates = groups.flatMap((group) => (group.shipping_rates || []).map((rate) => ({ ...rate, packageId: group.package_id })))
  if (!rates.length) {
    root.innerHTML = cart.needs_shipping ? '<p class="form-message">Saisissez votre adresse pour afficher les options de livraison.</p>' : ''
    return
  }
  const selectedRate = rates.find((rate) => rate.selected)
  root.innerHTML = `<wa-radio-group class="payment-methods" name="shipping_rate" label="Mode de livraison" value="${selectedRate ? escapeHtml(`${selectedRate.packageId}|${selectedRate.rate_id}`) : ''}">${rates.map((rate) => `<wa-radio value="${escapeHtml(`${rate.packageId}|${rate.rate_id}`)}" ${rate.selected ? 'checked' : ''}><strong>${escapeHtml(rate.name)}</strong> · ${money(rate.price, cart.totals?.currency_code, cart.totals?.currency_minor_unit)}</wa-radio>`).join('')}</wa-radio-group>`
}

function renderCheckout(cart, checkout = {}) {
  updateCartCount(cart)
  const root = document.querySelector('#checkout-view')
  if (!root) return
  if (!cart.items?.length) {
    root.innerHTML = `<wa-card class="commerce-panel" appearance="outlined"><p>Votre panier est vide.</p><p><wa-button href="/boutique/" variant="brand" appearance="outlined">Voir la boutique</wa-button></p></wa-card>`
    return
  }
  const methods = cart.payment_methods || []
  const total = cart.totals || {}
  const itemsSummary = cart.items.map((item) => `<li><span>${escapeHtml(item.name)} × ${Number(item.quantity) || 1}</span><strong>${money(item.totals?.line_total, total.currency_code, total.currency_minor_unit)}</strong></li>`).join('')
  const paymentMarkup = methods.map((method, index) => `<wa-radio value="${escapeHtml(method)}" ${index === 0 ? 'checked' : ''}>${escapeHtml(paymentLabel(method))}</wa-radio>`).join('')
  root.innerHTML = `<form id="checkout-form" class="checkout-form">
    <wa-card class="commerce-panel" appearance="outlined"><h2>Vos coordonnées</h2><div class="checkout-fields">${makeAddressFields('billing_address', checkout.billing_address)}</div>
      ${cart.needs_shipping ? `<p><wa-checkbox id="shipping-same" checked>Utiliser cette adresse pour la livraison</wa-checkbox></p>
      <div id="shipping-address-fields" hidden><h2>Adresse de livraison</h2><div class="checkout-fields">${makeAddressFields('shipping_address', checkout.shipping_address, true)}</div></div>
      <div id="shipping-methods"></div>` : ''}
      <wa-textarea label="Note de commande (facultatif)" name="customer_note" rows="3"></wa-textarea>
    </wa-card>
    <wa-card class="commerce-panel" appearance="outlined"><h2>Votre commande</h2><ul class="order-lines">${itemsSummary}</ul>
      <div class="cart-total-line cart-total-line--grand"><span>Total</span><strong>${money(total.total_price, total.currency_code, total.currency_minor_unit)}</strong></div>
      ${paymentMarkup ? `<wa-radio-group class="payment-methods" name="payment_method" label="Mode de paiement" value="${escapeHtml(methods[0])}" required>${paymentMarkup}</wa-radio-group>` : '<p>Aucun moyen de paiement n’est disponible.</p>'}
      <wa-checkbox class="terms-choice" name="terms" value="accepted" required>J’accepte les conditions de vente et de confidentialité.</wa-checkbox>
      <p class="terms-links"><wa-button href="/cgv/" appearance="plain" size="s">Conditions générales de vente</wa-button><wa-button href="/politique-de-confidentialite/" appearance="plain" size="s">Politique de confidentialité</wa-button></p>
      <wa-button type="submit" variant="brand" appearance="outlined" id="place-order">Valider et payer</wa-button>
      <p class="form-message" id="checkout-status" role="status" aria-live="polite"></p>
    </wa-card>
  </form>`
  renderShippingRates(cart)
}

async function loadCartPage() {
  try {
    const cart = await storeApi('/cart')
    renderCart(cart)
  } catch (error) {
    const root = document.querySelector('#cart-view')
    if (root) root.innerHTML = `<wa-card class="commerce-panel commerce-error" appearance="outlined"><p>${escapeHtml(error.message)} Vérifiez que le proxy WooCommerce local est disponible.</p></wa-card>`
  }
}

async function loadCheckoutPage() {
  const root = document.querySelector('#checkout-view')
  try {
    const cart = await storeApi('/cart')
    if (!cart.items?.length) return renderCheckout(cart)
    const checkout = await storeApi('/checkout')
    renderCheckout(cart, checkout)
  } catch (error) {
    if (root) root.innerHTML = `<wa-card class="commerce-panel commerce-error" appearance="outlined"><p>${escapeHtml(error.message)} Le service de commande WooCommerce n’a pas répondu.</p></wa-card>`
  }
}

async function refreshShipping(form) {
  const status = document.querySelector('#checkout-status')
  const address = collectAddress(form, 'billing_address')
  const shippingSame = document.querySelector('#shipping-same')?.checked !== false
  const shippingAddress = shippingSame ? { ...address } : collectAddress(form, 'shipping_address')
  try {
    const cart = await storeApi('/cart/update-customer', {
      method: 'POST', body: JSON.stringify({ billing_address: address, shipping_address: shippingAddress }),
    })
    renderShippingRates(cart)
    if (status) status.textContent = ''
    return cart
  } catch (error) {
    if (status) status.textContent = error.message
    return null
  }
}

function collectAddress(form, prefix) {
  const address = {}
  form.querySelectorAll(`[name^="${prefix}["]`).forEach((field) => {
    const key = field.name.slice(prefix.length + 1, -1)
    address[key] = field.value || ''
  })
  return address
}

async function placeOrder(form) {
  const status = document.querySelector('#checkout-status')
  const submit = document.querySelector('#place-order')
  const cartBefore = await storeApi('/cart')
  const billingAddress = collectAddress(form, 'billing_address')
  const shippingSame = document.querySelector('#shipping-same')?.checked !== false
  const shippingAddress = cartBefore.needs_shipping
    ? (shippingSame ? { ...billingAddress } : collectAddress(form, 'shipping_address'))
    : { ...billingAddress }
  const shippingChoice = form.querySelector('wa-radio-group[name="shipping_rate"]')?.value

  if (cartBefore.needs_shipping && shippingChoice) {
    const [packageId, rateId] = shippingChoice.split('|')
    await storeApi(`/cart/select-shipping-rate?package_id=${encodeURIComponent(packageId)}&rate_id=${encodeURIComponent(rateId)}`, {
      method: 'POST', body: JSON.stringify({ package_id: Number(packageId), rate_id: rateId }),
    })
  }

  const paymentMethod = form.querySelector('wa-radio-group[name="payment_method"]')?.value
  const customerNote = form.querySelector('[name="customer_note"]')?.value || ''
  const data = {
    billing_address: billingAddress,
    shipping_address: shippingAddress,
    customer_note: customerNote,
    payment_method: paymentMethod,
    payment_data: [],
    expected_total: cartBefore.totals?.total_price,
  }

  if (submit) submit.setAttribute('disabled', '')
  if (status) status.textContent = 'Transmission sécurisée de votre commande…'
  try {
    const result = await storeApi('/checkout', { method: 'POST', body: JSON.stringify(data) })
    if (result.payment_result?.redirect_url) {
      window.location.assign(result.payment_result.redirect_url)
      return
    }
    updateCartCount({ items_count: 0 })
    const root = document.querySelector('#checkout-view')
    if (root) root.innerHTML = `<wa-card class="commerce-panel order-confirmation" appearance="outlined"><p class="eyebrow">Commande enregistrée</p><h2>Merci pour votre commande.</h2><p>Votre numéro de commande : <strong>${escapeHtml(result.order_number || result.order_id || '')}</strong></p><p>Vous recevrez les informations de suivi par e-mail.</p></wa-card>`
  } catch (error) {
    if (status) status.textContent = error.message
    if (submit) submit.removeAttribute('disabled')
  }
}

document.addEventListener('click', async (event) => {
  const addButton = event.target.closest('[data-add-to-cart], .ajax_add_to_cart[data-product_id]')
  if (!addButton) return
  event.preventDefault()
  const productId = Number(addButton.getAttribute('data-add-to-cart') || addButton.getAttribute('data-product_id'))
  const quantity = Number(addButton.closest('[data-product]')?.querySelector('[name="quantity"]')?.value || 1)
  addButton.setAttribute('disabled', '')
  showStatus('Ajout au panier…')
  try {
    const cart = await storeApi(`/cart/add-item?id=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(quantity)}`, {
      method: 'POST', body: JSON.stringify({ id: productId, quantity }),
    })
    updateCartCount(cart)
    showStatus('Le produit a été ajouté à votre panier.')
  } catch (error) {
    showStatus(error.message, true)
  } finally {
    addButton.removeAttribute('disabled')
  }
})

document.addEventListener('click', async (event) => {
  const removeButton = event.target.closest('[data-cart-remove]')
  if (!removeButton) return
  const row = removeButton.closest('[data-cart-key]')
  try {
    const cart = await storeApi(`/cart/remove-item?key=${encodeURIComponent(row.dataset.cartKey)}`, { method: 'POST' })
    renderCart(cart)
  } catch (error) { showStatus(error.message, true) }
})

document.addEventListener('change', async (event) => {
  const quantity = event.target.closest('[data-cart-quantity]')
  if (quantity) {
    const row = quantity.closest('[data-cart-key]')
    try {
      const cart = await storeApi(`/cart/update-item?key=${encodeURIComponent(row.dataset.cartKey)}&quantity=${encodeURIComponent(quantity.value)}`, { method: 'POST' })
      renderCart(cart)
    } catch (error) { showStatus(error.message, true) }
  }
  if (event.target.matches('#shipping-same')) {
    const fields = document.querySelector('#shipping-address-fields')
    if (fields) {
      fields.hidden = event.target.checked
      fields.querySelectorAll('wa-input, wa-select, wa-textarea, wa-checkbox').forEach((field) => {
        field.disabled = event.target.checked
      })
    }
  }
  if (event.target.closest('#checkout-form') && ['postcode', 'country', 'city'].some((key) => event.target.name?.includes(key))) {
    const form = document.querySelector('#checkout-form')
    if (form) await refreshShipping(form)
  }
  const shippingGroup = event.target.closest?.('wa-radio-group[name="shipping_rate"]')
  if (shippingGroup) {
    const [packageId, rateId] = String(shippingGroup.value || '').split('|')
    if (!packageId || !rateId) return
    try {
      const cart = await storeApi(`/cart/select-shipping-rate?package_id=${encodeURIComponent(packageId)}&rate_id=${encodeURIComponent(rateId)}`, {
        method: 'POST', body: JSON.stringify({ package_id: Number(packageId), rate_id: rateId }),
      })
      renderShippingRates(cart)
    } catch (error) {
      const status = document.querySelector('#checkout-status')
      if (status) status.textContent = error.message
    }
  }
})

document.addEventListener('submit', async (event) => {
  if (event.target.id !== 'checkout-form') return
  event.preventDefault()
  if (!event.target.reportValidity()) return
  try { await placeOrder(event.target) }
  catch (error) {
    const status = document.querySelector('#checkout-status')
    if (status) status.textContent = error.message
  }
})

if (document.querySelector('[data-commerce-page="cart"]')) loadCartPage()
else if (document.querySelector('[data-commerce-page="checkout"]')) loadCheckoutPage()
else loadHeaderCartCount()
