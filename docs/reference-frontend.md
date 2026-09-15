# `das-admin` — référence du front

> Document de référence, à tenir à jour. Il décrit **ce qui existe**, pas ce qui est prévu.
> Les règles courtes pour un assistant IA sont dans `CLAUDE.md` à la racine ; celui-ci explique
> le *pourquoi*, et se lit sans contexte préalable.
>
> Dernière vérification du contenu : **2026-09-15**.

---

## 1. Ce qu'est ce dépôt

**D.A.S (Djibouti Address System)** est la plateforme nationale de standardisation des adresses.
`das-admin` en est le **front d'administration** : consulter, valider et publier le référentiel,
sur carte et sur tableaux.

C'est une **couche d'affichage et de consommation, rien d'autre.**

- Aucun import de données géographiques ne passe par ici. La donnée entre par des scripts
  back-end et de l'outillage PostGIS (`scripts/sig/`, `scripts/map/`).
- Le back-end (.NET / PostGIS / Martin) est un **contrat externe** : on le consomme, on ne le
  modifie pas depuis ce dépôt. La source de vérité du contrat est le guide d'intégration et la
  spec OpenAPI (`GET /openapi/v1.json` en développement).

Deux autres produits existent hors de ce dépôt : une application mobile de terrain, et la
Plateforme 1 de La Poste de Djibouti, qui consomme le référentiel public.

---

## 2. Démarrer

```bash
npm ci
cp .env.example .env     # puis renseigner — voir §5
npm start                # http://localhost:4200
```

Pour la pile complète (API, tuiles, cache) :

```bash
docker compose up -d
```

> ⚠️ **Node 20.19 ou 22.12 minimum.** En deçà, la CLI Angular refuse de démarrer avec un message
> clair. Les images Docker du dépôt utilisent `node:22-alpine`.

---

## 3. Stack et conventions

| | |
|---|---|
| Angular | **21** — composants standalone, **signals**, control flow `@if` / `@for` / `@switch` |
| État | **NgRx**, en **pattern facade** (§4), avec `@ngrx/operators` (`concatLatestFrom`) |
| i18n | **Transloco**, symétrie **fr / en** obligatoire |
| Carte | **MapLibre GL v6** via le wrapper maison `das-map`, tuiles vectorielles **Martin** |
| Icônes | **Tabler** (`ti ti-*`) |
| Styles | SCSS avec tokens (`@use "styles/variables" as v;`) et variables CSS de thème (`var(--color-*)`) |
| Tests | **vitest** pour l'unitaire, **Playwright** pour le bout en bout |

Trois conventions non négociables :

1. **Trois fichiers par composant** — `.ts` (avec `templateUrl` et `styleUrl`), `.html`, `.scss`.
   **Jamais** de template ni de style en ligne.
2. **Un composant n'injecte jamais `Store`.** Il passe par une facade (`providedIn: 'root'`).
3. **Pas de couleur en dur** hors de la palette. Les variables de thème existent pour que le
   mode sombre ne soit pas une reprise.

---

## 4. Architecture d'une feature

L'état vit dans `core/<domaine>/`, l'écran dans `features/<domaine>/`. Vingt-sept domaines dans
`core/`, vingt et un écrans dans `features/` au dernier relevé.

```
core/adresse/
  models/    adresse.models.ts
  services/  adresse-api.port.ts       ← abstraction
             adresse-api.service.ts    ← implémentation HTTP
             mock-adresse-api.service.ts
  store/     adresse.actions.ts  adresse.reducer.ts  (createFeature)
             adresse.effects.ts  adresse.facade.ts
```

- Le composant lit des `Observable` / `Signal` exposés par la facade et appelle ses méthodes.
  **Il ne connaît ni actions ni sélecteurs.**
- Les effets **relisent l'état** (`concatLatestFrom`) plutôt que de trimballer l'état dans les
  payloads quand il est déjà dans le store — sélection, filtres, pagination.
