# Guide utilisateur — site de test et hook WordPress

Ce guide explique comment relier WordPress, le récepteur du hook, GitHub Actions et le site de test `https://cd2027.christinedeloupy.fr`.

Le code nécessaire est présent dans ce dépôt : l’expéditeur WordPress, le récepteur Bun, le worker GitHub et le workflow de déploiement. Les comptes et services externes (DNS, hébergement du site de test, serveur du hook, secrets GitHub et WordPress) doivent encore être configurés par leur administrateur. Le workflow ne déploie que sur le site de test, jamais sur le site de production.

## Comment les pièces communiquent

```text
Enregistrement public dans WordPress
  → MU-plugin WordPress et WP-Cron
  → requête signée en HTTPS
  → récepteur Bun et file durable
  → worker planifié sur le serveur du hook
  → GitHub Actions (repository_dispatch)
  → récupération des données publiques WordPress
  → build Eleventy et contrôle des routes
  → transfert SSH et activation du site de test
```

Le hook signale qu’un contenu a changé. GitHub récupère ensuite l’état public actuel dans WordPress et reconstruit le site complet. Une réponse `202` du récepteur veut dire que l’événement est enregistré dans la file ; elle ne confirme pas encore le déploiement.

Le site de développement local est séparé : `npm run dev` sert `http://localhost:4555` et ne consomme pas les événements WordPress.

## 1. Préparer l’hébergement du site de test

Dans le panneau DNS et le panneau d’hébergement :

1. Créez le sous-domaine `cd2027.christinedeloupy.fr` et faites pointer son enregistrement DNS `A`/`AAAA` ou `CNAME` vers l’hébergement prévu.
2. Créez le virtual host du sous-domaine et activez HTTPS avec un certificat valide.
3. Créez un compte SSH avec authentification par mot de passe et un répertoire de déploiement qui lui est accessible en écriture. Le script actuel utilise SSH/SCP avec mot de passe.
4. Vérifiez que l’hébergement permet au document root du virtual host de pointer vers un lien symbolique `current`, et que le compte peut utiliser `tar` et GNU `mv -T`. Les versions de chaque build sont déposées dans `releases/`, puis le lien `current` est remplacé à la fin du transfert. Le chemin doit être absolu, sans espaces, et hors du répertoire du hook.

La valeur exacte du répertoire dépend de l’hébergeur, par exemple `/home/compte/sites/cd2026-test`. Le document root du virtual host devra servir `/home/compte/sites/cd2026-test/current`. Si l’hébergeur interdit cette configuration ou `mv -T`, le script `scripts/upload-staging.sh` doit être adapté à son mécanisme de déploiement avant le premier transfert.

**Protégez le site de test avant de le rendre accessible.** Le `robots.txt` actuel autorise l’exploration ; le fichier `robots.txt` seul ne protège ni les contenus ni l’URL contre le public. Le workflow CD2027 inclut maintenant une passerelle PHP qui réserve toutes les pages et tous les fichiers aux administrateurs WordPress.

### Connexion WordPress des administrateurs

Le build de staging active `CD2027_WP_AUTH=1` et lit la variable GitHub Actions `PRIVATE_VIEW` (valeur par défaut : `true`). Avec `true`, toutes les pages et ressources du site demandent une connexion administrateur WordPress. Avec `false`, le site est public et la passerelle sert les fichiers sans charger WordPress. Eleventy génère le réglage dans `cd2027-gate.php` afin qu’il soit appliqué sur l’hébergement. Apache doit autoriser les fichiers `.htaccess`, `mod_rewrite` et PHP 8 ou ultérieur. Sur Nginx, configurez les mêmes règles de réécriture dans le virtual host : Nginx ignore `.htaccess`.

