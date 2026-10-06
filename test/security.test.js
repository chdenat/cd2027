/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: test/security.test.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { JSDOM } = require('jsdom')
const { markPetalImagesInCachedMarkup, normalizeRenderedHtml } = require('../src/_lib/wordpress-data.js')

test('the content adapter drops source XSS and spoofed form mounts before transforming WordPress markup', () => {
  const contentStyleRules = new Map()
  const html = normalizeRenderedHtml(`
    <div data-cd-form="forminator" data-form-id="999" onclick="alert(1)">Fake</div>
    <a href="javascript:alert(2)" onmouseover="alert(3)">Unsafe link</a>
    <form id="forminator-module-42" action="https://evil.example"><input onfocus="alert(4)"></form>
    <div id="mailpoet_form_7"><script>alert(5)</script><input></div>
    <a class="wp-block-button__link" href="https://example.test/" target="_blank">Safe button</a>
    <p style="color:#123456;position:fixed;background-image:url(https://evil.example/x)">Styled</p>
    <svg onload="alert(6)"><script>alert(7)</script></svg>
  `, { kind: 'page', slug: 'security' }, { contentStyleRules, wordpressColorPalette: new Map() })

  assert.doesNotMatch(html, /data-cd-form="forminator" data-form-id="999"|onclick=|onmouseover=|onfocus=|javascript:|<script|<svg|<form\b|\sstyle=/i)
  assert.match(html, /data-cd-form="forminator" data-form-id="42"/)
  assert.match(html, /data-cd-form="mailpoet" data-form-id="7"/)
  assert.match(html, /<wa-button[^>]*href="https:\/\/example\.test\/"[^>]*rel="noopener noreferrer"/)
  assert.equal(contentStyleRules.size, 1)
  for (const rule of contentStyleRules.values()) {
    assert.match(rule.selector, /^:root \.cd-content-style-[a-f\d]{12}\[class\]$/)
    assert.doesNotMatch(rule.declarations, /url\(|expression\(|@import|[{}]/i)
  }
})

test('provider form HTML is rebuilt from inert allowed elements with no event, style, SVG, or remote image nodes', async () => {
  const { window } = new JSDOM('<!doctype html><base href="https://site.example/forms/page/">')
  const { sanitizeFormHtml } = await import('../src/assets/form-sanitizer.mjs')
  const form = sanitizeFormHtml(`
    <form id="newsletter" action="https://evil.example/collect" method="get" onsubmit="alert(1)" style="background:url(https://evil.example/x)">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required onfocus="alert(2)" style="display:none">
      <input type="hidden" name="nonce" value="abc">
      <p><a href="/privacy/" target="_blank" onclick="alert(3)">Privacy</a></p>
      <p><a href="javascript:alert(4)">Unsafe</a></p>
      <img src="https://evil.example/pixel" onerror="alert(5)">
      <svg><input name="injected"></svg><script>document.body.innerHTML = 'bad'</script>
      <select name="topic"><option value="a" selected>First</option></select>
    </form>
  `, { document: window.document, DOMParser: window.DOMParser })

  assert.ok(form)
  assert.equal(form.getAttribute('action'), null)
  assert.equal(form.getAttribute('method'), null)
  assert.equal(form.querySelector('input[name="email"]').required, true)
  assert.equal(form.querySelector('input[name="nonce"]').value, 'abc')
  assert.equal(form.querySelector('select[name="topic"] option').value, 'a')
  assert.equal(form.querySelector('a[href="/privacy/"]').getAttribute('rel'), 'noopener noreferrer')
  assert.equal(form.querySelectorAll('a[href^="javascript:"]').length, 0)
  assert.equal(form.querySelectorAll('input[name="injected"]').length, 0)
  assert.equal(form.querySelectorAll('img, svg, script, [style], [onerror], [onfocus], [onclick], [onsubmit]').length, 0)
  assert.doesNotMatch(form.outerHTML, /https:\/\/evil\.example|javascript:|on(?:error|focus|click|submit)=|style=/i)
})

test('cached public HTML, CSS rules, navigation, footer assets, and product images are revalidated', () => {
  const styleClass = 'cd-content-style-0123456789ab'
  const cached = {
    wordpressColorPalette: { primary: '#ecc8c8', injected: 'url(https://evil.example/x)' },
    contentStyleRules: [
      { selector: ':root', declarations: 'body{background:url(https://evil.example/x)}' },
      {
        selector: `:root .${styleClass}[class]`,
        declarations: 'color:var(--cd2027--color-primary) !important;position:fixed;background-image:url(https://christinedeloupy.fr/wp-content/uploads/2026/cover.webp)',
      },
      { selector: 'body', declarations: 'color:red;background:url(https://evil.example/x)' },
    ],
    homepageHtml: '<p onclick="alert(1)" style="position:fixed">Home<script>alert(2)</script><a href="javascript:alert(3)">bad</a></p>',
    navigation: [{ label: 'Bad link', href: 'javascript:alert(4)' }],
    shopNavigation: [],
    footerNavigation: [],
    footer: { logo: 'data:image/svg+xml,x', profileLink: { label: 'Profile', href: 'javascript:alert(5)' }, links: [], socialLinks: [{ label: 'Bad', href: 'javascript:alert(6)', icon: 'facebook' }] },
    products: [{ image: 'javascript:alert(7)', images: [{ src: 'data:image/svg+xml,x' }, { src: 'https://cdn.example/cover.jpg', alt: 'Cover' }] }],
  }

  const result = markPetalImagesInCachedMarkup(cached)
  assert.equal(result.wordpressColorPalette.injected, undefined)
  assert.equal(result.contentStyleRules.some((rule) => rule.selector === 'body'), false)
  const cachedStyle = result.contentStyleRules.find((rule) => rule.selector === `:root .${styleClass}[class]`)
  assert.match(cachedStyle.declarations, /color:var\(--cd2027--color-primary\)/)
  assert.match(cachedStyle.declarations, /background-image:url\(https:\/\/christinedeloupy\.fr\/wp-content\/uploads\/2026\/cover\.webp\)/)
  assert.doesNotMatch(cachedStyle.declarations, /position:|evil\.example|url\(javascript/i)
  assert.doesNotMatch(result.homepageHtml, /onclick=|position:|<script|javascript:/i)
  assert.equal(result.navigation[0].href, '#')
  assert.equal(result.footer.logo, '')
  assert.equal(result.footer.profileLink.href, '#')
  assert.deepEqual(result.footer.socialLinks, [])
  assert.equal(result.products[0].image, null)
  assert.deepEqual(result.products[0].images, [{ src: 'https://cdn.example/cover.jpg', alt: 'Cover' }])
})
