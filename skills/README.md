# CD2026 project skills

These skills adapt the applicable LGS1920 site workflows to this repository and add guidance for the WordPress-to-Eleventy publishing path. Read the matching `SKILL.md` together with the root `PROJECT_RULES.md`.

| Skill | Use it for | LGS1920 source or adaptation |
| --- | --- | --- |
| `cd2026-site-content-maintenance` | WordPress-managed page, article, product, media, and route content | Adapted from `lgs-1920-site-content-maintenance` |
| `cd2026-content-review` | Editorial, metadata, route, and consistency review across the whole site | Adapted from `lgs-1920-site-content-review` |
| `cd2026-documentation-authoring` | Project, operational, and user-facing documentation | Adapted from `lgs-1920-site-documentation-authoring` |
| `cd2026-eleventy-maintenance` | Eleventy data, templates, assets, build, and generated output | Adapted from `lgs-1920-site-eleventy-maintenance` |
| `cd2026-wordpress-sync` | Webhook ingestion, WordPress API synchronization, build jobs, retries, and reconciliation | New skill for this project |
| `cd2026-site-qa` | Whole-site route, visual, SEO, accessibility, and functional QA | Adapted from `lgs-1920-site-qa` |
| `cd2026-site-release` | Build promotion, deployment readiness, rollback, and handoff | Adapted from `lgs-1920-site-release` |

The LGS1920 multilingual workflow is not copied because the current public site inventory is French-only. Add a locale-specific skill if a second public locale becomes part of the approved scope. The contact-mail skill is deferred because the current site uses WordPress form and newsletter integrations and this repository has no replacement mail backend. Component package publication and LGS1920 cross-repository issue rules do not apply here.