En mode privé, le visiteur voit un bouton icône de connexion en haut à droite ; il ouvre la fenêtre `<wa-dialog>` avec le formulaire. La passerelle authentifie les identifiants avec `wp_signon()` et vérifie `user_can(..., 'manage_options')`. Après connexion, elle sert le fichier statique demandé et l’en-tête affiche l’icône de déconnexion. Le cookie est créé sur CD2027 par WordPress et reste limité à ce sous-domaine ; aucun cookie n’est partagé globalement avec les autres sous-domaines. Le mot de passe n’est ni enregistré ni ajouté au build. La déconnexion invalide cette session.

Avant le premier déploiement privé (`PRIVATE_VIEW=true`) :

1. Vérifiez que WordPress et CD2027 utilisent HTTPS, que PHP peut lire le répertoire WordPress et son `wp-load.php`, et que WordPress ne force pas un `COOKIE_DOMAIN` partagé avec tous les sous-domaines. Si l’hébergement utilise `open_basedir`, ajoutez le dossier WordPress aux chemins lisibles par PHP. La passerelle appelle l’authentification WordPress depuis le domaine CD2027 ; aucun changement de `wp-config.php` ni plugin WordPress supplémentaire n’est requis.

2. Créez le fichier `cd2027-auth-config.php` dans `STAGING_REMOTE_ROOT`, à côté de `current` et de `releases` (donc hors du document root public). Remplacez le chemin d’exemple par le chemin absolu du dossier WordPress :

   ```php
   <?php
   return [
       'wordpress_path' => '/home/COMPTE/public_html',
       'staging_origin' => 'https://cd2027.christinedeloupy.fr',
   ];
   ```

   Rendez ce fichier lisible par PHP et non modifiable par les visiteurs, par exemple avec des permissions `640` et un propriétaire/groupe adaptés. Ne le placez jamais dans `current`, `_site` ou le dépôt Git.

3. Lancez le workflow **Deploy cd2027.christinedeloupy.fr**. Depuis une fenêtre privée, vérifiez que `/` et une page profonde affichent le bouton de connexion, puis ouvrez le formulaire. Après connexion administrateur, les pages et `/assets/styles.css` doivent répondre normalement. Un compte WordPress sans droit `manage_options` doit rester bloqué. Testez enfin l’icône de déconnexion et vérifiez que CD2027 redemande les identifiants. Pour rendre le site public, modifiez `PRIVATE_VIEW` à `false` dans **Settings → Environments → test → Environment variables**, puis relancez le workflow.

La passerelle vérifie aussi les ressources CSS, JavaScript et images servies par CD2027. Seuls les modules Web Awesome, les polices, le thème CSS et la feuille CSS du formulaire de connexion sont accessibles avant authentification afin d’afficher ce formulaire ; les pages et leurs autres ressources restent privées. Les médias hébergés directement sur `christinedeloupy.fr` restent servis par WordPress avec leurs règles actuelles. `wp_signon()` utilise les filtres d’authentification WordPress. Si un plugin impose une étape de connexion personnalisée (par exemple une validation à deux facteurs), testez-la : cette étape peut demander une adaptation du formulaire de staging.

### Protection par mot de passe HTTP

Si la passerelle WordPress n’est pas disponible sur l’hébergement, utilisez plutôt la protection HTTP au niveau de l’hébergement avec un identifiant de staging distinct. Cette méthode est une solution de remplacement ; elle ne crée pas de session WordPress.

Configurez la protection dans le panneau d’hébergement au niveau du virtual host de `cd2027.christinedeloupy.fr`, ou dans sa configuration Apache/Nginx. Le domaine doit déjà répondre en HTTPS. Le document root passe par le lien `current`, qui change à chaque déploiement : une règle de serveur reste en place, tandis qu’un fichier ajouté manuellement à une ancienne version peut disparaître au déploiement suivant.

Sur un hébergement mutualisé, cherchez une fonction nommée **Directory Privacy**, **Protection des répertoires** ou **Password-protect directories**. Sélectionnez le site `cd2027.christinedeloupy.fr` et appliquez la protection à toute sa racine. Vérifiez auprès de l’hébergeur que cette règle reste active quand le lien `current` pointe vers une nouvelle version.

Sur un serveur Apache administré, créez une base d’utilisateurs hors du site publié. Sur Debian/Ubuntu, `htpasswd` est fourni par `apache2-utils` :

