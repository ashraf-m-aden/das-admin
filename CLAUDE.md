# CLAUDE.md — das-admin

> Contexte et règles pour un assistant IA travaillant sur ce dépôt.
> **Portée : le front `das-admin` uniquement.** Le backend (.NET / PostGIS / Martin) est un
> **contrat externe** : on le consomme, on ne le modifie pas d'ici. La source de vérité du
> contrat est le guide d'intégration (dernière version) + la spec OpenAPI (`GET /openapi/v1.json`
> en dev). En cas de conflit entre ce fichier et le guide, **le guide gagne**.

---

## 1. Le projet

**D.A.S (Djibouti Address System)** — plateforme nationale de standardisation des adresses.
`das-admin` est le **front d'administration** (Angular) : consultation, validation et publication
du référentiel d'adresses, sur carte + tableaux. Une app mobile terrain et une couche API
commerciale existent mais **sont hors de ce dépôt**.

`das-admin` est une **couche d'affichage / consommation pure**. Pas d'import de données géo
côté front : la donnée entre par des scripts backend / outillage PostGIS.

---

## 2. Stack

- **Angular 21** — composants standalone, **signals**, control flow `@if/@for/@switch`.
- **NgRx** avec **pattern facade** (voir §4). `@ngrx/operators` (`concatLatestFrom`).
- **Transloco** i18n, symétrie **fr / en** obligatoire.
- **MapLibre GL v6** via le wrapper maison `das-map`. Tuiles vectorielles **Martin**.
- **Icônes Tabler** (`ti ti-*`).
- SCSS avec design tokens (`@use "styles/variables" as v;`, `@use "styles/mixins" as m;`) et
  **variables CSS de thème** (`var(--color-*)`). Ne pas coder de couleurs en dur hors palette.
- Dev local **Windows** (`D:\projet\angular project\das\das-admin` ou `E:/das/das-admin`).

---

## 3. Comment travailler avec ce repo (règles)

Ces règles priment sur les habitudes génériques.

1. **Fichiers complets, jamais de diff.** Toute correction rend le **contenu intégral** du
   fichier. La copie locale d'Ashraf fait autorité ; considère ton contexte comme périmé sur
   l'état des fichiers — demande le fichier courant avant de le réécrire.
2. **Convention 3 fichiers par composant** : `.ts` (avec `templateUrl` + `styleUrl`), `.html`,
   `.scss` séparés. **Jamais** de template ni de style inline.
3. **Pattern facade strict.** Un composant **n'injecte jamais** `Store` directement. Il passe
   par une facade (`providedIn: 'root'`). Les ports d'API sont fournis à la racine
   (`app.config.ts`).
4. **Toggle mock / réel** : factory `useMockApi()` dans `app.config.ts`. Changer d'environnement
   = **zéro changement de code**. Le code doit rester correct dans les deux branches.
5. **i18n discipline** : toute clé ajoutée/supprimée l'est **symétriquement en fr ET en**.
   Éviter les collisions feuille/sous-map. Corriger une collision par **renommage de clé**
   (ex. `occupancy → occupancyCol`), pas par restructuration.
6. **Travail fichier par fichier**, itératif. Corriger immédiatement une hypothèse fausse plutôt
   que d'empiler.
7. Réponses **concises** ; prose en français pour l'équipe. Signaler explicitement tout écart
   entre une consigne et le guide **avant** de coder.

---

## 4. Architecture front

**Feature NgRx + facade** (module `registry` = écran adresses, cf. §7) :
`models/` · `services/` (`*-api.port.ts` abstrait + `*-api.service.ts` HTTP) ·
`store/` (`*.actions.ts`, `*.reducer.ts` via `createFeature`, `*.effects.ts`, `*.selectors.ts`,
`*.state.ts`, `*.facade.ts`).

- Le composant lit des `Observable`/`Signal` exposés par la facade et appelle des méthodes de la
  facade. Il ne connaît ni actions ni sélecteurs.
- Les effets **relisent l'état** (`concatLatestFrom`) plutôt que de trimballer l'état dans les
  payloads d'action quand c'est déjà dans le store (ex. `selectedIds`, filtres/pagination).

