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

⚠️ `TRUST_PROXY` se compte en partant du serveur, et le nginx qui proxifie `/api` compte
pour un saut. Une valeur trop basse fait partager un même quota et un même hash d'IP à
tous les visiteurs ; une valeur trop haute rend `X-Forwarded-For` forgeable. Le détail
par topologie est documenté dans [`deploy/.env.example`](deploy/.env.example).

### 2. Créer le volume de base de données

```bash
docker volume create secretlink-db-data
```

### 3. Démarrer les services

**Production** (aucun port publié : la stack est destinée à être placée derrière un
reverse proxy - Traefik/Dokploy - qui route l'unique hostname vers le service `client`) :

```bash
cd deploy
. .\.env.local.ps1          # charge le .env dans l'environnement (PowerShell)
docker compose up --build
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

## Extension navigateur

1. Ouvrir Chrome → `chrome://extensions`
2. Activer le **mode développeur**
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `extension/`

L'extension permet de générer des liens SecretLink directement depuis le navigateur.
