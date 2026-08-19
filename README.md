# Atelier Bun

Starter de site vitrine piloté par Bun, avec Eleventy, Web Awesome et Font Awesome.

## Commandes

```bash
bun install
bun run dev       # build puis serveur Eleventy avec rechargement
bun run build     # build Eleventy puis bundle navigateur Bun
bun run check     # vérification complète du build
bun run webhook   # démarre le récepteur webhook Bun
```

Le site généré se trouve dans `_site/`. Les SVG Font Awesome sont copiés localement depuis
`@fortawesome/fontawesome-free` et utilisés par `<wa-icon>` via `setIconPath()`.

## Structure

- `src/index.njk` : page d’accueil
- `src/_includes/layouts/base.njk` : layout Eleventy partagé
- `src/assets/main.js` : point d’entrée navigateur Bun et composants Web Awesome
- `src/assets/styles.css` : thème et composition de la page
- `.eleventy.js` : configuration Eleventy et copie des assets Font Awesome
- `webhook/server.js` : endpoint JavaScript Bun sécurisé pour recevoir les mises à jour

## Webhook Christine Deloupy

Copie `.env.example` vers `.env`, définis un secret partagé avec le plugin webhook installé sur
`christinedeloupy.fr`, puis lance :

```bash
bun run webhook
```

L’endpoint à configurer côté WordPress est `POST /webhooks/christine`. Il vérifie la signature
HMAC-SHA256 envoyée dans `X-Webhook-Signature` sous la forme `sha256=<signature>`, puis enregistre
chaque événement dans `.data/webhooks/`. La route `GET /health` permet de vérifier que le service
répond.