**Carte — séparation fondamentale, à ne jamais confondre :**
- **Tuiles Martin** = fond de contexte / basemap. Attributs en **PascalCase** (casse SQL exacte),
  `promoteId: "Id"`. Filtrage par `setFilter` sur les couches tuiles.
- **GeoJSON depuis l'API** = overlays colorés par le workflow.
- **`feature-state`** est réservé aux **overrides live et à la sélection**. La coloration de base
  est **bakée dans `map-style.json`** (`match` sur `status`/`workflowStage`), pas en feature-state
  (sinon style thrash sur gros volumes).
- Le nommage des sources Martin est **exact et sensible à la casse** (`Adresses` ≠ `Adresses.1`,
  simple vs double underscore dans `__TILES_BASE_URL__`). Vérifier les endpoints TileJSON en
  direct — les erreurs de casse échouent **silencieusement**.

**Invariant liste ↔ carte (à ne jamais violer).** La liste (API) et la carte (tuiles) doivent
montrer **le même sous-ensemble** pour une sélection hiérarchique donnée. Concrètement : les
filtres `cityId/communeId/zoneId/quartierId/blocId` de la liste doivent être résolus côté back
via **les mêmes FK aplaties que la vue `adresses_tiles`**. Un écart produit X points sur la carte
et Y lignes dans la liste — divergence **indébogable** depuis le front. Si tu la constates, c'est
un problème de contrat, pas d'affichage.

**Cascade hiérarchique** : `HierarchyCascadeComponent` émet une `HierarchySelection`, découplée de
toute facade. Elle pilote **en même temps** le `setFilter` des couches tuiles et les filtres du
store. Elle s'adapte à la donnée creuse (une Zone vide masque son select au lieu de bloquer).

---

## 5. Modèle de domaine

Hiérarchie : **City → [Commune] → [Zone] → Quartier → Bloc → Adresse.**
- **La commune est facultative** : seule Djibouti-ville est découpée en communes. `communeId: null`
  est un **état normal et définitif**, pas une donnée manquante. `cityId` est le rattachement
  structurant (obligatoire sur un quartier), pas déductible de la commune.
- **Une ville sans commune n'a pas de zone**, donc certains quartiers n'ont **ni commune ni zone** :
  `communeNom`/`zoneNom` nullables partout, à afficher comme une absence, **jamais** à combler.
- `Street` est une **entité autonome**, pas un niveau. `Arrondissement` et `Lot` sont **supprimés**.
- Une `Zone` raffine une commune (`zoneId` exige `communeId`).

**Étapes de workflow** (`workflowStage`, **minuscules** en lecture) :
`registered → surveyed → verified → approved → published`.
Dérivation : `registered` = aucun relevé **ou dernier relevé rejeté** ; `surveyed` = dernier relevé
Draft/Submitted ; `verified` = dernier relevé Validated ; `approved`/`published` = décision
back-office. Un relevé **rejeté retombe sur `registered`**, pas `surveyed`.

> **Dérivation unique, deux canaux.** Cette règle de dérivation doit être **identique côté tuile
> (`adresses_tiles`) et côté API (`AdresseResponse`)**, idéalement factorisée côté back. Si les
> deux divergent, une adresse peut apparaître verte sur la carte et « surveyed » dans la liste —
> incohérence visible par l'utilisateur, insoluble côté front.