- Les ports d'API sont fournis à la racine, dans `app.config.ts`.

---

## 5. Configuration à l'exécution

**La même image sert dev, recette et production.** Rien n'est compilé en dur.

Au démarrage du conteneur, `docker/env-config.sh` écrit `config.json` à partir des variables
d'environnement. Le front le lit au boot :

```json
{ "apiBaseUrl": "/api", "mapTileUrl": "/api/tiles",
  "mapPublicTileUrl": "/api/public/tiles", "mapPublicKey": "…",
  "environment": "production", "useMockApi": false }
```

> ⚠️ **Diagnostic express** : quand la carte est blanche, regarder `GET /config.json` AVANT le
> code. Le 2026-09-13, `mapPublicKey` y était vide sur la production — chaque tuile rendait
> `401`. Ce n'était ni le style, ni la liste blanche, ni le front.

**Bascule mock / réel** : la factory `useMockApi()` dans `app.config.ts`. Changer d'environnement
ne demande **aucun changement de code**, et le code doit rester correct dans les deux branches.

---

## 6. La carte

### Deux sources, à ne jamais confondre

| | Rôle | Casse | Filtrage |
|---|---|---|---|
| **Tuiles Martin** | fond de contexte | attributs **PascalCase**, casse SQL exacte, `promoteId: "Id"` | `setFilter` sur les couches |
| **GeoJSON de l'API** | overlays du workflow | — | côté client |

`feature-state` est réservé aux **overrides live et à la sélection**. La coloration de base est
**bakée dans `map-style.json`** (`match` sur `status` / `workflowStage`) — la mettre en
feature-state provoque un style thrash sur gros volumes.

> ⚠️ Le nommage des sources Martin est **exact et sensible à la casse** (`Adresses` ≠
> `Adresses.1`). Une erreur de casse échoue **silencieusement**.

### Les trois chemins de tuiles

```
/api/tiles/…         jeton de session   — administration
/api/public/tiles/…  clé révocable      — carte vitrine et partenaires
/tiles/…             410 Gone           — fermé le 2026-09-10, ne pas rétablir
```

Le troisième servait Martin **sans authentification**, et Martin auto-publie tout ce que son rôle
peut lire. Il est fermé explicitement, et non par omission : sans le bloc `410`, la requête
retombe dans le repli SPA et rend `200 text/html` — un client décode alors de l'`index.html` en
protobuf, ce qui échoue sans rien expliquer.

> ⚠️ **Le même piège s'est refermé sur `/carto/`** le 2026-09-13 : sans son bloc `location`,
> `commercial-style.json` rendait 12 704 octets de HTML en `200`. La Poste recevait du HTML là où
> elle attendait un style.

### Codes de réponse d'une tuile

| | |
|---|---|
| `204` | tuile vide — **légitime**, la réponse normale de la plupart des tuiles |
| `404` | source hors liste blanche **ou hors de sa plage de zoom** |
| `401` | clé absente, inconnue ou révoquée |

> ⚠️ `404` ne veut pas dire « interdit ». `contour_national` est déclarée z0–z12 : la demander
> au zoom 13 rend `404`, et c'est normal. Vérifier la plage avant de conclure à un refus.

### Cascade hiérarchique

`HierarchyCascadeComponent` émet une `HierarchySelection`, découplée de toute facade. Elle pilote
**en même temps** le `setFilter` des couches tuiles et les filtres du store. Elle s'adapte à la
donnée creuse : une Zone vide masque son select au lieu de bloquer.

---

## 7. Le contrat API — ce qui coûte cher

- **Préfixe `/api` sur toutes les routes.** `apiBaseUrl` doit l'inclure.
- **Nommage mixte assumé** : `blocs` (pas `blocks`), `adresses` (pas `addresses`). Champs FR sur
  `Quartier` / `Adresse` (`nom`, `numero`, `libelle`), EN sur `City` / `Commune` / `Zone`.
