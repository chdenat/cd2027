# Installation et déploiement du site CD2027

Ce guide concerne uniquement `https://cd2027.christinedeloupy.fr`. Il n'y a qu'un hébergement distant : le compte SSH fourni par Nuxit. Aucun accès `sudo`, serveur Linux séparé ou service Bun n'est nécessaire.

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
| `CD2027_REMOTE_ROOT` | Chemin absolu du dossier de déploiement Nuxit, parent de `incoming`, `releases` et `current` |
| `PRIVATE_VIEW` | `true` pendant la validation privée ; `false` rend le site public |

Les identifiants SSH restent enregistrés dans les secrets GitHub. Le workflow installe `sshpass` sur son runner GitHub temporaire ; cette commande ne s'exécute pas sur Nuxit. Il accepte automatiquement la clé présentée par l'hôte SSH, sans demander de variable `known_hosts`.

Ne colle aucun secret dans le dépôt, une variable GitHub non secrète, le code du site ou `_site/`.

## 3. Lancer et vérifier un premier déploiement

Dans **Actions**, ouvre **Deploy cd2027.christinedeloupy.fr**, sélectionne `main`, puis clique **Run workflow**. GitHub installe les dépendances, construit toutes les routes, exécute le contrôle, transfère `_site/` par SSH/SCP, extrait la nouvelle version dans `releases/` et bascule `current`.

Vérifie l'exécution dans les journaux GitHub Actions, puis ouvre `https://cd2027.christinedeloupy.fr` et plusieurs familles de pages : boutique, fiche produit, archives de blog, catégories, page et article. Si le build ou le transfert échoue, le lien `current` garde la version précédente.

Le workflow peut aussi être lancé depuis un poste avec GitHub CLI et une session autorisée : `bash scripts/deploy-cd2027.sh`. Il déploie le dernier commit de `main`, pas les changements locaux non commités. Une reconstruction complète est également planifiée chaque jour à 06:17 UTC.

## 4. Relier WordPress au workflow par le MU-plugin PHP

Copie [`wordpress/mu-plugins/cd2027-eleventy-webhook.php`](../wordpress/mu-plugins/cd2027-eleventy-webhook.php) dans `wp-content/mu-plugins/` sur l'installation WordPress qui alimente le site. Crée le dossier si nécessaire. WordPress charge automatiquement les extensions *must-use*.

Crée un jeton GitHub finement limité au dépôt du site : **Settings → Developer settings → Personal access tokens → Fine-grained tokens**. Choisis uniquement ce dépôt, fixe une expiration et accorde `Contents: Read and write`, permission requise par l'API GitHub `repository_dispatch` ([documentation GitHub](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)). Le jeton sert uniquement à demander un build ; les identifiants SSH restent dans l'environnement GitHub.

Dans `wp-config.php`, avant la ligne qui charge `wp-settings.php`, ajoute les deux constantes ci-dessous en remplaçant les exemples. `owner/repository` est le propriétaire et le nom du dépôt GitHub, sans `.git` :

```php
define('CD2027_GITHUB_DISPATCH_TOKEN', 'COLLER_LE_JETON_GITHUB_ICI');
define('CD2027_GITHUB_REPOSITORY', 'owner/repository');
```

Garde le jeton dans `wp-config.php`, jamais dans le MU-plugin, le dépôt ou un fichier servi publiquement. La file des modifications est conservée dans la base WordPress. Le MU-plugin ignore les brouillons non publiés et planifie l'envoi après une modification publique. Il regroupe jusqu'à 100 notifications par demande GitHub ; GitHub reconstruit ensuite le site complet.

## 5. Faire exécuter WP-Cron régulièrement chez Nuxit

WordPress déclenche normalement WP-Cron lors des visites. Pour que la file parte aussi quand le site reçoit peu de visites, utilise la fonction **Cron**, **Tâches planifiées** ou **Webcron** du panneau Nuxit. Elle doit appeler l'URL de cron WordPress toutes les cinq minutes :

```text
https://christinedeloupy.fr/wp-cron.php?doing_wp_cron
```

Si WordPress est installé à une autre adresse, utilise l'URL de son `wp-cron.php`. Dans le panneau, choisis une fréquence de cinq minutes et, si Nuxit demande une commande, utilise la commande HTTP documentée par son interface (souvent `wget` ou `curl`) pour appeler cette URL. Cela ne demande pas `sudo` : la tâche est créée dans le panneau de l'hébergement.

Si `DISABLE_WP_CRON` est déjà défini à `true` dans `wp-config.php`, garde-le ainsi et configure cette tâche Nuxit ; sinon, enlève cette constante pour laisser les visites déclencher WP-Cron en complément. Ne programme pas l'URL du frontend CD2027 à la place de celle de WordPress si WordPress reste sur `christinedeloupy.fr`.

Le cron Nuxit ne lance pas le build : il réveille WordPress, qui traite son événement planifié et demande à GitHub de démarrer le build. GitHub exécute le build et se connecte ensuite à Nuxit par SSH.

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
