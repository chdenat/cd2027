# Étude initiale — migration WordPress vers Eleventy

Date de l’étude : 1 octobre 2026.
Mise à jour de l’état d’implémentation : 2 octobre 2026.

## Périmètre et hypothèse

L’objectif étudié est de conserver WordPress pour l’édition et l’administration, puis de générer le frontend public avec Eleventy, Web Awesome et Font Awesome. L’analyse couvre les routes publiques de tout le site : pages de présentation, accompagnements, articles, archives, produits, formulaires, pages légales et parcours liés aux comptes et paiements.

Pour la phase actuelle, l’adresse visée pour le frontend Eleventy est `http://localhost:4555`. C’est une cible locale de développement, pas encore un hébergement de production. WordPress reste la source éditoriale ; les valeurs de thème `--cd2027--*` seront définies dans le code du projet et versionnées avec lui, sans interface de réglage dans WordPress.

L’inventaire détaillé des URL observées est dans [current-site-inventory.md](current-site-inventory.md). Il combine les objets publiés exposés par l’API WordPress et les sitemaps publics. Les pages nécessitant une connexion, une session panier, un paiement ou un service tiers demandent aussi un audit fonctionnel authentifié.

## Ce que révèle le site actuel

Au 1 octobre 2026, les sitemaps Yoast recensent 220 URL publiques uniques : 58 URL de pages, 142 articles, 8 URL dans le sitemap produit, 5 catégories d’articles, 6 catégories de produits et 1 archive auteur. L’API WordPress publique déclare 59 pages publiées, 142 articles et 7 produits achetables. Le sitemap produit classe la page `/std-boutique/` comme une URL produit alors que l’API la déclare comme page ; ce décalage de classification doit être résolu dans la carte des routes avant migration.

Le site ne se réduit pas à des pages éditoriales. L’inventaire contient le panier, la commande, les pages de résultat de paiement, le compte client, les factures et abonnements, des parcours de cours, des pages de capture de prospects, des formulaires, une newsletter et des pages légales. Le rendu WordPress publié contient des blocs Gutenberg standards, des blocs WooCommerce, des extensions Getwid et CoBlocks, ainsi que des shortcodes et intégrations.

Le thème WordPress public charge les polices Ibarra Real Nova, Made Mirage et Montserrat, un logo propre au site et de nombreuses images éditoriales. Son CSS consomme déjà des variables de presets WordPress. Le prototype local emploie encore `--site-color-*`, des éléments décoratifs provisoires et des textes différents ; il n’est donc pas encore une reproduction vérifiée du site courant.

Web Awesome fournit les composants, les tokens et les utilitaires de mise en page. Font Awesome est une bibliothèque d’icônes ; elle complète l’interface mais ne remplace ni le système de layout ni le thème. La reproduction exacte s’appuiera donc sur Web Awesome et le CSS du site pour la composition, et sur Font Awesome pour les icônes.

L’API REST WordPress expose des ressources de pages, articles, médias, taxonomies et produits. WordPress stocke le contenu Gutenberg sérialisé dans `post_content`; les blocs dynamiques dépendent toutefois d’un rendu côté serveur ou d’une extension. Ces ressources permettent une alimentation automatisée, mais ne garantissent pas que le HTML WordPress récupéré fonctionnera avec les seuls styles Eleventy.

## Avantages

| Avantage | Effet attendu |
| --- | --- |
| Garder le backend WordPress | L’éditeur et les habitudes de publication restent en place ; l’administration n’a pas à être reconstruite. |
| Servir des fichiers statiques | Les pages et articles générés peuvent être livrés rapidement, mis en cache et servis sans exécuter WordPress pour chaque lecture publique. |
| Séparer contenu et présentation | Eleventy peut reproduire les modèles avec des composants et layouts maîtrisés, sans imposer au frontend les limites du thème WordPress. |
| Centraliser le thème | Les variables `--cd2027--*` peuvent représenter les valeurs de la marque et alimenter les tokens Web Awesome, ce qui rend les ajustements cohérents. |
| Garder les contenus dans WordPress | Les articles, pages, images, taxonomies et produits peuvent rester éditables dans l’administration, sous réserve que leur structure soit exportable. |

## Inconvénients et difficultés

