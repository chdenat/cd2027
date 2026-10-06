---
name: cd2027-content-review
description: Review the clarity, consistency, metadata, route coverage, and freshness of all CD2027 site content.
---
<!--
 * This file is part of the CD2027 project.
 *
 * File: skills/cd2027-content-review/SKILL.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

# CD2027 content review

Use this skill for editorial audits, route inventory review, copy consistency, metadata checks, and content freshness. The review scope is the whole site, not only its homepage.

Keep this skill review-only unless the user also asks for corrections.

## Review workflow

1. Read the current route inventory and refresh it if the live WordPress record set has changed.
2. Group the review by page family: presentation and services, campaigns and lead capture, articles and archives, products and shop, forms and newsletter, account and payment, courses, and legal content.
3. Check title, description, canonical URL, heading order, internal and external links, dates, taxonomy, image alt text, and media attribution where applicable.
4. Check that the page's copy and behavior still match the current WordPress source and the offer or service it describes.
5. Identify orphaned pages, duplicate or conflicting routes, missing redirects, and inconsistencies between REST records and sitemaps.
6. Separate editorial issues from renderer, integration, SEO, and visual defects. Report evidence with the route and source record.

## Rules

- Preserve the author's meaning and tone. Do not rewrite marketing or legal copy without authorization.
- Review French copy in idiomatic French. Do not invent translations; the current public site is French-only.
- Flag legal or payment copy for owner review when its meaning would change.
- Treat route omissions and broken forms or commerce actions as functional issues, not cosmetic copy edits.
- Do not modify generated `_site/` files to conceal a defect.