- **Enums = chaînes, jamais des nombres** (`"status": "InProgress"`), y compris en query.
- **Dates UTC suffixées `Z`** (`...AtUtc`). Exception : les dates limites de campagne sont des
  dates à minuit **heure de Djibouti (UTC+3)** — ne pas comparer en UTC naïf.
- **Géométries en WKT / SRID 4326** sur le CRUD géo. ⚠️ Le module adresses, lui, porte du GeoJSON.
- **Pagination** : enveloppe `{ items, total, page, pageSize }`. `pageSize` plafonné à **200**,
  `page` commence à **1**, `total` = lignes après filtrage. Pas de `pageCount` renvoyé — il est
  recalculé au sélecteur.
- **Auth JWT Bearer.** `refresh` fait **tourner** le refresh token : stocker celui de la réponse
  et **sérialiser les refresh concurrents** — deux onglets provoquent une révocation totale.
- **Erreurs** : métier = `{ code, message }` → **tester `code`**, jamais `message`. Validation =
  `ValidationProblemDetails` à clés **PascalCase**. Un `403` peut dépendre de la donnée et pas
  seulement du rôle : ce n'est pas forcément un bug d'affichage.
- **Rôles** : `Admin`, `Superviseur`, `AgentTerrain`, `Gestionnaire` — cumulables, lire les
  claims multiples.

---

## 8. Le modèle de domaine

**City → [Commune] → [Zone] → Quartier → Bloc → Adresse**

- **La commune est facultative** : seule Djibouti-ville est découpée en communes. `communeId:
  null` est un état **normal et définitif**, pas une donnée manquante.
- `cityId` est le rattachement structurant, obligatoire sur un quartier, **non déductible** de la
  commune.
- Une `Zone` raffine une commune : `zoneId` exige `communeId`.
- `Street` est une **entité autonome**, pas un niveau. `Arrondissement` et `Lot` sont supprimés.

**Étapes de workflow** (`workflowStage`, **minuscules** en lecture) :

```
registered → surveyed → verified → approved → published
```

Dérivation : `registered` = aucun relevé **ou dernier relevé rejeté** ; `surveyed` = dernier
relevé Draft/Submitted ; `verified` = dernier relevé Validated ; `approved` / `published` =
décision back-office.

> ⚠️ **Casse asymétrique.** Lecture, filtre `status` et filtre tuile en **minuscules**
> (`verified`) ; écriture `PATCH /bulk` `stage` en **PascalCase**, et uniquement
> `Approved` | `Published`. `BulkUpdatePayload.stage` est typé `'Approved' | 'Published'`, pas
> `AddressWorkflowStage`.

**Pas d'action de masse hors `approved` / `published`.** Les trois premières étapes se déduisent
d'un relevé et ne sont pas inscriptibles : la validation se traite **un élément à la fois avec
photos**, via `/api/surveys`.

