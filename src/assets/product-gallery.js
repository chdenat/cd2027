/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: src/assets/product-gallery.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-03
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

// Enable cursor zoom only for mouse-capable devices; touch users keep the source image unchanged.
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
