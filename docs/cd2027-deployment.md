<!--
 * This file is part of the CD2027 project.
 *
 * File: docs/cd2027-deployment.md
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-06
 *
 * Copyright © 2026 Christian Denat
-->

# Installation et déploiement du site CD2027

Ce guide configure le staging `https://cd2027.christinedeloupy.fr`. La cible de production `https://christinedeloupy.fr` dispose maintenant d'un workflow isolé, mais reste verrouillée jusqu'à la configuration de son environnement GitHub et de son routage web ; voir le [guide WP Awesome et des environnements](wordpress-connector-and-environments.md).

## Fonctionnement

```text
WordPress (publication)
  → MU-plugin PHP : file persistante en base WordPress
  → WP-Cron, réveillé par le cron planifié de l'hébergement
  → API GitHub repository_dispatch
  → GitHub Actions : build Eleventy et contrôle des routes
  → SSH/SCP avec login et mot de passe vers Nuxit
  → releases/<id>, puis bascule du lien current
```

Le webhook PHP envoie seulement une notification. GitHub reconstruit le site à partir des données publiques actuelles de WordPress. Une publication ne change pas directement les fichiers du site ; `current` ne bascule qu'après un build, un contrôle et un transfert réussis. Le workflow quotidien et le lancement manuel servent de rattrapage.

## 1. Préparer le site CD2027 chez Nuxit

Dans le panneau Nuxit, configure le sous-domaine `cd2027.christinedeloupy.fr`, son HTTPS et son dossier web. Crée ou utilise le compte SSH avec mot de passe communiqué par Nuxit. Son dossier de déploiement doit lui appartenir et être accessible en écriture.

Le workflow a besoin d'un chemin absolu pour y créer cette structure :

```text
<racine-deploiement>/
  incoming/
  releases/<identifiant-du-build>/
  current -> releases/<identifiant-du-build>
```

Le document root du sous-domaine doit servir le contenu de `current`. Note le chemin absolu exact du dossier (sans `current` à la fin) : il sera utilisé comme `CD2027_REMOTE_ROOT` dans GitHub. Le compte SSH doit pouvoir utiliser `mkdir`, `tar`, les liens symboliques et le remplacement atomique avec `mv -T`. Il n'a pas besoin de privilèges administrateur. Si le panneau Nuxit ne permet pas de faire pointer le document root sur `current`, demande à Nuxit si les liens symboliques sont autorisés pour ce compte et ce sous-domaine avant le premier déploiement.

Le site CD2027 ne doit pas être indexé ni accessible au public pendant sa validation. `robots.txt` ne constitue pas une protection d'accès. Le build peut activer la passerelle de connexion WordPress décrite ci-dessous ; elle nécessite PHP sur l'hébergement et l'accès PHP au dossier WordPress. À défaut, active la protection de répertoire proposée dans le panneau Nuxit.

Avec `PRIVATE_VIEW=true` (valeur par défaut), le workflow ajoute une règle Apache `.htaccess` et la passerelle `cd2027-gate.php`. Le formulaire permet une connexion avec un compte administrateur WordPress. Avant le déploiement, crée dans le dossier `CD2027_REMOTE_ROOT`, à côté de `current` et `releases`, le fichier `cd2027-auth-config.php` avec le chemin absolu de WordPress :

```php
<?php
return [
    'wordpress_path' => '/home/COMPTE/public_html',
    'staging_origin' => 'https://cd2027.christinedeloupy.fr',
];
```

Utilise le gestionnaire de fichiers Nuxit ou SFTP/SSH pour créer ce fichier, et limite ses droits d'accès. Ne le place pas dans `current`, le dossier public, `_site/` ou Git. L'hébergement doit autoriser PHP et `.htaccess`/`mod_rewrite`; WordPress doit être lisible par PHP depuis le site CD2027. Si une de ces conditions n'est pas remplie, choisis la protection de répertoire du panneau Nuxit et mets `PRIVATE_VIEW` à `false` pour ne pas activer la passerelle WordPress.

