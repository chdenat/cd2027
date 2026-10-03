if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.product-gallery figure').forEach((figure) => {
    const image = figure.querySelector('img')
    if (!image) return

    figure.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return
      figure.classList.add('is-zoomed')
    })

    figure.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return
      const bounds = figure.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width) * 100
      const y = ((event.clientY - bounds.top) / bounds.height) * 100
      image.style.setProperty('--cd2027--product-zoom-x', `${x}%`)
      image.style.setProperty('--cd2027--product-zoom-y', `${y}%`)
    })

    figure.addEventListener('pointerleave', () => {
      figure.classList.remove('is-zoomed')
      image.style.removeProperty('--cd2027--product-zoom-x')
      image.style.removeProperty('--cd2027--product-zoom-y')
    })
  })
}