**Codes** (à lire, jamais à recomposer côté front) : `postcode` (dérivé, nullable),
`addressCode` (`Ville-Quartier-Bloc-Numéro`, numérique, **`null` tant que pas validé Definitive**),
`libelle` (libellé humain, toujours présent → repli d'affichage quand `addressCode` est `null`).

---

## 6. Contrat API — les pièges qui coûtent cher

- **Préfixe `/api` sur toutes les routes.** `apiBaseUrl` doit l'inclure → `…/api/adresses`.
- **Nommage mixte assumé** : `blocs` (pas `blocks`), `adresses` (pas `addresses`). Champs FR sur
  `Quartier`/`Adresse` (`nom`, `numero`, `libelle`), EN sur `City`/`Commune`/`Zone`.
- **Enums = chaînes, jamais nombres** (`"status": "InProgress"`), y compris en query.
- **Dates UTC suffixe `Z`** (`...AtUtc`). Exception : les dates limites de campagne sont des
  **dates** à minuit **heure de Djibouti (UTC+3)** — ne pas comparer en UTC naïf.
- **Géométries en WKT / SRID 4326** sur le CRUD géo (⚠️ le module adresses, lui, porte du GeoJSON).
- **Pagination** : enveloppe **`{ items, total, page, pageSize }`** (convention transverse).
  `pageSize` **plafonné à 200**, `page` commence à 1. `total` = lignes après filtrage. Pas de
  `pageCount` renvoyé → **recalculé au sélecteur**.
- **Auth JWT Bearer.** `refresh` fait **tourner** le refresh token : stocker celui de la réponse,
  **sérialiser les refresh concurrents** (deux onglets = révocation totale).
- **Erreurs** : métier = `{ code, message }` → **tester `code`**, jamais `message`. Validation =
  `ValidationProblemDetails` avec clés **PascalCase**. Un `403` peut dépendre de la donnée, pas
  seulement du rôle — ce n'est pas forcément un bug d'affichage.
- **Rôles** : `Admin`, `Superviseur`, `AgentTerrain`, `Gestionnaire` (cumulables ; lire les claims
  multiples).
- **Casse des valeurs de filtre à vérifier en direct.** La lecture de `workflowStage` est en
  minuscules, mais la casse attendue par le **filtre `filters.status`** (dans `POST /search`)
  n'est pas confirmée — la vérifier contre l'API réelle avant de câbler, un mismatch échoue en
  `400` (cf. §7, piège C.3).

---

## 7. Le module « adresses » (dossiers `registry.*`)

L'écran adresses vit historiquement sous le nom de code **`registry`** (`registry.models.ts`,
`RegistryFacade`, `das-registry-list`, clés i18n `registry.*`).

> ### ❗ Dette à résorber : renommer `registry → adresse`
> Le nom de code `registry` **ne correspond plus au domaine** (« registry » était le vocabulaire
> de l'écran, pas la ressource — l'entité réelle est `Adresse`, la route `/api/adresses`). Ce
> décalage est une **dette à résorber** : à terme, tout le module doit passer en `adresse.*`.
> - **Décision** : renommage du **module entier** (fichiers, dossiers, `Registry*` → `Adresse*`,
>   clés i18n `registry.*` → `adresse.*`, sélecteur `das-registry-list` → `das-adresse-list`),
>   en **`adresse` au singulier**.
> - **Statut** : décidé, **en pause** — planifié comme un lot séparé, à ne pas mélanger avec du
>   travail de logique (un renommage noyé dans une refonte fonctionnelle rend la revue infaisable).
> - **Contrainte d'exécution** : refactor mécanique **scopé à `src/` uniquement**, via un script
>   bash avec **dry-run** d'abord. **Jamais à la racine du repo** : on y réécrirait les références
>   Docker/DockerHub/Jenkins/CI qui portent aussi le mot `registry`.
> - **Ricochets à surveiller** : `nav.registry` → `nav.adresse`, un éventuel `path: 'registry'` de
>   route (**l'URL passe de `/registry` à `/adresse`**), et les types `Address*` qui ne bougent
>   PAS d'eux-mêmes (ne contiennent pas « registry »).
> - **Convention de graphie (coexistence assumée)** : les **artefacts Angular** (composant,
>   facade, feature, i18n, sélecteur) passent en **`Adresse*` / `adresse.*`** (français, aligné sur
>   la route). Les **types de modèle qui calquent le payload** restent en **`Address*`** (anglais)
>   jusqu'à un éventuel second passage `Address* → Adresse*`, optionnel et plus délicat. Donc
>   `AdresseListComponent` (écran) et `AddressListItem` (modèle) **cohabitent par règle**, pas par
>   accident — ne pas « corriger » l'un sans l'autre au fil de l'eau.

Faits durables du contrat de cet écran (`/api/adresses`, guide §5) :

- **Casse `workflowStage` (piège C.3)** : **lecture + filtre `status` + filtre tuile = minuscules**
  (`verified`) ; **écriture `PATCH /bulk` `stage` = PascalCase** et **uniquement `Approved` |
  `Published`**. `BulkUpdatePayload.stage` est typé `'Approved' | 'Published'`, pas
  `AddressWorkflowStage`. (La casse exacte de `filters.status` reste à confirmer en direct, cf. §6.)
- **7 routes → 5 vivantes.** `POST /approve` et `POST /{id}/flag` **ne sont pas implémentées** :
  approuver = `bulk { stage: 'Approved' }` ; signaler = `POST /api/surveys/{id}/reject` (écran de
  validation, plus tard). Les retirer des services/facade/actions/effects.
- **Liste = `POST /api/adresses/search`** (corps `{ filters, page, pageSize }`) — **pas** un `GET`.
  Le `list()` actuel (déjà POST) correspond au contrat : ne pas le migrer.
- **Pas d'action de masse hors `approved`/`published`.** Les étapes `registered/surveyed/verified`
  se **déduisent d'un relevé** et ne sont pas inscriptibles ; la validation se traite **un élément
  à la fois avec photos** (via `/api/surveys`), pas en cases à cocher.
- **`street` toujours `null`** → colonne retirée de la liste, ligne retirée du drawer, `kind`
  `'street'` retiré de `linked`. **Ajuster la grille CSS** de `.thead/.trow` (`grid-template-columns`)
  au nombre réel de colonnes — une colonne retirée sans ajuster la grille décale tout l'alignement.
- **`geom` toujours `null`** (la carte vient des tuiles).
- **`propertyType`** = **libellé FR d'un catalogue** (« Villa », « Immeuble mixte »…), pas un enum
  fermé. Affiché **brut** en attendant une clé stable back (décision C.4) ; pas de `registry.type.*`.
- **`validation.score`** = **nombre de relevés** de l'agent (pas une note /100) ; `percentage`
  **peut dépasser 100**. Bloc **masqué** dans le drawer (décision C.2) — et surtout **retirer le
  rendu `[style.width.%]="d.validation.score"`**, qui traitait `score` comme un pourcentage.
- **KPIs** : les **4 d'origine sont conservés** (`totalRecords`, `pendingReview`,
  `duplicatesFlagged`, `publishedToday`). `publishedToday` est **réel** (journée UTC+3, cycle de
  publication livré) — **ne pas** le renommer en `verified`. Seul **le libellé** de
  `duplicatesFlagged` change → **« À revoir »** (il compte des **relevés rejetés**, pas des doublons).
