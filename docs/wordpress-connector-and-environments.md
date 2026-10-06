<!--
 * This file is part of the CD2027 project.
 *
 * File: docs/wordpress-connector-and-environments.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-06
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

# WP Awesome and separate deployment environments

The WP Awesome guide in the standalone checkout (`../wp-awesome/docs-site/src/wp-awesome.md`) documents the reusable plugin. This file records the CD2027-specific targets and the production readiness boundary.

## Current deployment targets

WordPress at `https://christinedeloupy.fr` remains the content source. The CD2027 frontend currently deploys to the staging subdomain. Production is prepared as a separate GitHub workflow and environment, but remains locked until its own host path and public routing are configured.

| Target | Workflow | GitHub environment | Site origin | Trigger policy |
| --- | --- | --- | --- | --- |
| Staging | `.github/workflows/deploy-cd2027.yml` | `cd2027` | `https://cd2027.christinedeloupy.fr` | Published WordPress changes, manual build, daily reconciliation |
| Production | `.github/workflows/deploy-cd2027-production.yml` | `cd2027-production` | `https://christinedeloupy.fr` | Explicit request only; GitHub environment approval required |

The same WordPress content source may feed both builds, but each GitHub environment has independent site-origin and deployment values. Production must use a separate release root; never set it to the WordPress installation directory or its public document root.

## GitHub environment configuration

Keep the existing staging configuration under **Settings → Environments → `cd2027`**. The staging workflow reads `SITE_URL` and `WORDPRESS_ORIGIN` from that environment when set, with the current CD2027 origins as safe defaults. Its SSH destination is scoped to that environment only.

Create **Settings → Environments → `cd2027-production`** and configure its deployment secrets and variables independently. Use the same key names inside each environment so the workflow can select the correct values from the declared environment:

| Kind | Name | Production value |
| --- | --- | --- |
| Variable | `SITE_URL` | `https://christinedeloupy.fr` |
| Variable | `WORDPRESS_ORIGIN` | The HTTPS origin from which the build runner can fetch canonical WordPress content; update it if WordPress moves behind another host or route |
| Variable | `CD2027_REMOTE_ROOT` | A dedicated absolute release directory, separate from the WordPress files and document root |
| Variable | `CD2027_PRODUCTION_READY` | Leave unset or `false` until the dedicated release root and production web-server route are ready; set to `true` only afterward |
| Variable | `WORDPRESS_CONTENT_MODE` | `auto`, unless the production content API requires another documented mode |
| Secret | `CD2027_SSH_HOST` | Production SSH host |
| Secret | `CD2027_SSH_PORT` | Production SSH port, normally `22` |
| Secret | `CD2027_SSH_USER` | Restricted production deployment account |
| Secret | `CD2027_SSH_PASSWORD` | Password for that production account |
| Secret | `FONTAWESOME_PACKAGE_TOKEN` | Read token used to install the Pro icon package |
| Secret, optional | `WORDPRESS_API_USERNAME` | Read-only build account when authenticated WordPress content is required |
| Secret, optional | `WORDPRESS_API_APPLICATION_PASSWORD` | Application Password for that build account |

Set required reviewers on `cd2027-production`. The workflow also checks that `SITE_URL` is exactly `https://christinedeloupy.fr`, that the WordPress origin is HTTPS, that a production release root exists, and that `CD2027_PRODUCTION_READY` is exactly `true`. It exits before checkout/build/upload while the readiness flag is unset. Production uses `PRIVATE_VIEW=false` and does not create the staging login gate.

The staging workflow remains independent. Its secrets and `CD2027_REMOTE_ROOT` value must be configured in `cd2027`; it does not fall back to repository-level `STAGING_*` values. Reusing secret names across GitHub environments does not reuse their values.

The production workflow does not set up Apache, Nginx, a document root, DNS, or the WordPress runtime proxy. Before setting `CD2027_PRODUCTION_READY=true`, configure the host to serve the production `current` release for public Eleventy routes and preserve the required WordPress API, login, commerce, and form routes. Keep the deploy release path separate from WordPress files. This is required whether the host uses `.htaccess` or Nginx configuration.