```sh
sudo apt install apache2-utils
sudo htpasswd -c /etc/apache2/cd2027-users.htpasswd christine
sudo chmod 640 /etc/apache2/cd2027-users.htpasswd
sudo chown root:www-data /etc/apache2/cd2027-users.htpasswd
```

La commande demande le mot de passe sans l’inscrire dans l’historique du terminal. N’utilisez `-c` qu’à la création du fichier ; pour ajouter un utilisateur ensuite, relancez `htpasswd` sans `-c`. `www-data` est le groupe habituel sur Debian/Ubuntu : vérifiez le groupe du processus web sur votre serveur avant d’appliquer `chown`. Le fichier reste hors du document root. Dans le virtual host HTTPS de `cd2027.christinedeloupy.fr`, ajoutez :

```apache
<Location "/">
    AuthType Basic
    AuthName "CD2027 — site de test"
    AuthBasicProvider file
    AuthUserFile /etc/apache2/cd2027-users.htpasswd
    Require valid-user
</Location>
```

Vérifiez la configuration Apache, puis rechargez le service. Apache documente les directives `AuthType`, `AuthUserFile` et `Require valid-user` dans son [guide officiel d’authentification](https://httpd.apache.org/docs/2.4/howto/auth.html).

Sur Nginx, créez également un fichier de mots de passe hors du document root avec `htpasswd` (sur Debian/Ubuntu, installez `apache2-utils` si nécessaire), donnez-lui un groupe lisible par le worker Nginx, puis ajoutez ces directives au bloc `server` HTTPS déjà utilisé pour le domaine :

```nginx
auth_basic "CD2027 — site de test";
auth_basic_user_file /etc/nginx/cd2027-users.htpasswd;
```

Vérifiez avec `sudo nginx -t`, puis rechargez Nginx. Le processus Nginx doit pouvoir lire le fichier de mots de passe. Ces directives sont documentées dans le [manuel officiel Nginx](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html).

Testez depuis une fenêtre privée : `curl -I https://cd2027.christinedeloupy.fr/` doit renvoyer `401` avant authentification. `curl -I -u christine https://cd2027.christinedeloupy.fr/` demande le mot de passe et doit ensuite renvoyer une réponse autorisée. Comme le site est en HTTPS, les identifiants Basic Auth sont protégés pendant leur transport.

## 2. Configurer le dépôt GitHub

Le workflow utilise la branche `main`. Assurez-vous que le code est poussé sur cette branche et que GitHub Actions est autorisé pour le dépôt. L’environnement GitHub Actions reste nommé `test` : seul le nom de domaine change. Si l’hébergement SSH reste le même, ses identifiants peuvent rester inchangés ; mettez à jour `STAGING_REMOTE_ROOT` pour le répertoire du nouveau virtual host.

Dans **Settings → Environments**, créez un environnement nommé exactement `test`. Dans cet environnement, ajoutez ces *secrets* :

| Secret | Valeur |
| --- | --- |
| `STAGING_SSH_HOST` | Nom d’hôte SSH de l’hébergement de test |
| `STAGING_SSH_USER` | Nom du compte SSH dédié au transfert |
| `STAGING_SSH_PASSWORD` | Mot de passe de ce compte SSH |
| `STAGING_SSH_KNOWN_HOSTS` | Ligne(s) de clé d’hôte SSH vérifiée(s) |
| `STAGING_SSH_PORT` | Port SSH, généralement `22` ; facultatif si le port est `22` |

Ajoutez à **Environment variables** la variable `STAGING_REMOTE_ROOT`, avec le chemin absolu du répertoire de déploiement préparé à l’étape précédente. Cette variable désigne le répertoire parent qui contiendra `incoming/`, `releases/` et le lien `current`. Ajoutez aussi `PRIVATE_VIEW` avec la valeur `true` ; passez-la à `false` pour publier le site sans authentification.

Pour obtenir la clé d’hôte, demandez l’empreinte à l’hébergeur et comparez-la à celle observée depuis un terminal de confiance. `ssh-keyscan -p PORT HOTE` peut récupérer la ligne de clé et `ssh-keygen -lf fichier` en afficher l’empreinte, mais `ssh-keyscan` seul ne vérifie pas que la clé appartient à votre hébergeur. Enregistrez ensuite la ligne complète vérifiée dans `STAGING_SSH_KNOWN_HOSTS`. Pour un port non standard, conservez le format `[hote]:port` retourné par `ssh-keyscan`.

Ne placez aucun mot de passe ou jeton dans les fichiers du dépôt, dans une variable publique, dans le code du navigateur ou dans `_site/`. Les identifiants de transfert vont dans les secrets de l’environnement GitHub `test`.

## 3. Publier le premier build de test

Une fois le DNS, HTTPS, le virtual host et l’environnement GitHub prêts :

1. Ouvrez **Actions → Deploy cd2027.christinedeloupy.fr → Run workflow** et lancez le workflow sur `main`.
2. Suivez les étapes dans le journal GitHub Actions : installation des dépendances verrouillées, build Eleventy et contrôle des routes, transfert SSH, puis activation du lien `current`.
3. Ouvrez `https://cd2027.christinedeloupy.fr` et vérifiez les pages. Le sitemap et les URL canoniques du build visent le site de test, tandis que les données et les médias sont toujours lus depuis WordPress.

Depuis un poste qui a GitHub CLI, il est aussi possible de lancer `bash scripts/deploy-staging.sh` après `gh auth login`. Cette commande déploie le dernier commit de `main` ; elle n’envoie pas les modifications locales non commitées.

Le workflow effectue aussi un rebuild quotidien à 06:17 UTC afin de récupérer un éventuel événement manqué. Il n’y a pas de workflow de production dans cette configuration.

## 4. Installer le récepteur et le worker du hook

Le récepteur doit tourner sur un serveur Linux accessible depuis WordPress. Ce serveur peut aussi héberger le site de test, si le reverse proxy sépare bien le trafic HTTP du site statique et celui du hook. Le récepteur écoute par défaut sur `127.0.0.1:8787` ; exposez-le au public uniquement à travers un reverse proxy HTTPS.

### Installer le code et Bun

Sur le serveur du hook, installez Bun (la version du workflow de build est `1.4.2`) et créez un compte système dédié pour les processus. Clonez le dépôt privé dans un répertoire tel que `/opt/cd2026`, puis installez les dépendances verrouillées avec Bun :

```sh
sudo useradd --system --user-group --create-home --home-dir /var/lib/cd2026-webhook cd2026-webhook
git clone git@github.com:PROPRIETAIRE/DEPOT.git /opt/cd2026
cd /opt/cd2026
bun install --frozen-lockfile
sudo chown -R root:cd2026-webhook /opt/cd2026
sudo chmod -R g+rX,o-rwx /opt/cd2026
```

Ces droits permettent au compte système de lire le dépôt sans le modifier. Donnez-lui aussi accès au binaire Bun ; ses seuls répertoires en écriture sont les files persistantes `pending/`, `processed/` et le verrou du worker, tous privés et hors du web root.

### Créer les variables privées du serveur

Créez le fichier d’environnement réservé à root, puis renseignez les valeurs :

```sh
sudo install -o root -g root -m 600 /dev/null /etc/cd2026-webhook.env
sudoedit /etc/cd2026-webhook.env
sudo install -d -o cd2026-webhook -g cd2026-webhook -m 700 /var/lib/cd2026-webhook/pending /var/lib/cd2026-webhook/processed
```

Collez-y les variables suivantes :

```dotenv
WEBHOOK_SECRET=REMPLACER_PAR_UN_SECRET_ALEATOIRE_LONG
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8787
WEBHOOK_MAX_BODY_BYTES=1048576
WEBHOOK_MAX_TIMESTAMP_AGE_SECONDS=300
WEBHOOK_STORE_DIR=/var/lib/cd2026-webhook/pending
WEBHOOK_PROCESSED_DIR=/var/lib/cd2026-webhook/processed
WEBHOOK_DISPATCH_LOCK=/var/lib/cd2026-webhook/dispatcher.lock
GITHUB_DISPATCH_TOKEN=REMPLACER_PAR_LE_JETON_GITHUB
GITHUB_REPOSITORY=PROPRIETAIRE/DEPOT
GITHUB_DISPATCH_EVENT_TYPE=cd2026_staging_deploy
```

Générez un secret commun long, par exemple avec `openssl rand -hex 32`. Placez la même valeur dans `WEBHOOK_SECRET` ici et dans WordPress à l’étape 5. Le jeton GitHub est différent : il reste uniquement sur ce serveur. Créez les répertoires `/var/lib/cd2026-webhook/pending` et `/var/lib/cd2026-webhook/processed` et donnez-en la propriété à l’utilisateur système du service.

Créez un jeton d’accès personnel **fine-grained** GitHub limité à ce seul dépôt, avec la permission de dépôt **Contents: Read and write** requise par l’API `repository_dispatch`. Donnez-lui une date d’expiration et conservez le jeton uniquement dans `GITHUB_DISPATCH_TOKEN` sur le serveur du hook. Ce jeton ne remplace pas les secrets SSH de l’environnement GitHub `test`.

### Lancer les deux processus

Le récepteur doit rester actif. Le worker doit traiter la file au moins une fois par minute. Configurez-les avec systemd ou un superviseur équivalent, en utilisant le même utilisateur et le même fichier d’environnement. Les commandes de l’application sont :

```sh
bun run webhook
bun run webhook:dispatch
```

La première commande lance le récepteur HTTP. La seconde envoie un seul lot des événements admissibles à GitHub, puis les déplace vers `processed/` si GitHub répond `204`. En cas d’échec, les événements restent dans la file et seront retentés. Voici des unités systemd types ; adaptez le chemin du dépôt, le nom du compte et le chemin de Bun à votre serveur :

```ini
# /etc/systemd/system/cd2026-webhook.service
[Unit]
Description=CD2026 WordPress webhook receiver
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=cd2026-webhook
WorkingDirectory=/opt/cd2026
EnvironmentFile=/etc/cd2026-webhook.env
ExecStart=/usr/local/bin/bun run webhook/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/cd2026-webhook

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/cd2026-webhook-dispatch.service
[Unit]
Description=Dispatch queued CD2026 webhook events to GitHub
After=network-online.target

[Service]
Type=oneshot
User=cd2026-webhook
WorkingDirectory=/opt/cd2026
EnvironmentFile=/etc/cd2026-webhook.env
ExecStart=/usr/local/bin/bun run webhook/dispatch-worker.js
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/cd2026-webhook
```

```ini
# /etc/systemd/system/cd2026-webhook-dispatch.timer
[Unit]
Description=Check the CD2026 webhook queue every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
Unit=cd2026-webhook-dispatch.service

[Install]
WantedBy=timers.target
```

Puis chargez et activez les unités :

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now cd2026-webhook.service cd2026-webhook-dispatch.timer
sudo systemctl status cd2026-webhook.service cd2026-webhook-dispatch.timer
```

Consultez les journaux avec `sudo journalctl -u cd2026-webhook.service` et `sudo journalctl -u cd2026-webhook-dispatch.service`. La première commande lance le récepteur HTTP ; la minuterie appelle le worker chaque minute.

Configurez le reverse proxy pour obtenir un certificat HTTPS et transmettre sans réécriture les chemins suivants au serveur local :

- `GET /health` pour vérifier que le récepteur répond ;
- `POST /webhooks/christine` pour les événements WordPress.

Le port `8787` ne doit pas être ouvert directement sur Internet. Une réponse `200` à `/health` vérifie uniquement que le processus tourne ; elle ne teste pas GitHub ni le déploiement.

## 5. Installer le MU-plugin WordPress

Copiez [le MU-plugin](../wordpress/mu-plugins/cd2026-eleventy-webhook.php) sur WordPress dans `wp-content/mu-plugins/cd2026-eleventy-webhook.php` (créez le dossier si nécessaire). WordPress charge automatiquement les extensions *must-use* : elles n’apparaissent pas dans la liste des extensions à activer.

Dans `wp-config.php`, avant le chargement de `wp-settings.php`, ajoutez les deux constantes suivantes :

```php
define('CD2026_ELEVENTY_WEBHOOK_URL', 'https://hooks.example.net/webhooks/christine');
define('CD2026_ELEVENTY_WEBHOOK_SECRET', 'COLLER_ICI_LE_MEME_SECRET_QUE_SUR_LE_SERVEUR_DU_HOOK');
```

Remplacez le domaine d’exemple par le nom HTTPS du reverse proxy. Conservez la même URL dans tous les cas : `/webhooks/christine`. Gardez le secret hors de la médiathèque et hors des extensions accessibles publiquement.

Le plugin ignore les brouillons qui n’étaient pas publiés. Il envoie les changements de contenu public, médias, taxonomies, menus et métadonnées produit prises en charge. WordPress stocke ses événements dans une file en base puis utilise WP-Cron pour les envoyer. Sur un site peu visité, le WP-Cron déclenché par les visites peut retarder l’envoi : demandez à l’hébergeur de programmer l’exécution régulière de WP-Cron.

## 6. Vérifier le parcours complet

1. Depuis un navigateur, ouvrez `https://hooks.example.net/health`. Le résultat attendu est un JSON contenant `"ok": true`.
2. Lorsqu’une modification publique normale survient (ou après une modification de test approuvée dans WordPress), le hook l’envoie au site de test. Il ne déploie pas le domaine de production.
3. Consultez les journaux du récepteur : un événement accepté doit obtenir `202` et être écrit dans la file `pending/`. Si WP-Cron est en retard, l’événement peut rester dans la file d’attente de WordPress.
4. Après le prochain passage du worker, vérifiez ses journaux puis **Actions** dans GitHub. La réponse `204` de GitHub indique que le workflow a accepté la demande.
5. Attendez que le build, le contrôle des routes et le transfert SSH réussissent. Vérifiez enfin la modification sur `https://cd2027.christinedeloupy.fr`.

Si le build échoue, le lien `current` n’est pas changé et la version de test précédente reste servie. Consultez le premier échec dans GitHub Actions : récupération WordPress/build, contrôle des routes, puis transfert SSH sont des étapes différentes.

## Variables, commandes et fichiers associés

- `WEBHOOK_SECRET`, `WEBHOOK_HOST`, `WEBHOOK_PORT`, `WEBHOOK_STORE_DIR`, `WEBHOOK_PROCESSED_DIR` et le jeton GitHub appartiennent au serveur du hook.
- `STAGING_SSH_*` et `STAGING_SSH_KNOWN_HOSTS` sont des secrets de l’environnement GitHub Actions `test` ; `STAGING_REMOTE_ROOT` est une variable de cet environnement.
- `GITHUB_REPOSITORY` et `GITHUB_DISPATCH_EVENT_TYPE` sont des variables d’environnement privées du worker. La valeur d’événement doit correspondre au type `cd2026_staging_deploy` du workflow.
- `npm run dev` sert le frontend local sur `http://localhost:4555`.
- `npm run check` lance le build Eleventy et `scripts/check-routes.js`.
- `scripts/deploy-staging.sh` demande à GitHub de déployer le dernier `main`.
- [Workflow de staging](../.github/workflows/deploy-staging.yml), [script de transfert](../scripts/upload-staging.sh), [MU-plugin WordPress](../wordpress/mu-plugins/cd2026-eleventy-webhook.php), [récepteur](../webhook/server.js) et [worker GitHub](../webhook/dispatch-worker.js).
- Pour le fonctionnement, les limites des formulaires et du commerce et l’architecture runtime, consultez [WordPress, GitHub et routes runtime](wordpress-publishing-and-runtime.md) et [l’inventaire des routes du site](current-site-inventory.md).
