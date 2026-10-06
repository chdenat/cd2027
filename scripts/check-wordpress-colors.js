/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/check-wordpress-colors.js
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
const {
  normalizeRenderedHtml,
  transformGutenbergBlockColors,
  extractWordPressBlockLayoutStyles,
} = require('../src/_lib/wordpress-data.js')

const contentContext = {
  contentStyleRules: new Map(),
  wordpressColorPalette: new Map([
    ['primary', '#ecc8c8'],
    ['secondary', '#ddb5b7'],
    ['accent', '#cc3366'],
  ]),
}
const html = normalizeRenderedHtml(
  '<div class="wp-block-group has-primary-color has-secondary-background-color has-background has-link-color wp-elements-1"><a href="/read/">Lire</a><span style="color:var(--wp--preset--color--accent)">Accent</span></div>',
  { kind: 'page', id: 42, slug: 'color-check' },
  contentContext,
  { elementLinkColors: new Map([['wp-elements-1', '#123456']]) },
)
const rules = [...contentContext.contentStyleRules.values()]
const stylesheet = rules.map(({ selector, declarations }) => `${selector}{${declarations}}`).join('\n')

assert.doesNotMatch(html, /\sstyle=/i, 'WordPress inline styles should be externalized')
assert.doesNotMatch(html, /wp-elements-1|wp-block-group/i, 'WordPress implementation classes should be normalized')
assert.match(html, /data-cd-text-color="primary"/)
assert.match(html, /data-cd-background-color="secondary"/)
assert.match(stylesheet, /color:var\(--cd2027--wordpress-color-primary\) !important/)
assert.match(stylesheet, /background-color:var\(--cd2027--wordpress-color-secondary\) !important/)
assert.match(stylesheet, /\.cd-content-style-[\da-f]+\[class\] :where\(a:not\(\.wp-element-button\)\)\{color:#123456 !important\}/)
assert.match(stylesheet, /color:var\(--cd2027--wordpress-color-accent\)/)

const legacyStyleContext = { contentStyleRules: new Map(), wordpressColorPalette: new Map() }
const legacyStyleHtml = normalizeRenderedHtml(
  '<p style="color:var(--couleur-texte);font-family:var(--texte-principal);padding-left:var(--wp--custom--gap--horizontal)">Texte personnalisé</p>',
  { kind: 'page', id: 44 },
  legacyStyleContext,
)
const legacyStyleRules = [...legacyStyleContext.contentStyleRules.values()]
  .map(({ selector, declarations }) => `${selector}{${declarations}}`)
  .join('\n')

assert.doesNotMatch(legacyStyleHtml, /\sstyle=/i)
assert.match(legacyStyleRules, /color:var\(--cd2027--color-text\)/)
assert.match(legacyStyleRules, /font-family:var\(--cd2027--font-body\)/)
assert.match(legacyStyleRules, /padding-left:var\(--cd2027--page-padding-inline\)/)

const defaultColorContext = { contentStyleRules: new Map(), wordpressColorPalette: new Map() }
const defaultColorHtml = normalizeRenderedHtml(
  '<h2 class="has-text-color">Bienvenue</h2><p class="has-text-color has-base-color">White preset</p><p class="has-text-color" style="color:#123456">Custom color</p><mark class="has-inline-color has-text-color">Default mark</mark>',
  { kind: 'page', id: 45 },
  defaultColorContext,
)
const defaultColorRules = [...defaultColorContext.contentStyleRules.values()]
  .map(({ selector, declarations }) => `${selector}{${declarations}}`)
  .join('\n')
assert.match(defaultColorHtml, /<h2[^>]*data-cd-text-color="text"/)
assert.match(defaultColorHtml, /<p[^>]*data-cd-text-color="base"/)
assert.match(defaultColorRules, /color:var\(--cd2027--color-text\) !important/)
assert.match(defaultColorRules, /color:var\(--cd2027--editorial-color-123456\)/)
assert.match(defaultColorRules, /mark\.[^{}]+\{color:var\(--cd2027--color-text\) !important\}/)

const blockLayoutStyles = extractWordPressBlockLayoutStyles(`
  <style>
    .wp-container-core-buttons-is-layout-center{justify-content:center;position:fixed}
    .wp-container-core-group-is-layout-right{flex-direction:column;align-items:flex-end;gap:var(--wp--preset--spacing--40)}
    .wp-container-core-group-is-layout-injected{justify-content:url(https://evil.example/x);gap:expression(alert(1))}
    body{display:none}
    .wp-container-core-group-is-layout-child > *{margin-top:0}
    @media (max-width: 400px) { .wp-container-core-group-is-layout-mobile{justify-content:flex-end} }
    /* A comment with an unmatched brace { must not swallow following rules. */
    .wp-container-core-group-is-layout-repeated{justify-content:center;/* harmless } brace */content:"{quoted brace}"}
    .wp-container-core-group-is-layout-repeated{gap:1rem}
  </style>
`)
assert.equal(blockLayoutStyles.get('wp-container-core-buttons-is-layout-center'), 'justify-content:center')
assert.equal(blockLayoutStyles.has('wp-container-core-group-is-layout-injected'), false)
assert.equal(blockLayoutStyles.has('wp-container-core-group-is-layout-child'), false)
assert.equal(blockLayoutStyles.has('wp-container-core-group-is-layout-mobile'), false)
assert.equal(blockLayoutStyles.get('wp-container-core-group-is-layout-repeated'), 'justify-content:center;gap:1rem')
const layoutContext = { contentStyleRules: new Map(), wordpressColorPalette: new Map() }
const layoutHtml = normalizeRenderedHtml(
  '<div class="wp-block-group is-vertical is-layout-flex wp-container-core-group-is-layout-right" style="gap:2rem"><div class="wp-block-buttons is-layout-flex wp-container-core-buttons-is-layout-center"><div class="wp-block-button"><a class="wp-block-button__link" href="/read/">Read</a></div></div></div>',
  { kind: 'page', id: 46 },
  layoutContext,
  { blockLayoutStyles },
)
const layoutRules = [...layoutContext.contentStyleRules.values()].map(({ declarations }) => declarations).join('\n')
assert.doesNotMatch(layoutHtml, /wp-container-|\sstyle=/i)
assert.match(layoutHtml, /<wa-button[^>]*href="\/read\/"/)
assert.match(layoutRules, /justify-content:center/)
assert.match(layoutRules, /flex-direction:column;align-items:flex-end;gap:var\(--cd2027--space-40\)/)
assert.match(layoutRules, /gap:var\(--cd2027--space-40\);gap:2rem/)
assert.doesNotMatch(layoutRules, /position:|url\(|expression\(/)

const unstackedHtml = normalizeRenderedHtml('<div class="wp-block-columns is-not-stacked-on-mobile"><div class="wp-block-column">Icon row</div></div>')
assert.match(unstackedHtml, /data-cd-mobile-stack="false"/)

const serializedMarkup = transformGutenbergBlockColors({
  block: {
    attrs: {
      style: {
        color: { text: 'var:preset|color|primary' },
        elements: { link: { color: { text: 'var:preset|color|accent' } } },
      },
    },
  },
  innerHTML: '<p><a href="/read/">Lien Gutenberg</a></p>',
})
const serializedContext = {
  contentStyleRules: new Map(),
  wordpressColorPalette: new Map([
    ['primary', '#ecc8c8'],
    ['accent', '#cc3366'],
  ]),
}
const serializedHtml = normalizeRenderedHtml(serializedMarkup, { kind: 'page', id: 43 }, serializedContext)
const serializedStyles = [...serializedContext.contentStyleRules.values()]
  .map(({ selector, declarations }) => `${selector}{${declarations}}`)
  .join('\n')

assert.doesNotMatch(serializedHtml, /\sstyle=|data-cd-(?:text|link)-color=/i)
assert.match(serializedHtml, /class="cd-content-style-[\da-f]+"/)
assert.match(serializedStyles, /color:var\(--cd2027--wordpress-color-primary\)/)
assert.match(serializedStyles, /color:var\(--cd2027--wordpress-color-accent\)/)

process.stdout.write('WordPress font, color, and block-layout normalization passed.\n')