## 2. Configurer GitHub

Dans le dépôt, ouvre **Settings → Environments** et crée l'environnement `cd2027`.

Ajoute les *secrets* suivants à cet environnement :

| Secret | Valeur |
| --- | --- |
| `CD2027_SSH_HOST` | Nom d'hôte SSH fourni par Nuxit (pas l'URL `https://...`) |
| `CD2027_SSH_USER` | Login du compte SSH |
| `CD2027_SSH_PASSWORD` | Mot de passe SSH de ce compte |
| `CD2027_SSH_PORT` | Port fourni par Nuxit, généralement `22` |
| `FONTAWESOME_PACKAGE_TOKEN` | Jeton de lecture du paquet Font Awesome Pro utilisé par le build |

Ajoute ces variables d'environnement :

| Variable | Valeur |
| --- | --- |
| `SITE_URL` | `https://cd2027.christinedeloupy.fr` |
| `WORDPRESS_ORIGIN` | `https://christinedeloupy.fr` tant que CD2020 reste la source WordPress |
| `CD2027_REMOTE_ROOT` | Chemin absolu du dossier de déploiement Nuxit, parent de `incoming`, `releases` et `current` |
| `PRIVATE_VIEW` | `true` pendant la validation privée ; `false` rend le site public |

Les identifiants SSH restent enregistrés dans les secrets GitHub. Le workflow installe `sshpass` sur son runner GitHub temporaire ; cette commande ne s'exécute pas sur Nuxit. Il accepte automatiquement la clé présentée par l'hôte SSH, sans demander de variable `known_hosts`.

Ne colle aucun secret dans le dépôt, une variable GitHub non secrète, le code du site ou `_site/`.

## 3. Lancer et vérifier un premier déploiement

Le workflow `.github/workflows/deploy-cd2027.yml` doit d’abord être présent sur la branche par défaut `main` de GitHub. Tant qu’il ne l’est pas, GitHub ne peut pas proposer le bouton **Run workflow**. Les lancements manuels nécessitent aussi `workflow_dispatch` dans le fichier et un accès en écriture au dépôt ([conditions GitHub](https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow)).