| Difficulté | Pourquoi elle compte ici |
| --- | --- |
| Fidélité visuelle | Un thème Web Awesome définit des tokens et composants ; il ne reconstitue pas à lui seul les compositions, images, proportions, espacements et comportements de toutes les pages WordPress. |
| Gutenberg et extensions | Les blocs statiques contiennent souvent du HTML, tandis que certains blocs sont calculés par WordPress ou une extension. Les styles, scripts, shortcodes et intégrations ne suivent pas automatiquement le contenu vers Eleventy. |
| Boutique et transactions | Un catalogue statique est faisable, mais panier, stock, coupons, paiement, compte, facture et abonnements nécessitent une session et un backend toujours opérationnels. |
| Formulaires et newsletter | Les formulaires doivent continuer à soumettre vers Forminator, MailPoet ou un service de remplacement, avec validation, consentement et anti-spam testés. |
| SEO et anciennes URL | Les canonicals, métadonnées, archives et redirections doivent être conservés ; le décompte API/sitemap montre déjà que les sources de routes ne sont pas identiques. |
| Automatisation exploitable | Un webhook peut être perdu, répété, reçu dans le désordre ou arriver avant que les données soient lisibles par l’API. Il faut des reprises, une déduplication, une file durable et un rapprochement périodique. |

### Niveau de difficulté estimé

La reprise des pages de présentation et des 142 articles est de difficulté moyenne à élevée : le volume est gérable, mais il faut identifier les modèles, les blocs d’extension, les médias et les métadonnées. Le thème de marque est de difficulté moyenne si les polices, photos et styles WordPress peuvent être exportés.

Garder WooCommerce comme moteur tout en déplaçant l’interface dans Eleventy demande une intégration technique élevée. Les sessions, extensions de paiement, coupons, taxes, comptes, abonnements, cours et formulaires doivent tous fonctionner derrière des appels API compatibles. Cette approche donne le contrôle visuel recherché sans déplacer les commandes hors de WordPress.

## Parcours dynamiques : options

Eleventy peut rendre les pages éditoriales et toutes les interfaces visibles des parcours dynamiques. WordPress/WooCommerce garde la responsabilité du contenu, de l’état du panier, des commandes, des paiements et des comptes. Eleventy affiche les réponses de l’API à l’exécution et transmet les actions au backend : l’interface est uniforme, mais elle n’est pas une page statique sans logique.

| Option | Fonctionnement | Avantages | Coûts et limites |
| --- | --- | --- | --- |
| Interface Eleventy, moteur WordPress/WooCommerce | Eleventy rend la boutique, le panier et le checkout ; son code d’interface échange avec les API WooCommerce. WordPress garde les données, les sessions, les commandes et le paiement. | Un seul thème pour le site et le parcours d’achat ; les fonctions de commerce et les données existantes restent dans WooCommerce. | Travail élevé : session/cookies ou jeton de panier, CORS/proxy, coupons, taxes, stock, passerelles de paiement, comptes et plugins doivent être compatibles avec l’API utilisée. |
| WordPress rend aussi les parcours dynamiques | WordPress continue d’afficher panier, checkout, compte et cours ; Eleventy sert articles et pages éditoriales. | Moins de code d’intégration au début et plugins inchangés. | Deux interfaces à harmoniser ; ce choix ne peut pas garantir le même rendu visuel sur tout le parcours. |
| Remplacer les parcours | Déplacer commerce, cours, formulaires ou newsletter vers un autre service ou une application dédiée, puis migrer les données et les liens. | Liberté de choisir un autre produit et de simplifier certaines extensions WordPress. | Option la plus coûteuse : migration et vérification des clients, commandes, paiements récurrents, accès aux cours, consentements, factures, URL historiques et obligations associées. Elle ne se justifie que si sortir de ces services est un objectif explicite. |

### Décision retenue

Eleventy rend l’interface publique du site, dont les articles, les formulaires, la boutique et l’ensemble de l’interface de commande : fiche produit, panier et checkout. WooCommerce reste le moteur de commande : il calcule stock, frais, coupons et totaux, crée les commandes et appelle les passerelles de paiement. Le panier Eleventy est une interface exécutée dans le navigateur qui lit et modifie l’état réel via l’API ; aucune donnée de panier ou de compte ne doit être intégrée au build statique.

L’API Store de WooCommerce fournit des opérations publiques de produits, panier et checkout. Par défaut, le panier dépend de la session du visiteur ; WooCommerce documente aussi un `Cart-Token` pour les interfaces headless. Les appels checkout exigent un jeton de sécurité valide. En local sur `http://localhost:4555`, il faudra donc configurer un proxy API de même origine ou une stratégie CORS/session/jeton adaptée. La compatibilité des passerelles de paiement et des extensions doit être testée : un plugin qui injecte des champs ou un écran serveur peut demander un adaptateur WordPress dédié.

