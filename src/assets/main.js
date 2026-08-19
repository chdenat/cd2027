import '@awesome.me/webawesome/dist/styles/webawesome.css'
import './styles.css'
import { setIconPath } from '@awesome.me/webawesome/dist/webawesome.js'

setIconPath('/assets/fontawesome/svgs')

await Promise.all([
  import('@awesome.me/webawesome/dist/components/page/page.js'),
  import('@awesome.me/webawesome/dist/components/button/button.js'),
  import('@awesome.me/webawesome/dist/components/card/card.js'),
  import('@awesome.me/webawesome/dist/components/badge/badge.js'),
  import('@awesome.me/webawesome/dist/components/divider/divider.js'),
  import('@awesome.me/webawesome/dist/components/icon/icon.js'),
])
