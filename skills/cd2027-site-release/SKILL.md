---
name: cd2027-site-release
description: Prepare and validate an Eleventy build and its WordPress-driven deployment or rollback.
---

# CD2027 site release

Use this skill when preparing a deployment, enabling the WordPress publishing pipeline, or investigating a failed release.

## Release workflow

1. Inspect `git status --short` and preserve unrelated user changes.
2. Refresh the WordPress route inventory and confirm the release covers all pages, posts, products, archives, legal routes, and approved live-backend routes.
3. Confirm the WordPress data source revision, dependency lockfile, build command, environment configuration, and hosting target.
4. Build into an isolated artifact and run the configured route, link, metadata, and asset checks.
5. Inspect representative pages from every changed family at desktop and mobile sizes.
6. Promote the build atomically only after validation succeeds; retain a known-good release for rollback.
7. Confirm the deployment target, published URL, build ID, and last synchronized WordPress revision.
8. Report failures, stale jobs, warnings, and any route still served by WordPress.

## Safety

- Never deploy a build that silently drops source routes or replaces a working dynamic flow with static markup.
- Do not expose WordPress credentials, webhook secrets, queue state, deployment metadata, or private preview content in public output.
- Do not commit, push, tag, or deploy unless the user has requested that specific action.
- An accepted WordPress webhook is not proof of a successful build or deployment. Report each stage separately.
- If the latest build fails, keep the last successful frontend live and replay the job after correcting the cause.