La même règle vaut pour les formulaires visibles : Eleventy fournit le HTML, le style, les validations de présentation et les états de succès/erreur ; WordPress ou le service déjà relié reçoit et traite la soumission. Le shortcode ou le bloc WordPress ne sera pas copié tel quel dans une page statique. Il faut inventorier chaque formulaire (contact, inscription atelier, capture ebook, newsletter, etc.), identifier son destinataire et son automatisation, puis utiliser une API supportée ou créer un endpoint WordPress protégé contre le spam. Les formulaires de checkout restent rattachés à l’API WooCommerce.

À `http://localhost:4555`, le frontend de développement teste l’API WooCommerce au moyen du proxy local. La publication est séparée : WordPress envoie des événements signés au récepteur Bun sur un hôte accessible, puis un dispatcher appelle le workflow GitHub Actions du staging. Celui-ci relit l’état public WordPress et reconstruit l’ensemble du site.

## Éléments à valider ou compléter

- Un inventaire de routes actualisable qui réconcilie REST, sitemaps, menus, types de contenu, archives, formulaires et parcours authentifiés.
- Le MU-plugin et le relais GitHub sont implémentés pour les types de contenu publics, les métadonnées, les taxonomies, les médias et les menus. Il reste à configurer et valider leurs secrets et tâches cron sur l’hôte webhook.
- Un accès API en lecture seule pour le processus de build. Les secrets restent dans le gestionnaire de secrets de l’hébergeur ou du runner.
- Un adaptateur de données Eleventy qui pagine les réponses REST, conserve les identifiants, transforme les blocs pris en charge, signale les blocs inconnus et produit des routes stables.
- Une route API même-origine ou un proxy contrôlé pour les appels WooCommerce Store API, avec gestion vérifiée des sessions/cookies ou des Cart-Token et des nonces. Éviter de placer des secrets privilégiés dans le JavaScript public.
- Une matrice de formulaires indiquant pour chaque formulaire son URL, ses champs, son plugin/provider actuel, son destinataire, les consentements, l’anti-spam, les notifications, l’API de soumission et les états de succès/erreur. Le mapping Forminator/MailPoet mentionné dans l’étude reste à confirmer formulaire par formulaire.
- La file sur disque et les reprises d’envoi existent ; vérifier que le stockage de l’hôte webhook est persistant et privé. Le statut du build/déploiement doit être suivi séparément du `202` du récepteur.
- Le workflow GitHub de staging réalise le build, le contrôle des routes et la promotion atomique. La cible de production reste à configurer.
- Des captures de référence du site actuel par type de page et par viewport, ainsi qu’un inventaire des polices, logos, photos, alt text, formulaires, extensions, paiements et cours.
- Pour plus tard, une cible de production et une configuration DNS/proxy. Si le même domaine sert Eleventy et WordPress, il faudra décider comment conserver `/wp-admin`, l’API, les pages transactionnelles et les routes publiques. La cible immédiate de développement est `http://localhost:4555`.

Dans le dépôt, Eleventy et le serveur frontend local utilisent le port `4555`. Le récepteur Bun écoute par défaut sur `127.0.0.1:8787`, vérifie signature, horodatage et schéma puis stocke les événements dans une file. Sur l’hôte webhook, le dispatcher les regroupe et demande le workflow GitHub Actions. Le workflow reconstruit le site complet depuis WordPress et déploie atomiquement le staging. Le frontend local ne scrute pas WordPress et ne consomme pas cette file.

Le `package.json` contient les commandes `dev`, `build`, `check`, `webhook` et `webhook:dispatch`, ainsi que les dépendances Eleventy, Web Awesome et Font Awesome. Chaque build GitHub télécharge les données WordPress publiques et reconstitue le site complet.

## Stratégie fiable de mise à jour

La garantie repose sur une livraison au moins une fois, rendue idempotente, et contrôlée par rapprochement périodique. Le récepteur stocke les événements avant de répondre, le dispatcher réessaie les appels GitHub, et le workflow planifié reconstruit le staging chaque jour. Un webhook seul ne garantit pas que chaque changement sera livré une seule fois et immédiatement.

