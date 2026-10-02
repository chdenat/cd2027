# Current WordPress route inventory

Snapshot: 2026-10-01. This inventory covers the whole public site, not just the homepage.

Sources: public WordPress REST API and Yoast XML sitemaps on christinedeloupy.fr. This is a snapshot; repeat the inventory before migration and after large content changes. The REST API count includes published records that are not necessarily indexed or listed in the sitemaps.

## Route counts

| Source type | Records or URLs |
| --- | ---: |
| Unique URLs across all public Yoast sitemaps | 220 |
| Published WordPress pages from REST API | 59 |
| Page URLs in the Yoast page sitemap | 58 |
| Published WordPress posts from REST API | 142 |
| Post URLs in the Yoast post sitemap | 142 |
| Purchasable products from WooCommerce Store API | 7 |
| URLs in the Yoast product sitemap | 8 |
| Post categories | 5 |
| Product categories in sitemap | 6 |
| Author sitemap URLs | 1 |

The counts do not describe only page templates. The site also has editorial archives, product catalog routes, cart and checkout pages, customer-account pages, subscription and payment-result pages, courses, forms, and newsletter flows.

## Architecture decision for this migration

Eleventy owns the public visual interface across the site, including the complete WooCommerce order flow and the site forms. WordPress/WooCommerce remains the content and transaction backend for product data, cart state, orders, payments, account and course records, and form/newsletter processing. Dynamic customer data is loaded at runtime, never written into static output. Audit each plugin and flow for API support; record any necessary WordPress-rendered or provider-hosted fallback as an explicit visual exception.

## Sitemaps

