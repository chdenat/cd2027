function initializeCarousel(gallery, index) {
  const swiper = gallery.querySelector('[data-cd-role="gallery-viewport"] .swiper-container')
  const track = gallery.querySelector('[data-cd-role="carousel-track"]')
  const slides = track ? [...track.children].filter((slide) => slide.matches('[data-cd-role="carousel-slide"]')) : []
  if (!swiper || !track || slides.length < 2) return

  const previous = swiper.querySelector('wa-button.nav-button__prev')
  const next = swiper.querySelector('wa-button.nav-button__next')
  const options = (() => {
    try {
      return JSON.parse(swiper.getAttribute('data-swiper') || '{}')
    } catch {
      return {}
    }
  })()
  const loop = options.loop === true
  const speed = Math.max(1500, Number(options.autoPlaySpeed) || 3000)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let active = 0
  let timer
  let paused = false

  swiper.setAttribute('role', 'region')
  swiper.setAttribute('aria-label', gallery.getAttribute('aria-label') || 'Galerie d’images')
  swiper.setAttribute('aria-roledescription', 'carrousel')
  swiper.tabIndex = 0
  track.id ||= `cd2026-gallery-${index + 1}`

  const render = () => {
    track.dataset.activeSlide = String(active)
    slides.forEach((slide, slideIndex) => {
      const current = slideIndex === active
      slide.setAttribute('aria-label', `Image ${slideIndex + 1} sur ${slides.length}`)
      slide.setAttribute('aria-roledescription', 'diapositive')
      slide.setAttribute('aria-hidden', String(!current))
      slide.inert = !current
    })
    if (previous) previous.disabled = !loop && active === 0
    if (next) next.disabled = !loop && active === slides.length - 1
  }

  const clearTimer = () => {
    window.clearTimeout(timer)
    timer = undefined
  }

  const scheduleNext = () => {
    clearTimer()
    if (!options.autoPlay || reducedMotion || paused) return
    timer = window.setTimeout(() => {
      if (!loop && active === slides.length - 1) return
      active = loop ? (active + 1) % slides.length : active + 1
      render()
      scheduleNext()
    }, speed)
  }

  const goTo = (index) => {
    if (loop) active = (index + slides.length) % slides.length
    else active = Math.max(0, Math.min(slides.length - 1, index))
    render()
    scheduleNext()
  }

  previous?.addEventListener('click', () => goTo(active - 1))
  next?.addEventListener('click', () => goTo(active + 1))
  swiper.addEventListener('keydown', (event) => {
    if (event.target.closest('wa-button')) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goTo(active - 1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      goTo(active + 1)
    }
  })

  swiper.addEventListener('mouseenter', () => { paused = true; clearTimer() })
  swiper.addEventListener('mouseleave', () => { paused = false; scheduleNext() })
  swiper.addEventListener('focusin', () => { paused = true; clearTimer() })
  swiper.addEventListener('focusout', (event) => {
    if (!swiper.contains(event.relatedTarget)) {
      paused = false
      scheduleNext()
    }
  })
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden
    if (paused) clearTimer()
    else scheduleNext()
  })

  render()
  scheduleNext()
}

document.querySelectorAll('[data-cd-block="coblocks-gallery-carousel"]').forEach(initializeCarousel)
