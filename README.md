# Atelier Bun

Starter de site vitrine piloté par Bun, avec Eleventy, Web Awesome et Font Awesome.

## Commandes

```bash
bun install
bun run dev       # build puis serveur Eleventy avec rechargement
bun run build     # build Eleventy puis bundle navigateur Bun
bun run check     # vérification complète du build
```

Le site généré se trouve dans `_site/`. Les SVG Font Awesome sont copiés localement depuis
`@fortawesome/fontawesome-free` et utilisés par `<wa-icon>` via `setIconPath()`.

## Structure

- `src/index.njk` : page d’accueil
- `src/_includes/layouts/base.njk` : layout Eleventy partagé
- `src/assets/main.js` : point d’entrée navigateur Bun et composants Web Awesome
- `src/assets/styles.css` : thème et composition de la page
- `.eleventy.js` : configuration Eleventy et copie des assets Font Awesome
