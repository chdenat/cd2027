/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/check-callouts.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-04
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

/** Focused regression assertions for the source-class-driven WordPress callout adapter. */
const assert = require('node:assert/strict')
const { convertClassedElementsToCallouts } = require('../src/_lib/wordpress-data.js')

const plainCallout = convertClassedElementsToCallouts('<div class="callout-note"><p>Conseil</p></div>')
assert.match(plainCallout, /<wa-callout[^>]*class="callout-note cd-callout"><p>Conseil<\/p><\/wa-callout>/)
assert.doesNotMatch(plainCallout, /<wa-icon\b/)

const compactCallout = convertClassedElementsToCallouts('<div class="callout-note"><p data-cd-block="paragraph"></p><div aria-hidden="true" data-cd-block="spacer" class="spacer-60"><\/div><h3>Texte du callout</h3></div>')
assert.doesNotMatch(compactCallout, /data-cd-block="spacer"/)
assert.doesNotMatch(compactCallout, /<p data-cd-block="paragraph"><\/p>/)
assert.match(compactCallout, /<h3>Texte du callout<\/h3>/)

const iconCallout = convertClassedElementsToCallouts('<section id="guide" class="callout-note callout-icon-arrow-right"><p>Suite</p></section>')
assert.match(iconCallout, /<wa-callout[^>]*id="guide"[^>]*class="callout-note callout-icon-arrow-right cd-callout">/)
assert.match(iconCallout, /<wa-icon slot="icon" library="pro" name="arrow-right" variant="solid" aria-hidden="true"><\/wa-icon>/)
assert.match(iconCallout, /<p>Suite<\/p><\/wa-callout>/)

const calendarCallout = convertClassedElementsToCallouts('<div class="callout-note callout-icon-calendar-circle-exclamation"><p>Rendez-vous</p></div>')
assert.match(calendarCallout, /class="callout-note callout-icon-calendar-circle-exclamation cd-callout"/)
assert.match(calendarCallout, /<wa-icon slot="icon" library="pro" name="calendar-circle-exclamation" variant="solid" aria-hidden="true"><\/wa-icon>/)

const styledCallout = convertClassedElementsToCallouts('<div data-cd-background-color="primary" data-cd-has-background="true" data-cd-text-color="base" class="callout-note cd-content-style-123"><p>Fond conservé</p></div>')
assert.match(styledCallout, /data-cd-background-color="primary"/)
assert.match(styledCallout, /data-cd-has-background="true"/)
assert.match(styledCallout, /data-cd-text-color="base"/)
assert.match(styledCallout, /class="callout-note cd-content-style-123 cd-callout"/)

const authoredLayoutCallout = convertClassedElementsToCallouts('<div data-cd-block="group" data-cd-role="source-role" data-cd-direction="vertical" data-cd-layout="flex" data-cd-justify="center" class="callout-note"><div data-cd-block="spacer" class="cd-content-style-space"></div><p>Espacement source</p></div>')
const authoredCalloutOpening = authoredLayoutCallout.slice(0, authoredLayoutCallout.indexOf('>'))
assert.match(authoredCalloutOpening, /data-cd-block="callout"/)
assert.match(authoredCalloutOpening, /data-cd-role="callout"/)
assert.doesNotMatch(authoredCalloutOpening, /source-role/)
assert.match(authoredCalloutOpening, /data-cd-direction="vertical"/)
assert.match(authoredCalloutOpening, /data-cd-layout="flex"/)
assert.match(authoredCalloutOpening, /data-cd-justify="center"/)

const nestedCallouts = convertClassedElementsToCallouts('<div class="callout-outer"><section class="callout-icon-calendar-circle-exclamation"><p>Dedans</p></section></div>')
assert.equal((nestedCallouts.match(/<wa-callout\b/g) || []).length, 2)
assert.equal((nestedCallouts.match(/<\/wa-callout>/g) || []).length, 2)
assert.match(nestedCallouts, /name="calendar-circle-exclamation"/)

const geometryOnlyGroup = '<div data-cd-block="group" data-cd-has-background="true" class="rounded"><p>Pas un callout</p></div>'
assert.equal(convertClassedElementsToCallouts(geometryOnlyGroup), geometryOnlyGroup)

const editorialQuote = '<blockquote class="wp-block-quote is-layout-flow wp-block-quote-is-layout-flow"><p>Je recueille ce qui a mûri.</p></blockquote>'
assert.equal(convertClassedElementsToCallouts(editorialQuote), editorialQuote)

const lookalikeClass = '<div class="not-callout-note calloutish"><p>Contenu</p></div>'
assert.equal(convertClassedElementsToCallouts(lookalikeClass), lookalikeClass)

const invalidIconClass = convertClassedElementsToCallouts('<div class="callout-icon-"><p>Sans icône</p></div>')
assert.match(invalidIconClass, /<wa-callout\b/)
assert.doesNotMatch(invalidIconClass, /<wa-icon\b/)

process.stdout.write('Callout class behavior passed.\n')