1. WordPress envoie, après une modification validée et publique, un événement minimal signé contenant l’identifiant stable de l’événement, le type et l’identifiant du contenu, son statut et sa révision. Les brouillons et autosaves ne déclenchent pas de mise en production.
2. Le récepteur vérifie la signature sur le corps brut, un horodatage anti-rejeu, la taille du corps et la route autorisée. Il enregistre le job durablement avant de répondre avec succès.
3. Le dispatcher déduplique par identifiant et regroupe les événements en attente. GitHub relit l’état canonique actuel via l’adaptateur Eleventy ; le webhook est un signal, pas une copie de contenu considérée comme vérité.
4. Le worker récupère aussi les changements qui retirent du contenu : suppression, dépublication, slug, taxonomie, image, menu ou métadonnée SEO. Les anciennes URL sont conservées ou redirigées selon la carte des routes.
5. GitHub Actions reconstruit l’ensemble du site pour les événements reçus. Cela garde cohérents le contenu, les routes, les archives et les données de WooCommerce ; aucun traitement spécial par titre ou par type de page n’est requis.
6. Si la livraison du webhook échoue, WordPress réessaie via WP-Cron ; si l’appel GitHub échoue, le dispatcher réessaie avec attente progressive. Si le build ou le déploiement échoue après acceptation par GitHub, l’ancienne version de staging reste active et le build planifié quotidien ou une relance manuelle sert de reprise.
7. Si tout passe, l’hébergeur promeut l’artefact de manière atomique. Le journal de suivi relie l’événement WordPress, la révision, le build et le déploiement.
8. Le workflow reconstruit entièrement le staging chaque jour. Cette réconciliation recrée les routes depuis l’état public WordPress même si un événement n’a jamais atteint GitHub.

Un hébergeur avec déploiement à partir de Git ou un build hook peut exécuter Eleventy ; Eleventy documente les deux familles d’hébergement. Le choix entre hook de l’hébergeur, GitHub Actions et récepteur Bun dépend de l’hébergement final et de la nécessité d’accéder à des données WordPress privées.

Pour le thème, centraliser les valeurs de référence en variables `--cd2027--*`, puis les relier aux tokens Web Awesome documentés. Les variables personnalisées restent la couche du site ; les tokens `--wa-*` restent l’interface de Web Awesome. Le thème partagé ne remplacera pas le travail de reproduction des gabarits propres aux pages.

## Décisions restant à prendre

- Pour chaque modification de contenu, publier automatiquement dès que WordPress passe en état public, ou garder une étape de validation séparée dans un environnement de prévisualisation ?
- Une fois le manifeste et la commande de lancement réconciliés, démarrer Eleventy et vérifier qu’il répond sur `http://localhost:4555`. Le port est configuré, mais cela ne prouve pas qu’un serveur est déjà lancé.

## Sources

- [Site public actuel](https://christinedeloupy.fr/) et [inventaire des routes](current-site-inventory.md).
- [WordPress REST API reference](https://developer.wordpress.org/rest-api/reference/) pour pages, articles, médias et taxonomies.
- [WordPress block editor: edit and save](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/) et [dynamic blocks](https://developer.wordpress.org/block-editor/how-to-guides/block-tutorial/creating-dynamic-blocks/) pour les différences entre contenu sérialisé et rendu serveur.
- [WordPress `transition_post_status` hook](https://developer.wordpress.org/reference/hooks/transition_post_status/) : ce hook peut aussi se déclencher lors d’une mise à jour où le statut ne change pas ; filtrer et dédupliquer les événements.
- [WooCommerce Store API](https://developer.woocommerce.com/docs/apis/store-api/) pour les API publiques de produits, panier et checkout ; [Cart Tokens](https://developer.woocommerce.com/docs/apis/store-api/cart-tokens) pour les interactions headless et [Checkout API](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/checkout) pour la création de commandes et le paiement.
- [Web Awesome design tokens](https://webawesome.com/docs/tokens/) et [theming](https://webawesome.com/docs/theming-overview) pour l’extension des tokens CSS.
- [Web Awesome layout utilities](https://webawesome.com/docs/utilities/) et [Font Awesome documentation](https://docs.fontawesome.com/) pour leurs rôles respectifs dans le frontend.
- [Eleventy Dev Server](https://www.11ty.dev/docs/dev-server/) pour configurer le port local de prévisualisation.
- [Eleventy deployment documentation](https://www.11ty.dev/docs/deployment/) pour les builds hébergés et déploiements statiques.
