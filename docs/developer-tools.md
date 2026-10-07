<!--
 * This file is part of the CD2027 project.
 *
 * File: docs/developer-tools.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-07
 *
 * Copyright © 2026 Christian Denat
-->

# Developer tools and automation

This page documents the repository's local commands, build checks, deployment entry points, and WordPress publishing automation. Run commands from the repository root. Install the locked dependencies with `bun install` first; a build also needs network access to the configured WordPress REST API and WooCommerce Store API. The deployment workflow additionally needs the GitHub environment and SSH configuration described below.

## Bun commands

| Command | Purpose and output | Requirements and side effects |
| --- | --- | --- |
| `bun run dev` | Starts the local Eleventy site at `http://localhost:4555`. | Stops only an existing CD2027 dev server, builds the local Font Awesome bundle, then starts the server. Uses `PORT` when set. The server reads generated `_site/` files and proxies the documented form and WooCommerce requests to WordPress. |
| `bun run build` | Builds all Eleventy routes into `_site/`. | Builds Font Awesome icons, removes and recreates `_site/`, then fetches WordPress data. Do not use while another process is writing this output. |
| `bun run check` | Runs callout conversion, reusable package, and file-header tests, then a clean full build and generated-route/link checks. | Requires WordPress network access or `CD2027_ALLOW_PUBLIC_CACHE=1` with an existing snapshot. Leaves the checked build in `_site/` and a private WordPress route manifest in `.data/`. |
| `bun run test:callouts` | Runs focused assertions for callout conversion in the WordPress adapter. | No network access. Does not build the site. |
| `bun run test:wordpress-package` | Runs deterministic package API checks for REST pagination/auth fallback, Gutenberg policies, normalized relations, custom fields, route generation, and collision detection. | Uses Node's built-in test runner and mock responses; no WordPress credentials or network access. |
| `bun run test:file-headers` | Checks the header updater's syntax wrappers, date fields, and front matter handling. | No network access; does not modify repository files. |
| `bun run headers:update` | Updates and stages headers for supported files already staged for commit. | Requires Git and Bun. Refuses to continue when a staged file has unstaged edits. |
| `bun run headers:update:all` | Adds or refreshes headers in supported first-party files currently present in the working tree. | Does not stage changes. Uses the package-neutral header for the reusable WordPress package and its architecture note. Skips strict JSON, generated output, caches, dependencies, IDE-local files, and binary assets. |
| `bun run headers:check` | Verifies headers across supported first-party files currently present in the working tree. | No network access; exits non-zero when a header is missing or outdated. |
| `bun run git:hooks:install` | Sets this repository's local Git hooks path to `.githooks`. | Run once per clone; requires Git and Bun when committing. The pre-commit hook refreshes staged source headers. |
| `bun run build:icons` | Bundles the explicitly registered Font Awesome icons for browser use. | Requires Bun and installed Font Awesome packages; writes `.build/fontawesome-icons.js`. |

Relevant build-time environment variables:

| Variable | Default or accepted values | Effect |
| --- | --- | --- |
| `SITE_URL` | `https://christinedeloupy.fr` | Canonical public origin used for generated metadata and route checks. The staging workflow sets its staging origin. |
| `WORDPRESS_ORIGIN` | `https://christinedeloupy.fr` | WordPress origin used by the server-side data adapter. |
| `WORDPRESS_CONTENT_MODE` | `auto`, `rendered`, or `blocks`; defaults to `auto` | Shared content-mode default for page and post records. `blocks` requires Application Password credentials and complete block coverage. |
| `WORDPRESS_PAGE_CONTENT_MODE`, `WORDPRESS_POST_CONTENT_MODE` | Same three modes; unset values inherit `WORDPRESS_CONTENT_MODE` | Optional per-family overrides for page and post conversion. |
| `WORDPRESS_API_USERNAME`, `WORDPRESS_API_APPLICATION_PASSWORD` | Unset locally | Optional server-side credentials for WordPress edit-context REST requests. Never put them in browser variables or generated output. |
| `CD2027_WP_AUTH` | Unset/disabled unless `1` | Includes the staging access gate assets and versioning behavior in the build. |
| `PRIVATE_VIEW` | `true` when the gate is enabled | Controls whether the staging gate shows the private-site login screen. |
| `PORT` | `4555` | Local development server port. |
| `CD2027_ALLOW_PUBLIC_CACHE` | Set internally by the local dev server | Allows watch builds to reuse the last successful public WordPress snapshot after a fetch failure. Do not set it for a deployment build. |

## Repository scripts

