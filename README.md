# SecretLink

Application de partage de secrets à usage unique. Un lien chiffré est généré, utilisable une seule fois — une fois consulté, le secret est détruit.

> Pour la documentation complète, voir le [wiki](https://github.com/nicolegrimpeur/SecretLink/wiki).

## Architecture

| Composant | Technologie | Description |
|-----------|-------------|-------------|
| `server/` | Node.js / Express / TypeScript | API REST |
| `client/` | Angular / Ionic | Application web |
| `deploy/` | Docker Compose | Orchestration des services |
| `extension/` | Chrome Extension (MV3) | Extension navigateur |

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
| `API_BASE_URL` | URL publique de l'API | `http://localhost:3000` |
| `FRONT_BASE_URL` | URL publique du front | `http://localhost` |

### 2. Créer le volume de base de données

```bash
docker volume create secretlink-db-data
```

### 3. Démarrer les services

**Production** (ports exposés : `80` pour le client, `3000` pour l'API) :

```bash
cd deploy
. .\.env.local.ps1          # charge le .env dans l'environnement (PowerShell)
docker compose up --build
```

**Développement** (ports supplémentaires : `3306` pour MySQL, `3000` pour l'API) :

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

---

## Extension navigateur

1. Ouvrir Chrome → `chrome://extensions`
2. Activer le **mode développeur**
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `extension/`

L'extension permet de générer des liens SecretLink directement depuis le navigateur.