| Sitemap | Last modified | URLs |
| --- | --- | ---: |
| [post-sitemap.xml](https://christinedeloupy.fr/post-sitemap.xml) | 2026-09-30T14:25:38+00:00 | 142 |
| [page-sitemap.xml](https://christinedeloupy.fr/page-sitemap.xml) | 2026-09-23T08:42:35+00:00 | 58 |
| [product-sitemap.xml](https://christinedeloupy.fr/product-sitemap.xml) | 2026-09-12T14:56:58+00:00 | 8 |
| [category-sitemap.xml](https://christinedeloupy.fr/category-sitemap.xml) | 2026-09-30T14:25:38+00:00 | 5 |
| [product_cat-sitemap.xml](https://christinedeloupy.fr/product_cat-sitemap.xml) | 2026-09-12T14:56:58+00:00 | 6 |
| [author-sitemap.xml](https://christinedeloupy.fr/author-sitemap.xml) | 2023-12-30T14:13:31+00:00 | 1 |

## Published WordPress pages

| ID | Title | URL | In page sitemap |
| ---: | --- | --- | --- |
| 15816 | Reçois ton cadeau! | [https://christinedeloupy.fr/recois-ton-cadeau/](https://christinedeloupy.fr/recois-ton-cadeau/) | Yes |
| 15513 | Inscription Atelier « Ralentir pour mieux se retrouver » | [https://christinedeloupy.fr/inscription-atelier-ralentir-pour-mieux-se-retrouver/](https://christinedeloupy.fr/inscription-atelier-ralentir-pour-mieux-se-retrouver/) | Yes |
| 15467 | Atelier « Rallume le Feu Sacré » | [https://christinedeloupy.fr/atelier-rallumer-le-feu-sacre/](https://christinedeloupy.fr/atelier-rallumer-le-feu-sacre/) | Yes |
| 15446 | Inscription racines et lumière | [https://christinedeloupy.fr/inscription-racines-et-lumieres/](https://christinedeloupy.fr/inscription-racines-et-lumieres/) | Yes |
| 15449 | Bienvenue dans Racines et Lumière | [https://christinedeloupy.fr/bienvenue-dans-racines-et-lumiere/](https://christinedeloupy.fr/bienvenue-dans-racines-et-lumiere/) | Yes |
| 11762 | Vivante et libre | [https://christinedeloupy.fr/vivante-et-libre/](https://christinedeloupy.fr/vivante-et-libre/) | Yes |
| 14254 | All Courses | [https://christinedeloupy.fr/courses/](https://christinedeloupy.fr/courses/) | Yes |
| 14252 | Instructor | [https://christinedeloupy.fr/instructor/](https://christinedeloupy.fr/instructor/) | Yes |
| 6441 | Recevez mon ebook « ma journée positive » | [https://christinedeloupy.fr/ebook-ma-journee-positive/](https://christinedeloupy.fr/ebook-ma-journee-positive/) | Yes |
| 13927 | La Voie de la Sagesse | [https://christinedeloupy.fr/accompagnement-abondance-et-joie/](https://christinedeloupy.fr/accompagnement-abondance-et-joie/) | Yes |
| 13664 | En cadeau, ma MÉDITATION » lâcher-prise » | [https://christinedeloupy.fr/ebook-augmenter-mon-taux-vibratoire-2/](https://christinedeloupy.fr/ebook-augmenter-mon-taux-vibratoire-2/) | Yes |
| 13684 | Merci pour votre inscription | [https://christinedeloupy.fr/merci-pour-votre-inscription/](https://christinedeloupy.fr/merci-pour-votre-inscription/) | Yes |
| 13392 | Renaissance Souveraine | [https://christinedeloupy.fr/seance-personnalisee/](https://christinedeloupy.fr/seance-personnalisee/) | Yes |
| 13347 | Mon Podcast | [https://christinedeloupy.fr/mon-podcast/](https://christinedeloupy.fr/mon-podcast/) | Yes |
| 13105 | Ebook « Augmenter son taux vibratoire » | [https://christinedeloupy.fr/ebook-augmenter-mon-taux-vibratoire/](https://christinedeloupy.fr/ebook-augmenter-mon-taux-vibratoire/) | Yes |
| 12820 | Wpsd Thank You | [https://christinedeloupy.fr/wpsd-thank-you/](https://christinedeloupy.fr/wpsd-thank-you/) | Yes |
| 12818 | Payment Failed | [https://christinedeloupy.fr/payment-failed/](https://christinedeloupy.fr/payment-failed/) | Yes |
| 12817 | Payment Confirmation | [https://christinedeloupy.fr/payment-confirmation/](https://christinedeloupy.fr/payment-confirmation/) | Yes |
| 12816 | Products | [https://christinedeloupy.fr/products/](https://christinedeloupy.fr/products/) | Yes |
| 12815 | Checkout-Result | [https://christinedeloupy.fr/stripe-checkout-result/](https://christinedeloupy.fr/stripe-checkout-result/) | Yes |
| 12545 | Mon profil | [https://christinedeloupy.fr/mon-compte/mon-profil/](https://christinedeloupy.fr/mon-compte/mon-profil/) | Yes |
| 12543 | Nos différents Abonnements aux ateliers | [https://christinedeloupy.fr/mon-compte/abonnements-ateliers/](https://christinedeloupy.fr/mon-compte/abonnements-ateliers/) | Yes |
| 12542 | Vos factures d’abonnements | [https://christinedeloupy.fr/mon-compte/vos-factures-abonnements/](https://christinedeloupy.fr/mon-compte/vos-factures-abonnements/) | Yes |
| 12541 | Confirmation d’abonnement | [https://christinedeloupy.fr/mon-compte/confirmation-abonnement/](https://christinedeloupy.fr/mon-compte/confirmation-abonnement/) | Yes |
| 12540 | Paiement | [https://christinedeloupy.fr/mon-compte/paiement-abonnement/](https://christinedeloupy.fr/mon-compte/paiement-abonnement/) | Yes |
| 12539 | Annulation d’abonnement | [https://christinedeloupy.fr/mon-compte/annulation-abonnement/](https://christinedeloupy.fr/mon-compte/annulation-abonnement/) | Yes |
| 12538 | Vos informations de facturation | [https://christinedeloupy.fr/mon-compte/vos-infos-facturation/](https://christinedeloupy.fr/mon-compte/vos-infos-facturation/) | Yes |
| 12537 | Mon compte | [https://christinedeloupy.fr/mon-compte/](https://christinedeloupy.fr/mon-compte/) | Yes |
| 12499 | Mon profil | [https://christinedeloupy.fr/mon-profil-lp/](https://christinedeloupy.fr/mon-profil-lp/) | Yes |
| 12497 | Validation de commande d’atelier | [https://christinedeloupy.fr/validation-de-commande-atelier/](https://christinedeloupy.fr/validation-de-commande-atelier/) | Yes |
| 11714 | Gestion des abonnements | [https://christinedeloupy.fr/gestion-des-abonnements/](https://christinedeloupy.fr/gestion-des-abonnements/) | Yes |
| 11403 | Conditions générales de vente | [https://christinedeloupy.fr/cgv/](https://christinedeloupy.fr/cgv/) | Yes |
| 11380 | Ma Newsletter | [https://christinedeloupy.fr/newsletter/](https://christinedeloupy.fr/newsletter/) | Yes |
| 11111 | Ma boutique | [https://christinedeloupy.fr/boutique/](https://christinedeloupy.fr/boutique/) | Yes |
| 11031 | Mes bijoux | [https://christinedeloupy.fr/mes-bijoux/](https://christinedeloupy.fr/mes-bijoux/) | Yes |
| 11636 | Spritualité | [https://christinedeloupy.fr/mon-blog/spiritualite/](https://christinedeloupy.fr/mon-blog/spiritualite/) | Yes |
| 11633 | Rituels | [https://christinedeloupy.fr/mon-blog/rituel/](https://christinedeloupy.fr/mon-blog/rituel/) | Yes |
| 11623 | Développement personnel | [https://christinedeloupy.fr/mon-blog/developpement-personnel/](https://christinedeloupy.fr/mon-blog/developpement-personnel/) | Yes |
| 11090 | Mes vidéos | [https://christinedeloupy.fr/mon-blog/mes-videos/](https://christinedeloupy.fr/mon-blog/mes-videos/) | Yes |
| 10978 | Mon Blog | [https://christinedeloupy.fr/mon-blog/](https://christinedeloupy.fr/mon-blog/) | Yes |
| 10709 | Bracelet Magik intention | [https://christinedeloupy.fr/mes-bijoux/bracelet-magik-intention/](https://christinedeloupy.fr/mes-bijoux/bracelet-magik-intention/) | Yes |
| 10693 | Bracelet chemin de vie | [https://christinedeloupy.fr/mes-bijoux/bracelet-chemin-de-vie/](https://christinedeloupy.fr/mes-bijoux/bracelet-chemin-de-vie/) | Yes |
| 10690 | des magiks bijoux | [https://christinedeloupy.fr/mes-bijoux/bracelets-fil-karmique/](https://christinedeloupy.fr/mes-bijoux/bracelets-fil-karmique/) | Yes |
| 10343 | Accueil Home page | [https://christinedeloupy.fr/](https://christinedeloupy.fr/) | Yes |
| 6646 | échangeons! | [https://christinedeloupy.fr/seance-clarte/](https://christinedeloupy.fr/seance-clarte/) | Yes |
| 8631 | Lecture akashique | [https://christinedeloupy.fr/mes-accompagnements/lecture-akashique/](https://christinedeloupy.fr/mes-accompagnements/lecture-akashique/) | Yes |
| 8296 | Politique de confidentialité | [https://christinedeloupy.fr/politique-de-confidentialite/](https://christinedeloupy.fr/politique-de-confidentialite/) | Yes |
| 7395 | Paiement annulé | [https://christinedeloupy.fr/annuler-paiement/](https://christinedeloupy.fr/annuler-paiement/) | Yes |
| 7393 | Merci pour votre paiement | [https://christinedeloupy.fr/merci-paiement/](https://christinedeloupy.fr/merci-paiement/) | Yes |
| 7065 | Mentions légales | [https://christinedeloupy.fr/mentions-legales/](https://christinedeloupy.fr/mentions-legales/) | Yes |
| 8113 | Mes Accompagnements | [https://christinedeloupy.fr/mes-accompagnements/](https://christinedeloupy.fr/mes-accompagnements/) | Yes |
| 6638 | Si vous aviez une baguette magique ? | [https://christinedeloupy.fr/si-vous-aviez-une-baguette-magique/](https://christinedeloupy.fr/si-vous-aviez-une-baguette-magique/) | Yes |
| 6644 | Elles en parlent | [https://christinedeloupy.fr/elles-en-parlent/](https://christinedeloupy.fr/elles-en-parlent/) | Yes |
| 6427 | Boutique | [https://christinedeloupy.fr/std-boutique/](https://christinedeloupy.fr/std-boutique/) | No |
| 1700 | Mon compte | [https://christinedeloupy.fr/mon-compte-2/](https://christinedeloupy.fr/mon-compte-2/) | Yes |
| 1699 | Votre commande | [https://christinedeloupy.fr/commande/](https://christinedeloupy.fr/commande/) | Yes |
| 1698 | Votre panier | [https://christinedeloupy.fr/panier/](https://christinedeloupy.fr/panier/) | Yes |
| 89 | Maintenance | [https://christinedeloupy.fr/maintenance/](https://christinedeloupy.fr/maintenance/) | Yes |
| 87 | Contact | [https://christinedeloupy.fr/contact/](https://christinedeloupy.fr/contact/) | Yes |

## Published articles

WordPress reports 142 published articles. The table is the current public API inventory; article routes are generated from these records and must retain their slugs, canonical URLs, taxonomy membership, dates, media, and SEO metadata.

| ID | Title | Categories | URL |
| ---: | --- | --- | --- |
| 16353 | Et sinon dans la vraie vie? | Articles, Développement personnel | [https://christinedeloupy.fr/et-sinon-dans-la-vraie-vie/](https://christinedeloupy.fr/et-sinon-dans-la-vraie-vie/) |
| 16348 | Pratique de la récolte intérieure | Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-femmes-50-ans-recolte-interieure/](https://christinedeloupy.fr/rituel-femmes-50-ans-recolte-interieure/) |
| 16344 | Une pratique pour sur ton chemin | Développement personnel, Rituel, Spiritualité | [https://christinedeloupy.fr/une-pratique-pour-sur-ton-chemin/](https://christinedeloupy.fr/une-pratique-pour-sur-ton-chemin/) |
| 16327 | Le rituel de la femme qui sait | Rituel, Spiritualité | [https://christinedeloupy.fr/le-rituel-de-la-femme-qui-sait/](https://christinedeloupy.fr/le-rituel-de-la-femme-qui-sait/) |
| 16324 | Le petit pas de la rentrée | Développement personnel, Spiritualité | [https://christinedeloupy.fr/le-petit-pas-de-la-rentree/](https://christinedeloupy.fr/le-petit-pas-de-la-rentree/) |
| 16318 | Méditation Lâcher et Choisir | Développement personnel, Rituel, Spiritualité | [https://christinedeloupy.fr/meditation-lacher-et-choisir/](https://christinedeloupy.fr/meditation-lacher-et-choisir/) |
| 16272 | Les minéraux de la rentrée | Articles, Rituel, Spiritualité | [https://christinedeloupy.fr/les-mineraux-de-la-rentree/](https://christinedeloupy.fr/les-mineraux-de-la-rentree/) |
| 16261 | Un Rituel d’été de la Gardienne | Articles, Rituel, Spiritualité | [https://christinedeloupy.fr/un-rituel-dete-de-la-gardienne/](https://christinedeloupy.fr/un-rituel-dete-de-la-gardienne/) |
| 16231 | Le rituel de la Gardienne | Articles, Rituel, Spiritualité | [https://christinedeloupy.fr/le-rituel-de-la-gardienne/](https://christinedeloupy.fr/le-rituel-de-la-gardienne/) |
| 16224 | Et si vous étiez déjà arrivée ? | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/et-si-vous-etiez-deja-arrivee/](https://christinedeloupy.fr/et-si-vous-etiez-deja-arrivee/) |
| 16166 | honorer les saisons : l’été | Rituel, Spiritualité | [https://christinedeloupy.fr/honorer-les-saisons-lete/](https://christinedeloupy.fr/honorer-les-saisons-lete/) |
| 16145 | Rituel de la Gardienne de Sagesse | Articles, Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-de-la-gardienne-de-sagesse/](https://christinedeloupy.fr/rituel-de-la-gardienne-de-sagesse/) |
| 16086 | Savoir recevoir | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/savoir-recevoir/](https://christinedeloupy.fr/savoir-recevoir/) |
| 16046 | Lâcher‑prise : l’art de cesser de se retenir | Articles, Développement personnel, Rituel, Spiritualité | [https://christinedeloupy.fr/lacher-prise-lart-de-cesser-de-se-retenir/](https://christinedeloupy.fr/lacher-prise-lart-de-cesser-de-se-retenir/) |
| 16042 | Rituel simple pour la Pleine lune du 1 Mai | Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-pleine-lune-1-mai/](https://christinedeloupy.fr/rituel-pleine-lune-1-mai/) |
| 16028 | La Visionnaire Sage | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/visionnaire-sage-archetype-femme-mature/](https://christinedeloupy.fr/visionnaire-sage-archetype-femme-mature/) |
| 16016 | Rituel d’Avril : “Ouvrir la porte du dedans” | Articles, Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-avril-porte-du-dedans/](https://christinedeloupy.fr/rituel-avril-porte-du-dedans/) |
| 16013 | Pourquoi certaines femmes deviennent plus libres après 50 ans | Articles, Développement personnel | [https://christinedeloupy.fr/femmes-libres-apres-50-ans-et-plus/](https://christinedeloupy.fr/femmes-libres-apres-50-ans-et-plus/) |
| 16010 | Une guidance lumineuse pour retrouver sens, paix et élan | Articles, Spiritualité | [https://christinedeloupy.fr/guidance-lumineuse-lecture-akashique/](https://christinedeloupy.fr/guidance-lumineuse-lecture-akashique/) |
| 15992 | Message pour celles qui traversent un passage | Articles, Développement personnel | [https://christinedeloupy.fr/transition-vie-femme-50-verite-interieure/](https://christinedeloupy.fr/transition-vie-femme-50-verite-interieure/) |
| 15989 | Nouvelle Lune du 19 mars . Laisser couler ce qui veut naître. | Articles, Spiritualité | [https://christinedeloupy.fr/nouvelle-lune-19-mars-energies-intention-nouveau-cycle/](https://christinedeloupy.fr/nouvelle-lune-19-mars-energies-intention-nouveau-cycle/) |
| 15973 | Le plus grand mensonge qu’on ait raconté aux femmes. | Articles, Développement personnel | [https://christinedeloupy.fr/le-plus-grand-mensonge-quont-ait-raconte-aux-femmes/](https://christinedeloupy.fr/le-plus-grand-mensonge-quont-ait-raconte-aux-femmes/) |
| 15970 | Ce que personne ne te dit sur le Féminin Sacré | Articles, Spiritualité | [https://christinedeloupy.fr/brouillon-autoce-que-personne-ne-te-dit/](https://christinedeloupy.fr/brouillon-autoce-que-personne-ne-te-dit/) |
| 15967 | La lecture akashique n’est pas ce que tu crois. | Articles, Spiritualité | [https://christinedeloupy.fr/la-lecture-akashique-nest-pas-ce-que-tu-crois/](https://christinedeloupy.fr/la-lecture-akashique-nest-pas-ce-que-tu-crois/) |
| 15964 | Rituel “Je me choisis” | Articles, Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-je-me-choisis/](https://christinedeloupy.fr/rituel-je-me-choisis/) |
| 15956 | Pour Toutes les Femmes Qui Avancent, Même Quand C’est Lent | Articles, Développement personnel | [https://christinedeloupy.fr/femmes-qui-avancent-lentement/](https://christinedeloupy.fr/femmes-qui-avancent-lentement/) |
| 15912 | Visualisation Reprise de pouvoir | Rituel, Spiritualité | [https://christinedeloupy.fr/visualisation-reprise-de-pouvoir-transformation-interieure/](https://christinedeloupy.fr/visualisation-reprise-de-pouvoir-transformation-interieure/) |
| 15907 | Sororité : choisir de se rassembler | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/sororite-apres-50-ans-se-rassembler/](https://christinedeloupy.fr/sororite-apres-50-ans-se-rassembler/) |
| 15885 | Écouter ce que je veux vraiment pour les 20 prochaines années | Articles, Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-ecriture-apres-55-ans-transition-vie/](https://christinedeloupy.fr/rituel-ecriture-apres-55-ans-transition-vie/) |
| 15880 | Rituel de la Pleine Lune de Neige | Rituel | [https://christinedeloupy.fr/rituel-pleine-lune-de-neige/](https://christinedeloupy.fr/rituel-pleine-lune-de-neige/) |
| 15871 | Quand une émotion réveille quelque chose en toi | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/transition-interieure-apres-55-ans-reperes/](https://christinedeloupy.fr/transition-interieure-apres-55-ans-reperes/) |
| 15864 | Traverser une transition de vie après 55 ans | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/transition-de-vie-apres-55-ans/](https://christinedeloupy.fr/transition-de-vie-apres-55-ans/) |
| 15841 | Les Archives akashiques appellent ceux qui sont prêts à écouter. | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/transmission-archives-akashiques-ecoute/](https://christinedeloupy.fr/transmission-archives-akashiques-ecoute/) |
| 15802 | Rituel simple pour traverser le chaos collectif | Articles, Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-simple-pour-traverser-le-chaos-collectif/](https://christinedeloupy.fr/rituel-simple-pour-traverser-le-chaos-collectif/) |
| 15799 | Ce que j’ai pensé perdre , je l’ai gagné en souveraineté. | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/ce-que-jai-cru-perdre-gagne-en-souverainete/](https://christinedeloupy.fr/ce-que-jai-cru-perdre-gagne-en-souverainete/) |
| 15780 | Incarnons notre puissance | Articles, Spiritualité | [https://christinedeloupy.fr/vivre-apres-60-spiritualite-puissance/](https://christinedeloupy.fr/vivre-apres-60-spiritualite-puissance/) |
| 15773 | Vivre l’après 50 ans avec spiritualité et légèreté | Développement personnel, Spiritualité | [https://christinedeloupy.fr/vivre-apres-50-spiritualite-legere/](https://christinedeloupy.fr/vivre-apres-50-spiritualite-legere/) |
| 15768 | Je ne veux plus me transformer, je veux me retrouver | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/retrouver-soi-apres-50-ans/](https://christinedeloupy.fr/retrouver-soi-apres-50-ans/) |
| 15766 | Le Rituel de la Permission | Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-essence-feminine-apres-50-ans/](https://christinedeloupy.fr/rituel-essence-feminine-apres-50-ans/) |
| 15753 | Rituel : “Revenir à soi” Réveiller son feu sacré | Rituel, Spiritualité | [https://christinedeloupy.fr/rituel-revenir-a-soi-reveiller-son-feu-sacre/](https://christinedeloupy.fr/rituel-revenir-a-soi-reveiller-son-feu-sacre/) |
| 15745 | L’aube des Femmes Sacrées après 50 ans | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/aube-femmes-sacrees-renouveau-apres-50-ans/](https://christinedeloupy.fr/aube-femmes-sacrees-renouveau-apres-50-ans/) |
| 15615 | La maturité, ce n’est pas avoir toutes les réponses. | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/la-maturite-ce-nest-pas-avoir-toutes-les-reponses/](https://christinedeloupy.fr/la-maturite-ce-nest-pas-avoir-toutes-les-reponses/) |
| 15608 | J’ai 63 ans et je suis enfin en paix | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/jai-63-ans-et-je-suis-enfin-en-paix/](https://christinedeloupy.fr/jai-63-ans-et-je-suis-enfin-en-paix/) |
| 15504 | 💫 une prière pour revenir à son féminin sacré | Spiritualité | [https://christinedeloupy.fr/%f0%9f%92%ab-une-priere-pour-revenir-a-son-feminin-sacre/](https://christinedeloupy.fr/%f0%9f%92%ab-une-priere-pour-revenir-a-son-feminin-sacre/) |
| 15436 | 10 signes que ton éveil spirituel a déjà commencé | Articles, Spiritualité | [https://christinedeloupy.fr/10-signes-que-ton-eveil-spirituel-a-deja-commence/](https://christinedeloupy.fr/10-signes-que-ton-eveil-spirituel-a-deja-commence/) |
| 15423 | Spiritualité & Vie Pro : Faut-il choisir ? | Développement personnel, Spiritualité | [https://christinedeloupy.fr/spiritualite-vie-pro-faut-il-choisir/](https://christinedeloupy.fr/spiritualite-vie-pro-faut-il-choisir/) |
| 15414 | La course vers la perfection… | Articles, Spiritualité | [https://christinedeloupy.fr/la-course-vers-la-perfection/](https://christinedeloupy.fr/la-course-vers-la-perfection/) |
| 15399 | Rituel de Pleine Lune Fun & Décalé | Articles, Rituel | [https://christinedeloupy.fr/rituel-de-pleine-lune-fun-decale/](https://christinedeloupy.fr/rituel-de-pleine-lune-fun-decale/) |
| 15347 | Nouvelle lune en poisson du 28 février | Rituel, Spiritualité | [https://christinedeloupy.fr/nouvelle-lune-en-poisson-du-28-fevrier/](https://christinedeloupy.fr/nouvelle-lune-en-poisson-du-28-fevrier/) |
| 15334 | Ce que personne ne te dit… | Articles | [https://christinedeloupy.fr/ce-que-personne-ne-te-dit/](https://christinedeloupy.fr/ce-que-personne-ne-te-dit/) |
| 15316 | Cette énergie féminine que les femmes masquent | Développement personnel, Spiritualité | [https://christinedeloupy.fr/cette-energie-feminine-que-les-femmes-masquent/](https://christinedeloupy.fr/cette-energie-feminine-que-les-femmes-masquent/) |
| 15244 | ça risque de ne pas te plaire… mais | Articles, Spiritualité | [https://christinedeloupy.fr/ca-risque-de-ne-pas-te-plaire-mais/](https://christinedeloupy.fr/ca-risque-de-ne-pas-te-plaire-mais/) |
| 15167 | Je l’ai tu car j’avais honte… | Développement personnel, Spiritualité | [https://christinedeloupy.fr/je-lai-tu-car-javais-honte/](https://christinedeloupy.fr/je-lai-tu-car-javais-honte/) |
| 15149 | Ouvrir ton dossier akashique | Spiritualité | [https://christinedeloupy.fr/ouvrir-ton-dossier-akashique/](https://christinedeloupy.fr/ouvrir-ton-dossier-akashique/) |
| 15027 | L’argent et la patate chaude | Développement personnel, Spiritualité | [https://christinedeloupy.fr/largent-et-la-patate-chaude/](https://christinedeloupy.fr/largent-et-la-patate-chaude/) |
| 15020 | Un féminin puissant | Développement personnel, Spiritualité | [https://christinedeloupy.fr/un-feminin-puissant/](https://christinedeloupy.fr/un-feminin-puissant/) |
| 15003 | Laisse-moi te dire… | Spiritualité | [https://christinedeloupy.fr/laisse-moi-te-dire/](https://christinedeloupy.fr/laisse-moi-te-dire/) |
| 14983 | On n’est pas dans le monde des bisounours | Développement personnel, Spiritualité | [https://christinedeloupy.fr/on-nest-pas-dans-le-monde-des-bisounours/](https://christinedeloupy.fr/on-nest-pas-dans-le-monde-des-bisounours/) |
| 14965 | Je libère… | Développement personnel, Spiritualité | [https://christinedeloupy.fr/je-libere/](https://christinedeloupy.fr/je-libere/) |
| 14953 | Résister à l’abondance | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/resister-a-labondance/](https://christinedeloupy.fr/resister-a-labondance/) |
| 14941 | Voeu karmique de pauvreté | Spiritualité | [https://christinedeloupy.fr/voeu-karmique-de-pauvrete/](https://christinedeloupy.fr/voeu-karmique-de-pauvrete/) |
| 14936 | Es-tu déboussolée? | Développement personnel, Spiritualité | [https://christinedeloupy.fr/es-tu-deboussolee/](https://christinedeloupy.fr/es-tu-deboussolee/) |
| 14923 | Ce n’est pas l’argent le problème | Articles, Développement personnel | [https://christinedeloupy.fr/ce-nest-pas-largent-le-probleme/](https://christinedeloupy.fr/ce-nest-pas-largent-le-probleme/) |
| 14905 | Réécrire ton histoire… | Développement personnel, Spiritualité | [https://christinedeloupy.fr/reecrire-ton-histoire/](https://christinedeloupy.fr/reecrire-ton-histoire/) |
| 14289 | S’abandonner | Développement personnel, Spiritualité | [https://christinedeloupy.fr/sabandonner/](https://christinedeloupy.fr/sabandonner/) |
| 14279 | Formation aux lectures akashiques | Développement personnel, Spiritualité | [https://christinedeloupy.fr/formation-aux-lectures-akashiques/](https://christinedeloupy.fr/formation-aux-lectures-akashiques/) |
| 14275 | L’ABONDANCE, un état d’esprit à cultiver? | Développement personnel, Spiritualité | [https://christinedeloupy.fr/labondance-un-etat-desprit-a-cultiver/](https://christinedeloupy.fr/labondance-un-etat-desprit-a-cultiver/) |
| 14191 | Comment je suis sortie du découragement ? | Articles | [https://christinedeloupy.fr/comment-je-suis-sortie-du-decouragement/](https://christinedeloupy.fr/comment-je-suis-sortie-du-decouragement/) |
| 14145 | Un chemin d’évolution… | Développement personnel, Spiritualité | [https://christinedeloupy.fr/un-chemin-devolution/](https://christinedeloupy.fr/un-chemin-devolution/) |
| 14108 | Changez votre vie et changez le monde! | Développement personnel, Spiritualité | [https://christinedeloupy.fr/changez-votre-vie-et-changez-le-monde/](https://christinedeloupy.fr/changez-votre-vie-et-changez-le-monde/) |
| 14102 | Plonger l’abondance | Spiritualité | [https://christinedeloupy.fr/plonger-labondance/](https://christinedeloupy.fr/plonger-labondance/) |
| 14076 | lES NOMBRES DIVINS | Spiritualité | [https://christinedeloupy.fr/nombresdivins/](https://christinedeloupy.fr/nombresdivins/) |
| 14059 | L’abondance, une vision? | Développement personnel, Spiritualité | [https://christinedeloupy.fr/labondance-une-vision/](https://christinedeloupy.fr/labondance-une-vision/) |
| 14046 | 5 idées pour danser ta vie | Articles, Développement personnel | [https://christinedeloupy.fr/5-idees-pour-danser-ta-vie/](https://christinedeloupy.fr/5-idees-pour-danser-ta-vie/) |
| 14032 | 5 raisons pour lesquelles vous n’avez plus d’énergie | Développement personnel, Spiritualité | [https://christinedeloupy.fr/5-raisons-pour-lesquelles-vous-navez-plus-denergie/](https://christinedeloupy.fr/5-raisons-pour-lesquelles-vous-navez-plus-denergie/) |
| 13770 | Combien de fois…? | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/combien-de-fois/](https://christinedeloupy.fr/combien-de-fois/) |
| 13571 | Expérience Breathwork | Développement personnel, Spiritualité | [https://christinedeloupy.fr/experience-breathwork/](https://christinedeloupy.fr/experience-breathwork/) |
| 13557 | Ne demande pas | Spiritualité | [https://christinedeloupy.fr/amourdesoi-creatrice-estimedesoi-spiritualite-lecturesakashiques-annalesakashiques/](https://christinedeloupy.fr/amourdesoi-creatrice-estimedesoi-spiritualite-lecturesakashiques-annalesakashiques/) |
| 13534 | La respiration des 3 collines | Développement personnel, Spiritualité | [https://christinedeloupy.fr/la-respiration-des-3-collines/](https://christinedeloupy.fr/la-respiration-des-3-collines/) |
| 13481 | Parlons respiration | Développement personnel, Spiritualité | [https://christinedeloupy.fr/parlons-respiration/](https://christinedeloupy.fr/parlons-respiration/) |
| 13374 | J’ai décidé de redécider | Développement personnel | [https://christinedeloupy.fr/jai-decide-de-redecider/](https://christinedeloupy.fr/jai-decide-de-redecider/) |
| 13358 | Le breathwork | Articles, Développement personnel, Spiritualité | [https://christinedeloupy.fr/le-breathwork/](https://christinedeloupy.fr/le-breathwork/) |
| 13162 | Manifestez vos rêves! | Développement personnel | [https://christinedeloupy.fr/manifestez-vos-reves/](https://christinedeloupy.fr/manifestez-vos-reves/) |
| 13055 | Rituel de pleine du 24 Juillet 2021 | Rituel | [https://christinedeloupy.fr/rituel-pleinelune-spiritualite-esoterisme-karmique-vivre-aimer/](https://christinedeloupy.fr/rituel-pleinelune-spiritualite-esoterisme-karmique-vivre-aimer/) |
| 13024 | Nouvelle lune du 10 Juillet 2021 | Rituel | [https://christinedeloupy.fr/nouvelle-lune-du-10-juillet-2021/](https://christinedeloupy.fr/nouvelle-lune-du-10-juillet-2021/) |
| 12973 | Soin de nouvelle lune du mois de Juin 2021 | Rituel | [https://christinedeloupy.fr/soin-de-nouvelle-lune-du-mois-de-juin-2021/](https://christinedeloupy.fr/soin-de-nouvelle-lune-du-mois-de-juin-2021/) |
| 12958 | Mon rituel pour la Pleine du 26 Mai 2021 | Rituel | [https://christinedeloupy.fr/mon-rituel-pour-la-pleine-du-26-mai-2021/](https://christinedeloupy.fr/mon-rituel-pour-la-pleine-du-26-mai-2021/) |
| 12939 | Mes 10 mantras d’amour de soi | Spiritualité | [https://christinedeloupy.fr/mes-10-mantras-damour-de-soi/](https://christinedeloupy.fr/mes-10-mantras-damour-de-soi/) |
| 12935 | Les lectures akashiques | Spiritualité | [https://christinedeloupy.fr/les-lectures-akashiques-lectureakashique-akasha-spiritualite-rituel-feminite/](https://christinedeloupy.fr/les-lectures-akashiques-lectureakashique-akasha-spiritualite-rituel-feminite/) |
| 12909 | Nouvelle lune du 11 Mai 2021 | Spiritualité | [https://christinedeloupy.fr/nouvelle-lune-du-11-mai-2021/](https://christinedeloupy.fr/nouvelle-lune-du-11-mai-2021/) |
| 12804 | Soin collectif de Nouvelle lune du 11 Mai à 20h30 | Articles, Rituel | [https://christinedeloupy.fr/soin-collectif-de-nouvelle-lune-du-11-mai-a-20h30/](https://christinedeloupy.fr/soin-collectif-de-nouvelle-lune-du-11-mai-a-20h30/) |
| 12523 | Le cercle d’éveil | Articles, Spiritualité | [https://christinedeloupy.fr/le-cercle-deveil/](https://christinedeloupy.fr/le-cercle-deveil/) |
| 12513 | Rituel de Nouvelle lune en poisson | Rituel | [https://christinedeloupy.fr/https-christinedeloupy-fr-rituel-nouvellelune/](https://christinedeloupy.fr/https-christinedeloupy-fr-rituel-nouvellelune/) |
| 12475 | L’âme | Articles, Spiritualité | [https://christinedeloupy.fr/spiritualite-ame-spirituel-energie-femininsacre-holistique/](https://christinedeloupy.fr/spiritualite-ame-spirituel-energie-femininsacre-holistique/) |
| 12455 | Et si, et si, et si | Développement personnel | [https://christinedeloupy.fr/et-si-et-si-et-si/](https://christinedeloupy.fr/et-si-et-si-et-si/) |
| 12418 | Quelquefois c’est lourd!!! | Articles, Développement personnel | [https://christinedeloupy.fr/quelquefois-cest-lourd/](https://christinedeloupy.fr/quelquefois-cest-lourd/) |
| 11888 | Un été particulier… | Développement personnel | [https://christinedeloupy.fr/un-ete-particulier/](https://christinedeloupy.fr/un-ete-particulier/) |
| 11873 | Mon rituel Pleine Lune du 3 Août 2020 | Articles, Rituel | [https://christinedeloupy.fr/mon-rituel-pleine-lune-du-3-aout-2020/](https://christinedeloupy.fr/mon-rituel-pleine-lune-du-3-aout-2020/) |
| 11851 | S’ancrer … | Rituel | [https://christinedeloupy.fr/sancrer/](https://christinedeloupy.fr/sancrer/) |
| 11839 | Un joyeux rituel pour Litha | Rituel | [https://christinedeloupy.fr/un-joyeux-rituel-pour-litha/](https://christinedeloupy.fr/un-joyeux-rituel-pour-litha/) |
| 11836 | J’ai confiance… | Spiritualité | [https://christinedeloupy.fr/confiance/](https://christinedeloupy.fr/confiance/) |
| 11833 | Une vie… | Développement personnel, Spiritualité | [https://christinedeloupy.fr/une-vie/](https://christinedeloupy.fr/une-vie/) |
| 11781 | Rituel de la nouvelle lune du 22 Mai 2020 | Rituel | [https://christinedeloupy.fr/rituel-de-la-nouvelle-lune-du-22-mai-2020/](https://christinedeloupy.fr/rituel-de-la-nouvelle-lune-du-22-mai-2020/) |
| 11741 | Au fond de la grotte…Mais | Articles, Spiritualité | [https://christinedeloupy.fr/au-fond-de-la-grotte-mais/](https://christinedeloupy.fr/au-fond-de-la-grotte-mais/) |
| 11716 | Rituel de la Pleine Lune du 7 Mai 2020 | Articles, Rituel | [https://christinedeloupy.fr/rituel-de-la-pleine-lune-du-7-mai-2020/](https://christinedeloupy.fr/rituel-de-la-pleine-lune-du-7-mai-2020/) |
| 11700 | Fêtons Beltane | Rituel | [https://christinedeloupy.fr/fetons-beltane/](https://christinedeloupy.fr/fetons-beltane/) |
| 10302 | J’abandonne… | Articles, Spiritualité | [https://christinedeloupy.fr/jabandonne/](https://christinedeloupy.fr/jabandonne/) |
| 10227 | Je descends de la voiture… | Articles, Développement personnel | [https://christinedeloupy.fr/je-descends-de-la-voiture/](https://christinedeloupy.fr/je-descends-de-la-voiture/) |
| 10111 | Les synchronicités (podcast) | Articles, Spiritualité | [https://christinedeloupy.fr/les-synchronicites-podcast/](https://christinedeloupy.fr/les-synchronicites-podcast/) |
| 10104 | Rituel d’âme à âme… | Rituel | [https://christinedeloupy.fr/rituel-spiritualite/](https://christinedeloupy.fr/rituel-spiritualite/) |
| 10071 | Courir vers son bonheur… | Articles, Développement personnel | [https://christinedeloupy.fr/10071-2/](https://christinedeloupy.fr/10071-2/) |
| 10065 | D’Âme à Âme | Articles, Rituel | [https://christinedeloupy.fr/dame-a-ame/](https://christinedeloupy.fr/dame-a-ame/) |
| 9988 | Respirez, tout va bien! | Articles, Spiritualité | [https://christinedeloupy.fr/respirez-tout-va-bien/](https://christinedeloupy.fr/respirez-tout-va-bien/) |
| 9985 | Nos limites | Articles, Développement personnel | [https://christinedeloupy.fr/nos-limites/](https://christinedeloupy.fr/nos-limites/) |
| 9976 | La peur… | Articles, Développement personnel | [https://christinedeloupy.fr/9976-2/](https://christinedeloupy.fr/9976-2/) |
| 9796 | 5 Clefs pour une mission | Spiritualité, Vidéos | [https://christinedeloupy.fr/5-clefs-pour-une-mission/](https://christinedeloupy.fr/5-clefs-pour-une-mission/) |
| 9782 | Histoire de message | Articles, Spiritualité | [https://christinedeloupy.fr/histoire-de-message/](https://christinedeloupy.fr/histoire-de-message/) |
| 9773 | L’Amour | Articles, Développement personnel | [https://christinedeloupy.fr/lamour/](https://christinedeloupy.fr/lamour/) |
| 9763 | La guidance de l’âme? | Articles | [https://christinedeloupy.fr/la-guidance-de-lame/](https://christinedeloupy.fr/la-guidance-de-lame/) |
| 9686 | Se révéler | Articles, Spiritualité | [https://christinedeloupy.fr/se-reveler/](https://christinedeloupy.fr/se-reveler/) |
| 9684 | Avoir conscience… | Articles, Développement personnel | [https://christinedeloupy.fr/avoir-conscience/](https://christinedeloupy.fr/avoir-conscience/) |
| 9302 | Déployez vos ailes! | Articles, Spiritualité | [https://christinedeloupy.fr/deployez-vos-ailes/](https://christinedeloupy.fr/deployez-vos-ailes/) |
| 9269 | Comment je vis les les lectures akashiques? | Articles, Spiritualité | [https://christinedeloupy.fr/comment-je-vis-les-les-lectures-akashiques/](https://christinedeloupy.fr/comment-je-vis-les-les-lectures-akashiques/) |
| 8572 | Mon corps… c’est l’été!!! | Articles, Développement personnel | [https://christinedeloupy.fr/mon-corps-cest-lete/](https://christinedeloupy.fr/mon-corps-cest-lete/) |
| 8403 | Un temps pour tout | Articles, Développement personnel | [https://christinedeloupy.fr/untemps-2/](https://christinedeloupy.fr/untemps-2/) |
| 7951 | Une veste… | Articles | [https://christinedeloupy.fr/une-veste/](https://christinedeloupy.fr/une-veste/) |
| 7902 | Comme une rivière … | Articles | [https://christinedeloupy.fr/comme-une-riviere/](https://christinedeloupy.fr/comme-une-riviere/) |
| 7762 | Vous êtes une fée | Articles | [https://christinedeloupy.fr/vous-etes-une-fee/](https://christinedeloupy.fr/vous-etes-une-fee/) |
| 7542 | Parler ensemble | Développement personnel | [https://christinedeloupy.fr/parler-ensemble/](https://christinedeloupy.fr/parler-ensemble/) |
| 7539 | Se bouger… | Développement personnel | [https://christinedeloupy.fr/7539-2/](https://christinedeloupy.fr/7539-2/) |
| 7459 | Vivre un accompagnement | Articles | [https://christinedeloupy.fr/vivre-un-accompagnement/](https://christinedeloupy.fr/vivre-un-accompagnement/) |
| 7331 | Tenir le coup | Vidéos | [https://christinedeloupy.fr/tenir-le-coup-2/](https://christinedeloupy.fr/tenir-le-coup-2/) |
| 6849 | Tenir le coup | Vidéos | [https://christinedeloupy.fr/tenir-le-coup/](https://christinedeloupy.fr/tenir-le-coup/) |
| 6846 | Etre une femme épanouie! | Vidéos | [https://christinedeloupy.fr/etre-une-femme-epanouie/](https://christinedeloupy.fr/etre-une-femme-epanouie/) |
| 6843 | Moi, positive? | Vidéos | [https://christinedeloupy.fr/moi-positive/](https://christinedeloupy.fr/moi-positive/) |
| 6840 | La gratitude? que des bienfaits ! | Articles | [https://christinedeloupy.fr/la-gratitude-que-des-bienfaits/](https://christinedeloupy.fr/la-gratitude-que-des-bienfaits/) |
| 6540 | Je ne peux pas… | Articles | [https://christinedeloupy.fr/je-ne-peux-pas/](https://christinedeloupy.fr/je-ne-peux-pas/) |
| 6543 | Brillez de bonheur! | Articles | [https://christinedeloupy.fr/brillez-de-bonheur/](https://christinedeloupy.fr/brillez-de-bonheur/) |
| 6546 | Chut … J’écoute | Articles | [https://christinedeloupy.fr/chut-jecoute/](https://christinedeloupy.fr/chut-jecoute/) |
| 6548 | La méthode Ho’oponopono | Articles | [https://christinedeloupy.fr/la-methode-hooponopono/](https://christinedeloupy.fr/la-methode-hooponopono/) |
| 6538 | Un jour | Articles | [https://christinedeloupy.fr/un-jour/](https://christinedeloupy.fr/un-jour/) |
| 6550 | Nos rêves… | Articles | [https://christinedeloupy.fr/nos-reves/](https://christinedeloupy.fr/nos-reves/) |

## Purchasable products

| ID | Product | URL |
| ---: | --- | --- |
| 16116 | Renaissance Souveraine | [https://christinedeloupy.fr/boutique/accompagnements/renaissance-souveraine-copie/](https://christinedeloupy.fr/boutique/accompagnements/renaissance-souveraine-copie/) |
| 15807 | Lecture Akashique flash Pour y voir clair | [https://christinedeloupy.fr/boutique/accompagnements/lecture-akashique-flash-pour-y-voir-clair/](https://christinedeloupy.fr/boutique/accompagnements/lecture-akashique-flash-pour-y-voir-clair/) |
| 15030 | Formation Akashique en présentiel | [https://christinedeloupy.fr/boutique/accompagnements/transmission-akashique/](https://christinedeloupy.fr/boutique/accompagnements/transmission-akashique/) |
| 10977 | Bracelet d’intention | [https://christinedeloupy.fr/boutique/bijoux/bijoux-magik-intentions/bracelet-dintention/](https://christinedeloupy.fr/boutique/bijoux/bijoux-magik-intentions/bracelet-dintention/) |
| 10976 | Bracelet Chemin de vie | [https://christinedeloupy.fr/boutique/bijoux/bijoux-chemin-de-vie/bracelet-chemin-de-vie/](https://christinedeloupy.fr/boutique/bijoux/bijoux-chemin-de-vie/bracelet-chemin-de-vie/) |
| 8495 | Lecture akashique | [https://christinedeloupy.fr/boutique/accompagnements/lectures-des-annales-akashiques/](https://christinedeloupy.fr/boutique/accompagnements/lectures-des-annales-akashiques/) |
| 7663 | Ma Capsule Anti Stress | [https://christinedeloupy.fr/boutique/ateliers/capsule-anti-stress/](https://christinedeloupy.fr/boutique/ateliers/capsule-anti-stress/) |

## Archive routes

### Article categories

- [Articles](https://christinedeloupy.fr/categorie/articles/)
- [Développement personnel](https://christinedeloupy.fr/categorie/developpement-personnel/)
- [Rituel](https://christinedeloupy.fr/categorie/rituel/)
- [Spiritualité](https://christinedeloupy.fr/categorie/spiritualite/)
- [Vidéos](https://christinedeloupy.fr/categorie/videos/)

### Product categories

- [Accompagnements](https://christinedeloupy.fr/categorie-produit/accompagnements/)
- [Ateliers](https://christinedeloupy.fr/categorie-produit/ateliers/)
- [Bijoux](https://christinedeloupy.fr/categorie-produit/bijoux/)
- [Bracelets chemin de vie](https://christinedeloupy.fr/categorie-produit/bijoux/bijoux-chemin-de-vie/)
- [Boutique](https://christinedeloupy.fr/categorie-produit/boutique/)
- [Bijoux Magik intentions](https://christinedeloupy.fr/categorie-produit/bijoux/bijoux-magik-intentions/)

### Author archive

- [Christine](https://christinedeloupy.fr/author/christine/)

## Taxonomy and route-set discrepancies

- The public pages endpoint returns 59 published page records, while the Yoast page sitemap lists 58 URLs.
- The WooCommerce Store API returns 7 purchasable product permalinks, while the Yoast product sitemap lists 8 URLs.
- Published page records absent from the page sitemap: [https://christinedeloupy.fr/std-boutique/](https://christinedeloupy.fr/std-boutique/).
- Product sitemap URLs absent from the Store API product list: [https://christinedeloupy.fr/std-boutique/](https://christinedeloupy.fr/std-boutique/).
- Resolve these differences explicitly when defining route coverage, indexability, redirects, and canonicals; do not drop them by relying on the sitemap alone.

## Functional route families to preserve

- Editorial: article detail routes, five post-category archives, blog and video archives, podcast pages, pagination, and media embeds.
- Services and lead capture: accompaniment/service pages, workshops, ebook delivery, newsletter signup, contact, and confirmation pages.
- Commerce: shop and product-category routes, seven purchasable products, cart, checkout, payment confirmation/failure, and order results.
- Customer and subscription account: account/profile, invoices, billing details, subscription management, cancellation, and payment routes.
- Learning and membership: courses and instructor pages, plus any authenticated or third-party flows embedded in those pages.
- Legal: privacy policy, legal notices, terms and conditions of sale, and any related customer-facing notices.

A public route inventory does not establish the behavior of authenticated, query-parameter, preview, cart-session, or third-party routes. Those require authenticated access and an end-to-end behavior audit before replacing WordPress.

## Form families to audit

These public route families indicate where forms and submissions must be inspected. This is not yet a verified plugin-to-form mapping; confirm the actual handler, fields, consent text, spam controls, notifications, and success/error behavior for each one before implementation.

- Contact: `/contact/`.
- Newsletter subscription: `/newsletter/`.
- Workshop and program registration: `/inscription-atelier-ralentir-pour-mieux-se-retrouver/`, `/inscription-racines-et-lumieres/` and related campaign pages.
- Lead capture and ebook delivery: `/recois-ton-cadeau/`, `/ebook-ma-journee-positive/`, `/ebook-augmenter-mon-taux-vibratoire/` and related landing pages.
- Commerce checkout: billing/shipping details, order confirmation, payment result, and any product-specific fields handled by WooCommerce extensions.
- Appointment, course, and membership flows: inspect the relevant service and course routes for booking, application, login, and access forms.

Render each public form in Eleventy for consistent styling. Submit to the current WordPress plugin/provider through a supported API or a purpose-built protected WordPress endpoint. Do not copy an admin API secret into browser code. Checkout fields and payment submission use the WooCommerce integration, separate from general-purpose contact/newsletter forms.