| Entry point | Purpose, invocation, and effects |
| --- | --- |
| `bun scripts/stop-dev-server.js` | Used by `bun run dev` to stop the project server on `127.0.0.1:$PORT`. On Linux it matches the process working directory and script path; elsewhere it verifies the server's health response and requests its shutdown endpoint. It refuses to signal an unrelated service. |
| `bun scripts/dev-server.js` | Starts the local HTTP server on `127.0.0.1:$PORT`, serves `_site/`, serves the development fallback page while output is unavailable, and exposes bounded same-origin adapters for allowed Forminator/MailPoet forms and WooCommerce Store API routes. Requires a prior build and network access for live API/form requests. |
| `bun scripts/clean-output.js` | Removes and recreates only the repository's `_site/` generated-output directory. Called by `bun run build`; may also be run directly from the repository root. |
| `bun scripts/build-fontawesome-icons.js` | Runs the Bun bundler for `scripts/fontawesome-icons.entry.js`; reports build diagnostics and exits non-zero on failure. Writes `.build/fontawesome-icons.js`. |
| `bun scripts/update-file-headers.mjs --staged --stage` | Updates and stages the canonical CD2027 headers for staged first-party files with supported comment syntax. The pre-commit hook invokes this command. | Requires Git and Bun. It aborts before writing if any selected file also has unstaged changes. |
| `bun scripts/update-file-headers.mjs --all` | Adds or refreshes headers for tracked and non-ignored untracked first-party text files in the current working tree. | Does not stage changes; strict JSON, generated output, caches, dependencies, IDE-local files, and binary files are excluded. |
| `bun scripts/check-callouts.js` | Asserts the WordPress callout conversion contract by invoking the adapter. Exits non-zero on a failed assertion. |
| `bun scripts/check-routes.js` | Checks that sitemap and selected WordPress source routes exist in `_site/`, that excluded routes did not remain as stale output, and that internal links and generated HTML satisfy key site contracts. Requires a successful build and `.data/wordpress-public-cache.json`; `SITE_URL` and `CD2027_WP_AUTH` affect origin and staging-gate route checks. |
| `scripts/version-cd2027-gate.js` | A CommonJS build hook, not a standalone CLI. Eleventy calls it after an authenticated staging build. It renames the gate file with a build identifier and replaces the gate placeholders in `_site/.htaccess`; `GITHUB_SHA` or `CD2027_BUILD_ID` selects the identifier, falling back to `local`. |
| `scripts/deploy-cd2027.sh` | Requests a GitHub Actions deployment of the latest `main` commit: `bash scripts/deploy-cd2027.sh`. Requires `gh`, an authenticated GitHub CLI session, and repository workflow permission. It does not upload local or uncommitted files; it prints the Actions workflow URL. |
| `scripts/upload-cd2027.sh` | Uploads a checked `_site/` archive and promotes it on the remote host. Intended to run from the deployment workflow after `bun run check`, not as a substitute for building or validating. Requires `sshpass`, OpenSSH client tools, `_site/index.html`, `_site/sitemap.xml`, and the environment variables below. Creates a release directory and switches the remote `current` symlink only after extraction succeeds. |

The root `index.js` is the `main` placeholder declared by the private root package manifest. Running `bun index.js` only prints a starter message; the site build and runtime use the commands and entry points documented above.

`upload-cd2027.sh` requires `CD2027_SSH_HOST`, `CD2027_SSH_USER`, `CD2027_SSH_PASSWORD`, and `CD2027_REMOTE_ROOT`. `CD2027_SSH_PORT` is optional and defaults to `22`. The staging workflow reads these values only from its `cd2027` GitHub environment; the production workflow reads same-named values only from `cd2027-production`. There are no repository-level `STAGING_*` credential fallbacks. The password is consumed by `sshpass` and removed from the script environment before the archive transfer. The script accepts a new SSH host key on first connection into a runner-temporary known-hosts file, then checks it for the remainder of that invocation.

## GitHub deployment workflow

`.github/workflows/deploy-cd2027.yml` builds and deploys `https://cd2027.christinedeloupy.fr` from `main`. It starts on every push to `main`, a manual `workflow_dispatch`, the authenticated WordPress `repository_dispatch` event `cd2027_deploy`, or the daily cron `17 6 * * *` (06:17 UTC). The job installs the locked Bun dependencies, runs `bun run check`, then invokes `scripts/upload-cd2027.sh`. It requires the `cd2027` GitHub environment, Font Awesome Pro access, the WordPress API credentials when edit-context content is configured, and the SSH values listed above. Deployments are serialized and are not cancelled once started. A failed build or transfer leaves the previous remote `current` release active.

`.github/workflows/deploy-cd2027-production.yml` builds the production origin from `main` on manual `workflow_dispatch` or the explicit `cd2027_production_deploy` repository-dispatch event. It uses only the separate `cd2027-production` GitHub environment and the same-named secrets and variables stored there. It requires `SITE_URL=https://christinedeloupy.fr`, an HTTPS `WORDPRESS_ORIGIN`, a dedicated production `CD2027_REMOTE_ROOT`, and `CD2027_PRODUCTION_READY=true`; otherwise it exits before checkout and transfer. Configure required reviewers on the production environment. Routine WordPress edits and the daily reconciliation workflow trigger staging only.

## WordPress data and reusable package

- `src/_lib/wordpress-data.js` is the Eleventy server-side adapter. It fetches canonical WordPress records and sitemaps, selects routes from sitemap membership and public internal references, normalizes records and HTML, then exposes the route manifest used by `check-routes.js`. Credentials remain in the build process.
- `wp-awesome` is maintained in the standalone [`chdenat/wp-awesome`](https://github.com/chdenat/wp-awesome) repository. Run `bun add chdenat/wp-awesome` to update the dependency; Bun records the resolved commit in `bun.lock`. Verify a clean locked install with `bun install --frozen-lockfile`, then run `bun run test:wordpress-package` to check the public exports and site adapter without fetching WordPress content.
- The standalone package owns REST pagination/authentication, normalization, Gutenberg parsing, route helpers and optional WooCommerce/Yoast/forms subpaths. The PHP plugin is installed from `node_modules/wp-awesome/wordpress-plugin/wp-awesome.php`; it has its own durable SQL outbox and dispatches through WordPress cron. Keep only one publisher active for a given workflow.
- The site header updater retains a package-neutral header for `docs/reusable-wordpress-eleventy-content-pipeline.md`; the standalone repository owns its own headers and skills.

For deployment setup, environment names, and WordPress installation steps, see [CD2027 deployment](cd2027-deployment.md), [WordPress publishing and runtime](wordpress-publishing-and-runtime.md), [WP Awesome and staging/production configuration](wordpress-connector-and-environments.md), and the [current site inventory](current-site-inventory.md).