**Codes — à lire, jamais à recomposer côté front** : `postcode` (dérivé, nullable), `addressCode`
(`Ville-Quartier-Bloc-Numéro`, numérique, `null` tant que non validé Definitive), `libelle`
(toujours présent, donc repli d'affichage quand `addressCode` est `null`).

---

## 9. i18n

Toute clé ajoutée ou supprimée l'est **symétriquement en fr ET en**. Éviter les collisions
feuille / sous-map ; corriger une collision par **renommage de clé** (`occupancy →
occupancyCol`), pas par restructuration.

---

## 10. Tests

```bash
npm test          # vitest — 39 tests, 11 fichiers (2026-09-15 : tous verts)
npm run e2e       # Playwright — 5 scénarios, lance `ng serve` et exige un back-end vivant
```

> ⚠️ Les e2e mesurent la pile entière. Un échec y signifie souvent « la base n'est pas
> joignable », pas « le code est faux ». Vérifier `POST /api/auth/login` avant d'accuser le front.

---

## 11. Déploiement — **l'EC2 fait référence**

L'image est construite et poussée par GitHub Actions à chaque `main`
(`nejishow/das-admin:latest` + un tag court de commit).

> ### ❗ Le piège qui a coûté un mois
> `docker-compose.yml` **monte `./nginx.conf` par-dessus la configuration de l'image** :
>
> ```yaml
> - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
> ```
>
> Le montage gagne toujours. Sur la production, un `nginx.conf` du 17 août est resté servi
> pendant qu'une dizaine d'images se succédaient : **reconstruire et pousser ne changeait rien**,
> et le relais Martin non authentifié est resté ouvert un mois après sa fermeture supposée.
>
> **Conséquence pratique** : déployer, ce n'est pas seulement pousser une image. C'est aussi
> déposer `nginx.conf` et `docker/martin/config.yaml`. Vérifier les deux après chaque
> déploiement.

Autres rappels d'infra :

- **Staleness de bundle** : des hash de chunks inchangés après un déploiement = le build n'a pas
  atteint le conteneur. Toujours vérifier le changement de hash.
- **CRLF casse les scripts shell en Docker sous Windows** : `.gitattributes` plus un durcissement
  `sed` dans le Dockerfile.
- **OOM sur l'EC2** provoque des redémarrages Jenkins en plein build, avec un
  `MissingContextVariableException` trompeur. Vérifier `docker ps` et les endpoints de santé
  **avant** de conclure à un échec.
- **`das-admin` (nginx) sert de reverse proxy** pour toute la pile.
- **Architecture d'image** : l'EC2 est en **amd64**. Une image construite sur un poste Apple
  Silicon sans `--platform` y est inutilisable — le symptôme est « no matching manifest ».

**Aucun secret dans ce dépôt.** Il est public. Tout passe par `.env`, que `.env.example`
documente. En particulier `JWT_SECRET` : une valeur devinable rend les jetons de session
**forgeables**.

---

## 12. Ce qui n'existe pas, et la dette

Sur le module adresses (`/api/adresses`) :

- **`POST /approve` et `POST /{id}/flag` ne sont pas implémentées.** Approuver =
  `bulk { stage: 'Approved' }` ; signaler = `POST /api/surveys/{id}/reject`.
- **`street` est toujours `null`** → colonne retirée de la liste, ligne retirée du drawer.
- **`geom` est toujours `null`** → la carte vient des tuiles.
- **`history` est toujours `[]`** → pas d'onglet, et aucune clé i18n `history.*`.
- **`propertyType`** est un libellé FR de catalogue (« Villa », « Immeuble mixte »), pas un enum
  fermé. Affiché brut en attendant une clé stable côté back.
- **`validation.score`** est un **nombre de relevés**, pas une note sur 100 ; `percentage` peut
  dépasser 100. Bloc masqué dans le drawer.
- **`duplicatesFlagged`** compte des **relevés rejetés**, pas des doublons → libellé « À revoir ».
- **`assignedTeamName`** est le nom d'un **agent**, pas d'une équipe, en lecture seule. Réaffecter
  passe par le bloc-en-campagne.
- Champs `components` : le back envoie **`quartierNom`** (pas `quartier`) ; `region` est le nom de
  la ville.

État du renommage `registry → adresse` : **fait**. Plus aucune occurrence dans `src/`, la route
est `/adresse`, les clés i18n sont `adresse.*`. Les types `Address*` n'ont pas bougé — un second
passage est possible, et reste optionnel.

---

## 13. À ne pas faire

- ❌ Injecter `Store` dans un composant. ❌ Template ou style en ligne.
- ❌ Recomposer `postcode` / `addressCode` / `libelle` côté front — les **lire**.
- ❌ Mettre la coloration de base en `feature-state`.
- ❌ Confondre tuiles Martin et GeoJSON de l'API.
- ❌ Envoyer `stage` en minuscules à `/bulk`, ou autre chose que `Approved` / `Published`.
- ❌ Ajouter une clé i18n dans une seule langue.
- ❌ Ajouter de l'import de données géographiques côté front.
- ❌ Écrire un secret dans ce dépôt — il est public.
