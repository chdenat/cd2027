---
name: cd2027-documentation-authoring
description: Create and maintain clear CD2027 project and operational documentation for the WordPress-managed Eleventy site.
---
<!--
 * This file is part of the CD2027 project.
 *
 * File: skills/cd2027-documentation-authoring/SKILL.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

# CD2027 documentation authoring

Use this skill for project rules, architecture notes, migration guidance, operational procedures, and user documentation.

## Workflow

1. Read `PROJECT_RULES.md`, the current architecture study, and the relevant source before describing behavior.
2. Keep technical project and operational documentation in professional English unless the user asks for another language.
3. Write public website content in French unless the owner requests another locale.
4. Separate current implemented behavior from proposals, assumptions, and unresolved decisions.
5. Link to the exact source or route inventory that supports route counts, API behavior, or deployment claims.
6. Keep WordPress-to-Eleventy rendering decisions in `docs/design-rules-catalog.md`; keep `PROJECT_RULES.md` for project-wide invariants and have skills link to the catalog instead of duplicating its decisions.
7. Update the documentation when the implementation changes. Do not describe a future webhook, build, preview, or rollback as if it is already operational.

## Structure

- Keep each document focused on one audience and task.
- Use a route table or a short sequence when it makes operations easier to follow.
- Avoid duplicating project rules across several files; link to the canonical rule instead.
- Never edit generated documentation or pages in `_site/` directly.
