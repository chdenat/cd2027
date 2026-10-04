import './fontawesome-library.js'

await Promise.all([
  import('/assets/webawesome/components/page/page.js'),
  import('/assets/webawesome/components/button/button.js'),
  import('/assets/webawesome/components/card/card.js'),
  import('/assets/webawesome/components/callout/callout.js'),
  import('/assets/webawesome/components/badge/badge.js'),
  import('/assets/webawesome/components/divider/divider.js'),
  import('/assets/webawesome/components/icon/icon.js'),
  import('/assets/webawesome/components/spinner/spinner.js'),
  import('/assets/webawesome/components/input/input.js'),
  import('/assets/webawesome/components/number-input/number-input.js'),
  import('/assets/webawesome/components/select/select.js'),
  import('/assets/webawesome/components/option/option.js'),
  import('/assets/webawesome/components/textarea/textarea.js'),
  import('/assets/webawesome/components/checkbox/checkbox.js'),
  import('/assets/webawesome/components/radio/radio.js'),
  import('/assets/webawesome/components/radio-group/radio-group.js'),
  import('/assets/webawesome/components/dropdown/dropdown.js'),
  import('/assets/webawesome/components/dropdown-item/dropdown-item.js'),
  import('/assets/webawesome/components/popover/popover.js'),
  import('/assets/webawesome/components/tooltip/tooltip.js'),
  import('/assets/webawesome/components/button-group/button-group.js'),
  import('/assets/webawesome/components/breadcrumb/breadcrumb.js'),
  import('/assets/webawesome/components/breadcrumb-item/breadcrumb-item.js'),
])

document.addEventListener('wa-select', (event) => {
  const href = event.detail?.item?.dataset?.href
  if (href) window.location.assign(href)
})

import('./theme.js')
import('./editorial.js')
import('./product-gallery.js')
import('./commerce.js')
import('./forms.js')