Ouvre directement [la page Actions du dépôt](https://github.com/chdenat/cd2027/actions) si l’onglet est masqué dans le menu **More**. Quand le workflow CD2027 est publié sur `main`, sélectionne **Deploy cd2027.christinedeloupy.fr**, puis **Run workflow**.

Sans l’interface Actions, connecte-toi avec GitHub CLI puis lance le workflow depuis la racine du dépôt :

```bash
gh auth login
bash scripts/deploy-cd2027.sh
```

Cette commande déclenche le workflow GitHub ; elle ne construit pas les changements locaux non commités. Le workflow reconstruit le dernier commit de `main`. Pour consulter les exécutions et leurs journaux sans l’interface, utilise :

```bash
gh run list --repo chdenat/cd2027 --workflow deploy-cd2027.yml --limit 5
gh run view IDENTIFIANT_DE_L_EXECUTION --repo chdenat/cd2027 --log
```

Vérifie l’exécution, puis ouvre `https://cd2027.christinedeloupy.fr` et plusieurs familles de pages : boutique, fiche produit, archives de blog, catégories, page et article. Si le build ou le transfert échoue, le lien `current` garde la version précédente.

Une reconstruction complète est également planifiée chaque jour à 06:17 UTC.

## 4. Relier WordPress au workflow par le MU-plugin PHP

Le WordPress source (le site CD2020) est actuellement servi à `https://christinedeloupy.fr`. Le frontend construit par ce dépôt est le staging `https://cd2027.christinedeloupy.fr` : le MU-plugin s’installe dans WordPress, pas dans le dossier de déploiement statique CD2027. Le fichier source est [`wordpress/mu-plugins/cd2027-eleventy-webhook.php`](../wordpress/mu-plugins/cd2027-eleventy-webhook.php).

Depuis la racine locale du dépôt `cd2027`, crée le dossier distant puis copie le plugin. Remplace `SSH_USER`, `SSH_HOST`, `SSH_PORT` et `WP_ROOT` par les paramètres Nuxit et le chemin absolu de WordPress sur CD2020. `WP_ROOT` doit être le dossier qui contient `wp-config.php`; ne mets pas ici `CD2027_REMOTE_ROOT`, qui désigne le frontend statique.

```bash
SSH_USER='LOGIN_SSH_NUXIT'
SSH_HOST='HOTE_SSH_NUXIT'
SSH_PORT='22'
WP_ROOT='/home/COMPTE/public_html'

ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" \
  "mkdir -p '$WP_ROOT/wp-content/mu-plugins'" &&
scp -P "$SSH_PORT" \
  wordpress/mu-plugins/cd2027-eleventy-webhook.php \
  "$SSH_USER@$SSH_HOST:$WP_ROOT/wp-content/mu-plugins/"
```

La commande demande l’authentification SSH si ta clé n’est pas déjà configurée.

Le transfert remplace le fichier `cd2027-eleventy-webhook.php` s'il existe déjà. Vérifie éventuellement la syntaxe sur l'hébergement si PHP CLI y est disponible :

```bash
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" \
  "php -l '$WP_ROOT/wp-content/mu-plugins/cd2027-eleventy-webhook.php'"
```

WordPress charge automatiquement le MU-plugin. Cette procédure conserve le publisher historique. Le plugin autonome **WP Awesome** est une autre option de publication : suis la migration décrite dans le [guide des environnements](wordpress-connector-and-environments.md) et ne laisse pas les deux expéditeurs actifs.

Crée ensuite un jeton GitHub finement limité depuis **Settings → Developer settings → Fine-grained personal access tokens → Generate new token** ([guide GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)) :

- Resource owner : `chdenat` ;
- Repository access : *Only select repositories* → `cd2027` ;
- Repository permissions : **Contents → Read and write** ;
- choisis une expiration et copie le jeton à sa création.

GitHub conserve **Metadata → Read-only** comme permission requise par défaut. L’API `repository_dispatch` exige **Contents → write** ([documentation GitHub](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)). Le tableau de bord optionnel a aussi besoin de **Actions → Read** pour lire les workflows d'un dépôt privé ; les exécutions d'un dépôt public peuvent être consultées sans authentification ([API des exécutions GitHub Actions](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow)). **Actions → Write** n'est pas nécessaire. Garde le jeton côté serveur ; il sert seulement à demander un build et à lire les statuts. Les identifiants SSH du déploiement statique restent dans l'environnement GitHub Actions.

Dans le `wp-config.php` de WordPress CD2020, avant la ligne qui charge `wp-settings.php`, ajoute ces constantes :

```php
define('CD2027_GITHUB_DISPATCH_TOKEN', 'COLLER_LE_JETON_GITHUB_ICI');
define('CD2027_GITHUB_REPOSITORY', 'chdenat/cd2027');
```

Ne mets pas le jeton dans le MU-plugin, le dépôt, une variable GitHub non secrète ou un fichier publiquement servi. La file est conservée dans la base WordPress. Le MU-plugin ignore les brouillons non publiés, regroupe jusqu’à 100 notifications et les envoie à GitHub ; le workflow reconstruit ensuite le site complet.

Pour obtenir la page **Outils → WP Awesome**, migre vers le plugin PHP distribué dans le package après avoir vidé et sauvegardé la file historique puis retiré le MU-plugin : copie tous les fichiers PHP de `node_modules/wp-awesome/wordpress-plugin/` dans `wp-content/plugins/wp-awesome/`, puis active **WP Awesome** dans **Extensions**. Configure le token et le dépôt avec `WPEC_CONNECTOR_GITHUB_TOKEN` et `WPEC_CONNECTOR_REPOSITORY`, puis les cibles staging et production avec `WPEC_CONNECTOR_TARGETS` dans `wp-config.php`, selon le [guide des environnements](wordpress-connector-and-environments.md). La cible production reste désactivée tant que son environnement et son dossier de publication ne sont pas prêts.

## 5. Faire exécuter WP-Cron régulièrement chez Nuxit

Dans le panneau Nuxit, ouvre **Hébergements web → Gérer l’hébergement → Base de données & PHP → Tâches Cron → Ajouter un Webcron**. Nuxit demande une URL et les champs de planification ([guide Webcron Nuxit](https://assistance.nuxit.com/knowledge-base/creer-un-webcron/)). Pour le WordPress source CD2020, renseigne :

```text
https://christinedeloupy.fr/wp-cron.php?doing_wp_cron
```

Fréquence : **toutes les 5 minutes**. Si le panneau affiche les champs séparément, mets `*/5` pour les minutes et `*` pour l’heure, le jour du mois, le mois et le jour de la semaine. En syntaxe cron standard, cela correspond à :

```text
*/5 * * * *
```

Le Webcron Nuxit attend l’URL ci-dessus, pas une commande shell. N’utilise pas l’URL du frontend CD2027. Si `DISABLE_WP_CRON` est déjà défini à `true` dans `wp-config.php`, garde-le : le Webcron Nuxit déclenchera WP-Cron. S’il est absent ou faux, les visites continueront aussi à déclencher WP-Cron.

Ce cron ne lance pas directement le build : il réveille WordPress, qui traite la file et appelle GitHub. Le `17 6 * * *` du workflow GitHub est un rattrapage quotidien distinct, à 06:17 UTC ; ne le remplace pas par celui de Nuxit.

## 6. Tester toute la chaîne

1. Dans WordPress, modifie puis enregistre une page déjà publiée (un brouillon ne déclenche pas de publication publique).
2. Vérifie **Actions** dans GitHub : le workflow `Deploy cd2027.christinedeloupy.fr` doit démarrer après le passage WP-Cron.
3. Vérifie que le build et le contrôle de routes réussissent, puis que l'étape SSH indique l'activation de `current`.
4. Vérifie la modification sur `https://cd2027.christinedeloupy.fr`.
5. Lance aussi **Run workflow** à la main pour confirmer le chemin manuel.

Une réponse réussie de GitHub à `repository_dispatch` signifie que GitHub a accepté la demande. Seule la réussite du workflow puis la vérification du site confirment le déploiement.

## Dépannage

- **Le workflow manuel échoue avant le build** : vérifie le secret `FONTAWESOME_PACKAGE_TOKEN` et les autorisations GitHub Actions.
- **Échec de résolution ou connexion SSH** : vérifie `CD2027_SSH_HOST`, `CD2027_SSH_PORT`, le login, le mot de passe et l'accès SSH activé chez Nuxit. L'hôte est le nom SSH donné par Nuxit, pas le domaine avec `https://`.
- **Permission refusée ou commande distante absente** : vérifie que `CD2027_REMOTE_ROOT` est le bon chemin et que le compte peut écrire, extraire avec `tar`, créer des liens symboliques et remplacer le lien `current`.
- **Le webhook PHP ne démarre aucun workflow** : vérifie les deux constantes dans `wp-config.php`, l'accès HTTPS sortant de l'hébergement, la permission `Contents: write` du jeton et le passage de WP-Cron. Les événements en attente sont retentés par WP-Cron.
- **Le workflow démarre mais les contenus sont anciens** : vérifie que le build lit la bonne installation WordPress et consulte le résultat de la synchronisation WordPress dans les journaux de build.

Le déploiement automatique actuel ne concerne que `cd2027.christinedeloupy.fr`. Il n'y a pas de déploiement de production configuré ici.