## Install and configure the WP Awesome plugin

The existing `wordpress/mu-plugins/cd2027-eleventy-webhook.php` remains the legacy publisher until a separate live migration is requested. WP Awesome 0.1.0 now owns its own public-change capture, SQL outbox and staging dispatch. Do not activate both publishers for the same events.

To migrate, pause editorial changes, let the legacy cron drain its option-backed outbox, verify it is empty and preserve a backup, then remove the legacy MU-plugin before activating WP Awesome. Installing this package in the Eleventy repository does not perform that server-side migration. Copy all top-level PHP files from `node_modules/wp-awesome/wordpress-plugin/` to the plugin directory, including `wp-awesome.php`, `lifecycle.php`, and `uninstall.php`:

```text
wp-content/plugins/wp-awesome/wp-awesome.php
```

After the legacy publisher has been removed, activate **WP Awesome** in **Plugins**. It captures public changes, stores them before notifying listeners, displays metadata and GitHub run results, and provides explicit build buttons. Its durable outbox is `<table-prefix>wpec_publication_outbox`; it does not read or migrate the legacy option.

The legacy `CD2027_*` constants belong to the old MU-plugin. For WP Awesome, configure `WPEC_CONNECTOR_GITHUB_TOKEN` and `WPEC_CONNECTOR_REPOSITORY`; copy the existing server-side values if appropriate. Add them and this target map in `wp-config.php`, before WordPress loads `wp-settings.php`:

```php
define('WPEC_CONNECTOR_GITHUB_TOKEN', 'SERVER_ONLY_GITHUB_TOKEN');
define('WPEC_CONNECTOR_REPOSITORY', 'chdenat/cd2027');
define('WPEC_CONNECTOR_TARGETS', [
    'staging' => [
        'label' => 'Staging CD2027',
        'site_url' => 'https://cd2027.christinedeloupy.fr',
        'workflow' => 'deploy-cd2027.yml',
        'event_type' => 'cd2027_deploy',
        'enabled' => true,
    ],
    'production' => [
        'label' => 'Production',
        'site_url' => 'https://christinedeloupy.fr',
        'workflow' => 'deploy-cd2027-production.yml',
        'event_type' => 'cd2027_production_deploy',
        'enabled' => false,
    ],
]);
```

Keep the default `wpec_connector_send_content` cron hook; do not reuse the legacy hook or `WPEC_CONNECTOR_OUTBOX_OPTION`. WP Awesome resumes pending SQL events and retries unsuccessful dispatches. The production target stays disabled until its GitHub environment and server route have been verified. Only then should its `enabled` value be changed to `true`. The WordPress dashboard cannot read GitHub environment secrets; the production preflight and GitHub environment approval remain authoritative.

For a fine-grained token limited to `chdenat/cd2027`, grant **Contents: Read and write** for `repository_dispatch`. Add **Actions: Read** to list runs if the repository is private; public run history can be read without authentication. Do not grant Actions write. Keep the token in server-side `wp-config.php`; the plugin masks it and never puts it in the event payload.

## Dashboard behavior and limitations

Open **Tools → WP Awesome** in WordPress. It checks the repository format, token presence, REST API URL, configured targets, outbox count, and latest workflow runs. Each target displays the most recent ten Actions runs with their status, conclusion, branch, commit, start time, and link to GitHub. Results are cached for 60 seconds. The content table retains the last 100 event summaries and prunes history older than one year; it never stores content bodies.

Force-build requests use the target's configured event type. Staging rebuilds remain independent from the production workflow. A production request starts the production workflow, then waits for any reviewer required by `cd2027-production`. The dashboard reports the GitHub run outcome; the run is only successful after the workflow's build, checks, transfer, and atomic promotion finish.

This repository contains the implementation and workflow definitions. It does not install or activate the plugin on the live WordPress host, create GitHub environments, add secrets, or change production web-server routing. Those external settings remain to be configured before production can be enabled.
