# Tests end-to-end

Playwright contre la **stack Docker complète** : MySQL, le serveur Express, et le nginx qui
sert la SPA et proxifie l'API.

```bash
npm run e2e:up      # build les images et monte la stack (~2 min la 1re fois)
npm run test:e2e    # joue la suite (~20 s)
npm run e2e:down    # arrête tout et supprime le volume
```

Ou l'enchaînement complet, tests unitaires et d'intégration compris :

```bash
npm run usine:full
```

## Ce que ces tests apportent, et ce qu'ils n'apportent pas

Les 98 tests d'intégration du serveur couvrent déjà **tous** les codes de retour de l'API.
Les rejouer ici n'apprendrait rien et coûterait cher. Cette suite ne vérifie donc que ce
qu'eux ne *peuvent pas* prouver :

- **le point d'entrée unique** - nginx sert bien la SPA *et* proxifie `/api` en retirant le
  préfixe, le repli SPA fonctionne sur les routes profondes, une route d'API finissant par
  `.js` n'est pas servie depuis le disque, et les deux jeux d'en-têtes de sécurité (nginx pour
  la SPA, helmet pour l'API) ne se superposent pas ;
- **le parcours du lien à usage unique** dans un vrai navigateur, y compris la passphrase ;
- **la chaîne d'authentification complète** : inscription avec MFA, codes de récupération,
  connexion, cookie de session posé au travers du proxy, gardes de route Angular.

Les liens sont amorcés par l'API (`helpers/api.ts`) et seul le parcours navigateur est joué.
C'est un choix : passer par l'interface pour *préparer* un état multiplie la fragilité DOM
sans rien démontrer de plus.

## Contrainte à connaître : le limiteur d'inscription

`POST /users/signup` est limité à **5 requêtes par heure et par IP**, et derrière nginx tous
les tests partagent la même IP. La spoofer ne sert à rien : `proxy_add_x_forwarded_for`
ajoute toujours le véritable dernier saut, et le serveur (`TRUST_PROXY=1`) ne lit que
celui-là.

La suite consomme donc **2 inscriptions** par exécution : une par l'interface (`auth.spec.ts`)
et une par l'API (le lien à passphrase de `redeem.spec.ts`). Avec les tentatives de reprise en
CI, comptez jusqu'à 4. Si vous ajoutez des scénarios qui créent des comptes, surveillez ce
plafond - un dépassement se manifeste par un `429` déroutant en pleine inscription.

Le store des limiteurs est **en mémoire dans le process** : redémarrer le serveur remet les
compteurs à zéro.

```bash
docker compose -f ../deploy/docker-compose.e2e.yml restart server
```

## Écart assumé avec la production

Le serveur tourne en `NODE_ENV=test` et non `production`, pour une seule raison : en
production les cookies portent le flag `Secure`, que le navigateur refuse sur du `http://`
en clair - la connexion serait impossible. C'est le seul écart. Tout le reste (image,
bundle Angular de production, nginx, schéma MySQL, fuseau UTC) est identique.

## Diagnostiquer un échec

Traces, captures et vidéos sont conservées automatiquement en cas d'échec :

```bash
npx playwright show-trace test-results/<dossier-du-test>/trace.zip
npm --prefix e2e run report        # rapport HTML
docker compose -f deploy/docker-compose.e2e.yml logs server
```

## Note sur les composants Ionic

Cliquer l'hôte `ion-checkbox` ne coche pas toujours la case : sur celle des conditions
d'utilisation, le libellé contient un lien dont le handler fait `stopPropagation()`, et un
clic au centre atterrit dessus. Le helper `checkIonCheckbox` vise donc `.checkbox-icon`, la
boîte visuelle. Même logique pour `ion-segment-button`, qui capte le pointeur à la place de
son `ion-label` interne.
