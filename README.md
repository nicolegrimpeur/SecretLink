# SecretLink

Partage de secrets par liens à usage unique : une fois consulté, le secret est détruit.

**Documentation : [wiki](https://github.com/nicolegrimpeur/SecretLink/wiki).** Ce README ne couvre que le démarrage sur le dépôt.

| Dossier | Contenu |
|---|---|
| `server/` | API Express (TypeScript), migrations SQL |
| `client/` | front Angular + Ionic, config nginx (point d'entrée unique) |
| `extension/` | extension Chrome |
| `e2e/` | tests end-to-end Playwright |
| `deploy/` | fichiers Docker Compose |
| `api/` | collection Postman |

## Prérequis

- Node.js dans la version du `.nvmrc` (`nvm use`)
- Docker et Docker Compose

Quatre projets npm indépendants, sans workspaces :

```bash
npm ci && npm --prefix server ci && npm --prefix client ci && npm --prefix e2e ci
```

## Lancer l'application

```bash
cd deploy
cp .env.example .env      # renseigner les secrets ; TRUST_PROXY=1 pour ce compose
docker compose -f docker-compose-dev.yml up --build
```

Application sur <http://localhost>, API en direct sur le port 3000, MySQL sur 3306. Lancement sans Docker : [Développement local](https://github.com/nicolegrimpeur/SecretLink/wiki/Développement-local).

## Tester

```bash
npm run usine        # intégration serveur + unitaires client
npm run usine:full   # + end-to-end
```

C'est la même chaîne que la CI. Détails : [Tests et usine](https://github.com/nicolegrimpeur/SecretLink/wiki/Tests-et-usine).

## Livrer

```bash
npm version patch --no-git-tag-version   # ou minor / major, dans la PR
```

Le merge dans `master` publie les images et la release. Voir [CI et livraison](https://github.com/nicolegrimpeur/SecretLink/wiki/CI-et-livraison).

## Pour aller plus loin

- [Architecture](https://github.com/nicolegrimpeur/SecretLink/wiki/Architecture)
- [API](https://github.com/nicolegrimpeur/SecretLink/wiki/API)
- [Base de données et migrations](https://github.com/nicolegrimpeur/SecretLink/wiki/Base-de-données-et-migrations)
- [Auto-hébergement](https://github.com/nicolegrimpeur/SecretLink/wiki/Auto-hébergement)