- **`history` toujours `[]`** (aucun journal d'audit) → pas d'onglet, **pas de clés `history.*`**.
- **`assignedTeamName`** = nom d'un **agent** (pas d'équipe), **lecture seule**. **Colonne et filtre
  `team` conservés** (le back fournit `filter-options.teams`) ; **seul le bulk équipe disparaît**
  (`changeTeam`). Réaffecter passe par le bloc-en-campagne, jamais par l'adresse.
- Champs `components` : le back envoie **`quartierNom`** (pas `quartier`). `region` = nom de la ville.
- **`location.parcelNumber` = le `numero` de l'adresse** (même donnée, pas un champ séparé).

---

## 8. Déploiement / infra (rappels, hors périmètre code)

- **Staleness de bundle** : des hash de chunks inchangés après un déploiement = le build n'a pas
  atteint le conteneur. Toujours vérifier le changement de hash.
- **CRLF casse les scripts shell en Docker sous Windows** : `.gitattributes` + durcissement `sed`
  dans le Dockerfile.
- **OOM sur l'EC2** provoque des redémarrages Jenkins en plein build (`MissingContextVariableException`
  trompeur) : vérifier `docker ps` + endpoints de santé **avant** de conclure à un échec.
- `das-admin` (nginx) sert de **reverse proxy** pour toute la stack.

---

## 9. À NE PAS faire

- ❌ Injecter `Store` dans un composant. ❌ Template/style inline.
- ❌ Recomposer `postcode`/`addressCode`/`libelle` côté front — les **lire**.
- ❌ Mettre la coloration de base en `feature-state`. ❌ Confondre tuiles Martin et GeoJSON API.
- ❌ Envoyer `stage` en minuscules à `/bulk`, ou une valeur autre que `Approved`/`Published`.
- ❌ Traiter `validation.score` comme un pourcentage (c'est un décompte de relevés).
- ❌ Migrer `list()` en `GET` — le contrat est `POST /search`.
- ❌ Rajouter des clés i18n dans une seule langue.
- ❌ Lancer le renommage `registry → adresse` à la racine du repo.
- ❌ Ajouter de l'import de données géo côté front.
