# SecretLink

Application de partage de secrets à usage unique. Un lien chiffré est généré, utilisable une seule fois - une fois consulté, le secret est détruit.

> Pour la documentation complète, voir le [wiki](https://github.com/nicolegrimpeur/SecretLink/wiki).

## Architecture

| Composant | Technologie | Description |
|-----------|-------------|-------------|
| `server/` | Node.js / Express / TypeScript | API REST |
| `client/` | Angular / Ionic + nginx | Application web **et** point d'entrée unique |
| `deploy/` | Docker Compose | Orchestration des services |
| `extension/` | Chrome Extension (MV3) | Extension navigateur |

### Point d'entrée unique

Toute l'application est servie sous **une seule origine**. Le nginx du conteneur `client`
sert la SPA et proxifie l'API :

```
                        ┌─ /       → fichiers statiques Angular
Internet ─→ client:80 ──┤
            (nginx)     └─ /api/*  → server:3000 (préfixe /api retiré)
```

Le conteneur `server` ne publie aucun port : il n'est joignable que par nginx. Le front
et l'API partageant la même origine, le navigateur ne déclenche aucun CORS ; le
middleware CORS côté serveur ne subsiste que pour l'extension (`chrome-extension://`)
et d'éventuels clients natifs ou auto-hébergés.

Le routage vit dans [`client/nginx/nginx.conf`](client/nginx/nginx.conf), donc versionné
et identique en local et en production.

---

## Prérequis

- [Docker](https://www.docker.com/) et Docker Compose
- Node.js 20+ *(pour le développement local uniquement)*

---

## Lancement avec Docker

### 1. Configurer les variables d'environnement

```bash
cd deploy
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/macOS
```

Remplir les valeurs dans `.env` :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `MYSQL_USER` | Utilisateur MySQL | `link` |
| `MYSQL_PASSWORD` | Mot de passe MySQL | *(chaîne aléatoire)* |
| `MASTER_KEY_V1` | Clé de chiffrement AES-256 (64 caractères hex) | `openssl rand -hex 32` |
| `SESSION_SECRET` | Secret de session (32 car. min.) | `openssl rand -base64 32` |
| `IP_HMAC_SECRET` | Secret HMAC pour pseudonymiser IP/email dans les logs (32 car. min.) | `openssl rand -base64 32` |
| `FRONT_BASE_URL` | Origine publique unique (front + API sous `/api`) | `http://localhost` |
| `TRUST_PROXY` | Nombre de proxys de confiance devant le serveur - **voir ci-dessous** | `2` en prod, `1` en dev |
| `SECRETLINK_TAG` | Version des images à tirer de GHCR, sans le `v` | `0.19.5` |

⚠️ `TRUST_PROXY` se compte en partant du serveur, et le nginx qui proxifie `/api` compte
pour un saut. Une valeur trop basse fait partager un même quota et un même hash d'IP à
tous les visiteurs ; une valeur trop haute rend `X-Forwarded-For` forgeable. Le détail
par topologie est documenté dans [`deploy/.env.example`](deploy/.env.example).

### 2. Créer le volume de base de données

```bash
docker volume create secretlink-db-data
```

### 3. Démarrer les services

**Production** - les images sont **tirées de GHCR**, pas construites sur l'hôte. Elles sont
publiées par [`release.yml`](.github/workflows/release.yml) à chaque merge qui bumpe la
version. Aucun port publié : la stack est destinée à être placée derrière un reverse proxy
(Traefik/Dokploy) qui route l'unique hostname vers le service `client`.

```bash
cd deploy
. .\.env.local.ps1          # charge le .env dans l'environnement (PowerShell)
docker compose pull
docker compose up -d
```

> **Mise à jour ou rollback** : changer `SECRETLINK_TAG` dans `.env`, puis rejouer les deux
> commandes. C'est la seule manipulation. Un `SECRETLINK_TAG` absent fait échouer Compose
> avec un message explicite, plutôt que de retomber silencieusement sur `latest`.

**Construire localement** au lieu de tirer les images publiées - pour déployer du code non
encore livré, ou reproduire un problème avec une modification locale :

```bash
cd deploy
. .\.env.local.ps1
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build -d
```

**Développement** (`80` pour l'application complète, `3000` pour taper l'API en direct,
`3306` pour MySQL) :

```bash
cd deploy
. .\.env.local.ps1
docker compose -f docker-compose-dev.yml up --build
```

---

## Développement local (sans Docker)

### Serveur

```bash
cd server
npm install
npm run build      # compile TypeScript → dist/
npm run dev        # démarre avec --watch
```

Créer un fichier `server/.env` avec les mêmes variables que `deploy/.env.example` (adapter `MYSQL_HOST` à `localhost`).

### Client

```bash
cd client
npm install
npm start          # lance ionic serve sur http://localhost:8100
```

Le serveur de développement Angular reproduit le point d'entrée unique : les appels vers
`/api` sont proxifiés vers `http://localhost:3000` via
[`client/proxy.conf.json`](client/proxy.conf.json). Le serveur doit donc tourner en
parallèle, avec `TRUST_PROXY=0` (le proxy Angular n'est pas un reverse proxy de
confiance).

> **Build natif Capacitor** : `apiBaseUrl` est relatif (`/api`), ce qui suppose que la
> SPA et l'API partagent une origine. Une application native (origine
> `capacitor://localhost`) devrait repasser sur une URL absolue dans son propre fichier
> d'environnement.

---

## Tests

L'usine complète, en une commande depuis la racine :

```bash
npm run usine
```

Elle enchaîne : contrôle de cohérence des versions → démarrage d'une base MySQL éphémère →
tests d'intégration du serveur → tests unitaires du client → arrêt de la base. Comptez
environ 2 minutes. Aucun navigateur n'est nécessaire : les deux suites tournent sous Vitest.

### Commandes séparées

```bash
npm run db:test:up        # MySQL éphémère sur le port 3307, schéma + seed appliqués
npm run test:server       # tests d'intégration serveurs
npm run test:client       # tests unitaires Angular
npm run db:test:down      # arrêt et suppression du volume

npm --prefix server run test:watch        # boucle de développement, serveur
npm --prefix client run test:watch        # boucle de développement, client
npm --prefix server run typecheck:tests   # type-check des tests, sans émission
```

Les variantes `test:ci` (`npm --prefix server run test:ci`, idem client) ajoutent la
couverture et un rapport JUnit dans `reports/` - c'est ce que la CI consomme.

Le serveur a besoin de la base ; les tests client, non. Si l'usine échoue, la base **reste
debout** volontairement, pour pouvoir l'inspecter :

```bash
docker exec secretlink-test-db-1 mysql -ulink -pcipass secretLink -e "SELECT * FROM links"
```

### Tests unitaires du client

Ils utilisent le builder `@angular/build:unit-test` avec Vitest. Le builder initialise lui-même les polyfills et le `TestBed`, il n'y a donc pas de fichier d'amorçage à maintenir.

[`client/vitest.config.ts`](client/vitest.config.ts) ne corrige qu'un point : `@ionic/angular`
importe un *répertoire* (`@ionic/core/components`), ce que le résolveur ESM de Node refuse.
Inliner Ionic force Vite à le résoudre lui-même.

### Tests end-to-end

Playwright contre la stack Docker complète (MySQL + serveur + nginx), qui reproduit le point
d'entrée unique de la production :

```bash
npm run e2e:up      # build les images et monte la stack (~2 min la 1re fois)
npm run test:e2e    # joue la suite (~20 s)
npm run e2e:down

npm run usine:full  # tout : unitaires, intégration, puis end-to-end
```

Ils ne rejouent **pas** le contrat de l'API - les tests d'intégration s'en chargent. Ils
vérifient ce que seule la stack assemblée peut prouver : le routage nginx, le parcours du lien
à usage unique dans un vrai navigateur, et la chaîne d'authentification MFA complète.
Détails, contraintes et diagnostic dans [`e2e/README.md`](e2e/README.md).

### Configuration des tests serveur

[`server/.env.test`](server/.env.test) est **committé volontairement** : toutes ses valeurs
sont jetables et n'ont de sens que face à la base éphémère. Elles prennent le pas sur votre
`server/.env` local, car `dotenv` n'écrase jamais une variable déjà définie.

> ⚠️ N'y recopiez **jamais** une valeur de `deploy/.env`. La suite vide les tables à chaque
> test, et `MASTER_KEY_V1` est la clé qui déchiffre tous les secrets stockés.

---

## Intégration continue et livraison

### Le gate de merge

[`ci.yml`](.github/workflows/ci.yml) tourne sur chaque PR vers `master`, sur les pushs dans
`master`, et à la demande. Sept jobs : détection des changements, cohérence des versions,
serveur (typage + build + 98 tests d'intégration), client (lint + build + 123 tests
unitaires), extension (manifest + syntaxe + garde de bump), end-to-end (stack Docker + 16
tests Playwright + démarrage en mode production), puis **`ci-gate`**.

`ci-gate` est le **seul** check requis par la protection de branche. Il agrège les six autres
et traite `skipped` comme un succès - les jobs sont filtrés par chemin, une PR ne touchant que
le client n'a aucune raison de lancer les tests serveur. C'est aussi ce qui évite qu'une PR
reste bloquée indéfiniment en « waiting for status ».

**Aucun secret n'est nécessaire.** Les valeurs de test sont committées
([`server/.env.test`](server/.env.test)) ou écrites en dur dans les compose de test, et la
publication sur GHCR utilise le `GITHUB_TOKEN` automatique.

### Livrer une version

1. Bumper la `version` du `package.json` **racine**, puis `npm run version:sync` (le hook npm
   `version` le fait et stage les fichiers).
2. Merger la PR dans `master`.

[`release.yml`](.github/workflows/release.yml) prend le relais : il compare la version au
dernier tag et, si elle est nouvelle, construit et pousse les deux images sur GHCR, crée le
tag `vX.Y.Z`, puis publie une Release avec les PR mergées, la liste des commits, les
coordonnées des images et le zip de l'extension. Si la version est déjà taguée - le cas de la
plupart des pushs - il ne fait rien.

Les images sont poussées **avant** la création du tag : un build raté ne laisse ni tag ni
release, donc un rejeu repart proprement.

> L'`extension` suit son propre cycle de version : le Chrome Web Store exige des versions
> strictement croissantes, et le manifest est déjà en `1.x`. `sync-version.mjs` ne l'aligne
> donc pas sur la version du dépôt.

#### Images multi-architecture

Les deux images sont publiées pour **`linux/amd64` et `linux/arm64`** - la production tourne
sur un Raspberry Pi 64 bits. Un `docker pull` sélectionne automatiquement la bonne
architecture, il n'y a rien à préciser côté hôte.

Chaque architecture est construite sur un **runner natif** (`ubuntu-24.04-arm` pour arm64),
pas sous QEMU : ces runners sont gratuits sur dépôt public, l'émulation d'un build Angular
coûterait 5 à 10 fois plus cher, et esbuild - que la chaîne Angular utilise - est une source
connue d'échecs erratiques sous émulation.

Les quatre legs poussent **sans tag, par digest seul** ; le job `manifest` assemble ensuite
l'index qui reçoit les tags. C'est ce qui évite que deux builds parallèles s'écrasent un tag,
et une garde vérifie que les deux architectures sont bien présentes avant de continuer - un
index amputé ne se verrait sinon qu'au `docker pull` sur le Pi.

```bash
# Vérifier ce que contient une image publiée
docker buildx imagetools inspect ghcr.io/nicolegrimpeur/secretlink-server:latest
```

### Protection de `master`

Ruleset à configurer dans l'interface GitHub. Les valeurs et, surtout, **leurs raisons** :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Require a pull request before merging | on | c'est ce qui rend le gate incontournable |
| Required approvals | **0** | GitHub interdit d'approuver sa propre PR : à `1`, aucune PR ne serait mergeable en solo |
| Require extra approval for unattributed changes | **off** | même piège : un commit dont l'email n'est pas rattaché au compte exigerait une approbation impossible à donner |
| Require status checks | on, **`ci-gate` seul** | les autres jobs sont conditionnels ; exiger un job skippé bloque la PR |
| Require branches to be up to date | on | couvre les conflits sémantiques avant le merge |
| Require linear history | on | va avec le squash, garde `git log` exploitable par le changelog |
| Block force pushes, Restrict deletions | on | |
| Require conversation resolution | on | discipline gratuite, fonctionne même en solo |
| Bypass actors | rôle *Repository admin* | échappatoire journalisée ; sans elle, le geste de secours est de désactiver le ruleset |

Hors ruleset, deux réglages tout aussi structurants :

- **Settings → General → Pull Requests** : squash merge uniquement, message par défaut
  *Pull request title and description*. Un commit `master` = une PR, ce qui rend les notes de
  release natives exploitables.
- **Settings → Actions → General → Workflow permissions** : *Read and write*. C'est un
  **plafond** - un `permissions: contents: write` déclaré dans un job ne peut pas le dépasser.
  En read-only, `release.yml` échoue à la création du tag sur un 403 trompeur.

---

## Extension navigateur

1. Ouvrir Chrome → `chrome://extensions`
2. Activer le **mode développeur**
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `extension/`

L'extension permet de générer des liens SecretLink directement depuis le navigateur.
