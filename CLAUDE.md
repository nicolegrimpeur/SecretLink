# SecretLink - consignes pour Claude

Partage de secrets par liens à usage unique. La documentation de référence est le **wiki**, dépôt git séparé cloné à côté : `../Secretlink.wiki` (pages à plat, sommaire dans `_Sidebar.md`). Lire la page concernée avant de modifier un sujet.

## Carte

| Dossier | Contenu | Page wiki |
|---|---|---|
| `server/` | API Express, TypeScript ; `migrations/` SQL, `scripts/migrate.mjs`, `tests/` (intégration) | Architecture, API, Base de données et migrations |
| `client/` | Angular + Ionic, zoneless ; `nginx/` = point d'entrée unique | Front-end |
| `extension/` | extension Chrome MV3, version propre | Extension navigateur |
| `e2e/` | Playwright contre la pile Docker | Tests et usine |
| `deploy/` | fichiers Compose (prod, dev, integration, e2e, socle db), Alloy | Auto-hébergement |
| `api/` | collection Postman + environnement | Collection Postman |
| `.github/` | CI, release, CodeQL, Dependabot | CI et livraison |

## Commandes (racine)

```bash
npm run usine            # versions + intégration serveur + unitaires client
npm run usine:full       # + end-to-end
npm run integration:up   # base MySQL de test seule (port 3307) ; integration:down pour l'arrêter
npm --prefix server run lint && npm --prefix client run lint
npm version patch --no-git-tag-version   # montée de version (propage partout)
```

Vérifier avec l'usine avant d'annoncer qu'un changement fonctionne ; `usine:full` dès que le front, nginx ou un parcours d'authentification est touché.

## À faire au fil de l'eau

- **Changement d'API** (route, champ, code de retour) : mettre à jour les tests d'intégration, la page wiki concernée (API, API Utilisateurs, API Liens) **et** la collection Postman.
- **Changement de schéma** : nouvelle migration, jamais modifier une migration existante ; mettre à jour la page Base de données et migrations.
- **Nouvelle variable d'environnement** : `config/env.ts`, les fichiers Compose concernés, `deploy/.env.example`, page Auto-hébergement.
- **Modification de `extension/`** : monter `version` dans `extension/manifest.json` (la CI l'exige).
- **Montée d'un paquet listé dans `allowScripts`** : refaire l'approbation (`npm install-scripts approve`) dans le même commit.
- Tout ce qui change un comportement documenté : mettre le wiki à jour dans la foulée.

## Pièges

- **Client zoneless** : un état affiché dans un template doit être un signal, sinon la vue ne se rafraîchit pas (sans erreur).
- **TypeScript** : le serveur utilise le compilateur natif (lint par oxlint, pas ESLint) ; le client est borné par la version qu'accepte Angular. Ne pas aligner l'un sur l'autre.
- **Tests e2e** : 5 inscriptions par heure et par IP pour toute la suite ; un nouveau scénario qui crée un compte entame ce budget.
- **Tests d'intégration** : exécutés fichier par fichier (limiteurs partagés), une IP différente par test.
- **Sécurité** : session et pre-auth token partagent `SESSION_SECRET` et se distinguent par l'audience JWT (`middleware/session.ts`) ; toute nouvelle vérification de jeton doit passer par ces fonctions.
- **Poste Windows** : PowerShell et Git Bash, fins de ligne CRLF ; attention aux remplacements multi-lignes par `sed`/`perl`.

## Conventions

- Français pour la documentation et les échanges. Dans le code, garder la langue des commentaires du fichier (certains fichiers serveur sont en anglais).
- Commentaires et documentation décrivent **l'état actuel**, jamais l'historique des changements.
- Pas de versions ni de compteurs en dur qui dériveraient : renvoyer vers `package.json`, `.nvmrc` ou la commande qui donne la valeur.
- Documentation **synthétique** : l'utile pour utiliser, déployer ou modifier ; pas de justification de chaque décision.
- Une branche par sujet ; l'utilisateur crée les branches, commite et pousse. Proposer un texte de PR court : il alimente les notes de release.
