# Lot : tag « mock », édition d'adresse, écran codes postaux

> **Nature du fichier.** Spec d'exécution du lot en cours, à respecter pendant l'implémentation.
> Contrairement aux autres fichiers de `docs/plans/` (un par module, durables), celui-ci couvre
> trois chantiers liés par un même objectif : **rendre visible et honnête l'état de câblage
> back**, puis câbler deux écrans qui ne le sont pas.
>
> **Source de vérité du contrat** : la source C# de `dasApi` (lue le 2026-08-23), pas
> `docs/openapi-v1.json` qui dérive du réel (cf. `dasApi/docs/reste-a-faire-back.md` §2.4).
> En cas de doute sur une route, relire la source, pas ce fichier.

---

## Partie 0 — État de câblage constaté (2026-08-23)

Routes réellement exposées par `dasApi`, relevées dans `src/DASApi.WebApi/Features/**/*Endpoints.cs` :

```
/api/auth/{login,refresh,logout}
/api/adresses  (GET · POST · GET/{id} · PATCH/{id} · PATCH/bulk · DELETE/{id} · GET/summary · GET/filter-options · POST/search)
/api/blocs  (CRUD)              /api/blocs/suggestions  (GET · POST · approve · reject)
/api/streets  (CRUD)            /api/streets/suggestions  (idem)
/api/cities · /api/communes · /api/zones · /api/quartiers   (CRUD chacun)
/api/units  (CRUD)
/api/surveys  (+ stalled · current · productivity · suspicious · photos · submit · validate · reject · request-correction)
/api/campaigns  (+ progress · start · assignments · addresses · extend · close · PATCH)
/api/campaigns/{id}/blocs · /api/campaign-blocs/transfer · /api/campaign-assignments  (GET · abandon)
/api/users  (GET · POST · PATCH/{id}/roles · PATCH/{id}/status)
/api/types-occupation · /api/etats-occupation
```

Confrontées aux services front (`src/app/core/**/[!mock-]*-api.service.ts`) :

| Module front | Cible HTTP | État |
|---|---|---|
| `auth` | `/api/auth` | ✅ câblé |
| `adresse` | `/api/adresses` | ✅ câblé (sauf **création**, cf. partie 2) |
| `blocks` | `/api/blocs` | ✅ câblé |
| `addressing` | `/api/blocs`, `/api/streets`, suggestions | ✅ câblé |
| `review` (écran verification) | `/api/surveys` | ✅ câblé |
| `fieldops` | `/api/campaigns`, `/api/campaign-*` | ✅ câblé |
| `staff` | `/api/users`, `/api/surveys/productivity` | ✅ câblé |
| `hierarchy` | `/api/cities`, `/communes`, `/zones`, `/quartiers` | ✅ câblé |
| `reference` | `/api/types-occupation`, `/etats-occupation` | ✅ câblé |
| `units` | `/api/units` | ✅ câblé |
| `dataquality` | `/api/surveys/suspicious` | ✅ câblé |
| `dashboard` | composé (`adresses/summary` + `campaigns/progress`) | ✅ câblé |
| **`postcodes`** | `/api/postcodes` | ❌ **route inexistante** → refonte, partie 3 |
| **`notifications`** | `/api/notifications` | ❌ route inexistante |
| **`reports`** | `/api/reports`, `/export`, `/generate` | ❌ route inexistante |
| **`audit`** | `/api/audit` | ❌ route inexistante |
| **`clients`** | `/api/clients`, `/subscription-plans`, `/zone-access` | ❌ route inexistante |
| **`integrations`** | `/api/integrations` | ❌ route inexistante |
| **`settings`** | `/api/road-types`, `/api/map-import` | ❌ route inexistante |

**Le problème concret à résoudre.** Avec `useMockApi: false`, les 7 modules du bas appellent des
routes qui n'existent pas : l'écran se charge, part en `404`, et affiche un état d'erreur ou une
liste vide — indistinguable d'un vrai bug. Rien à l'écran ne dit « cette page n'est pas encore
branchée ». C'est ça qu'on corrige en partie 1.

---

## Partie 1 — Registre de câblage + tag « mock »

### 1.1 Principe

Une **déclaration unique** de l'état de câblage par module, qui pilote deux choses à la fois :

1. **le choix du service** — un module non câblé consomme le mock **même quand `useMockApi` est
   `false`**, au lieu de partir en 404 ;
2. **l'affichage d'un badge « Mock »** dans l'en-tête de l'écran concerné.

Une seule ligne à changer le jour où le back arrive : passer `'mock'` → `'wired'` retire le badge
*et* bascule sur le vrai service. C'est le point de la manœuvre — pas deux endroits à penser.

### 1.2 `src/app/core/config/backend-readiness.ts` (nouveau)

```ts
export type FeatureKey =
  | 'adresse' | 'blocks' | 'addressing' | 'review' | 'fieldops' | 'staff'
  | 'hierarchy' | 'reference' | 'units' | 'dataquality' | 'dashboard'
  | 'postcodes' | 'notifications' | 'reports' | 'audit' | 'clients'
  | 'integrations' | 'settings';

export type BackendStatus = 'wired' | 'mock';

export interface FeatureReadiness {
  status: BackendStatus;
  /** Routes réelles consommées. Vide si `mock`. Sert de trace, pas de contrôle runtime. */
  routes: string[];
  /** Pourquoi ce n'est pas câblé — affiché en infobulle du badge. Clé i18n. */
  noteKey?: string;
}

export const BACKEND_READINESS: Record<FeatureKey, FeatureReadiness> = { /* … */ };
```

Règles à respecter :

- **`status: 'wired'` engage.** Ne le poser que si *toutes* les méthodes du port tapent une route
  qui existe. Un module à moitié câblé reste `'mock'` — ou est découpé en deux ports. Pas de
  troisième état `'partial'` : il produirait un écran qui ment à moitié, ce qui est précisément
  ce qu'on essaie d'éliminer.
- **`routes` se relit à la main** contre la source `dasApi`. Ce champ n'est pas vérifié à
  l'exécution ; il documente ce qu'on croit vrai, et c'est ce qu'on relira à la prochaine revue
  de couplage.
- Le fichier est **la seule** source de cette information. Pas de `// TODO: real service` épars
  dans les `*.routes.ts` (il en reste un dans `postcodes.routes.ts`, à supprimer).

### 1.3 Sélection du service

Helper dans le même fichier :

```ts
/** true si l'écran doit consommer le mock : toggle global OU absence de back câblé. */
export const shouldUseMock = (feature: FeatureKey): boolean =>
  inject(AppConfigService).get('useMockApi') || BACKEND_READINESS[feature].status === 'mock';
```

Puis dans `app.config.ts`, remplacer `useMock()` par `shouldUseMock('<feature>')` sur les
providers concernés. Le toggle `useMockApi` garde son rôle exact (tout en mock) ; le registre ne
fait qu'ajouter des exceptions dans un seul sens — jamais l'inverse, un module `'mock'` ne doit
jamais pouvoir taper le réseau.

`PostcodesApiPort` est aujourd'hui fourni **deux fois** : dans `app.config.ts` et dans
`postcodes.routes.ts` (où il force le mock avec un TODO). Garder **un seul** point de
fourniture — celui de `app.config.ts` — et retirer l'override de la route.

### 1.4 Badge

- Composant `das-mock-badge` dans `core/ui/` — 3 fichiers (`.ts`/`.html`/`.scss`), pas d'inline
  (CLAUDE.md §3.2). Entrée : `feature: FeatureKey`. Ne rend **rien** si `status === 'wired'`.
- Branché dans `PageHeaderComponent` via une entrée optionnelle `feature`, pour que le badge
  apparaisse au même endroit sur tous les écrans sans les modifier un par un.
  `PageHeaderComponent` est déjà utilisé par ~20 écrans : c'est le point d'accroche naturel.
- Visuel : pastille discrète à côté du titre (fond ambre, texte court « Mock »), avec l'infobulle
  `noteKey`. Elle doit se lire comme une information de développement, pas comme une alerte
  d'erreur — l'écran fonctionne, il montre juste des données factices.
- i18n : `common.mockBadge` + `common.mockBadgeHint` en **fr et en** (CLAUDE.md §3.5).

### 1.5 Ce qu'on ne fait pas

- Pas d'écran d'administration listant l'état de câblage. Le registre se lit dans le code et le
  badge le montre à l'écran ; une troisième vue serait un troisième endroit à maintenir.
- Pas de détection automatique (parser les URLs des services au build pour les comparer à
  l'OpenAPI). Séduisant, mais l'OpenAPI local dérive déjà du réel — on bâtirait un contrôle
  automatique sur une référence fausse. À reconsidérer si `dasApi` publie sa spec en CI
  (cf. `dasApi/docs/reste-a-faire-back.md` §2.4).

---

## Partie 2 — Écran adresses : **édition**, pas création

### 2.0 Décision du 2026-08-23 — on ne crée plus d'adresse depuis le front

> **Arbitrage du responsable projet.** Les adresses **ne se créent pas depuis l'interface** :
> elles entrent par la reprise cadastre et sont **numérotées automatiquement par le back**
> (séquentiel par bloc à l'import — c'est déjà ce qu'annonce `addressing.numberingHint`).
> Le front ne fait que **modifier de l'existant**.

Cette décision est cohérente avec l'état réel de la base (relevé le 2026-08-23) :

| | Cadastre (PostGIS brut) | Référentiel (EF) | Couverture |
|---|---|---|---|
| Parcelles → `Adresses` | `das_parcelles` : **28 474** | **2 512** | 8,8 % |
| Îlots → `Blocs` | `das_ilots` : **3 700** | **309** | 8,4 % |
| Quartiers | **69** | **6** | — |

Chiffre trompeur si on s'arrête là. En réalité **le référentiel ne couvre qu'un seul quartier,
et il le couvre presque intégralement** :

| Quartier 7 (seul quartier peuplé) | Cadastre | Référentiel | Couverture |
|---|---|---|---|
| Îlots → Blocs | 309 | 309 | **100 %** |
| Parcelles → Adresses | 2 547 | 2 502 | **98,2 %** |

Les 5 autres quartiers du référentiel (`Château d'eau`, `Cheik Moussa`, `Einguela`,
`Quartier Ali`, `Quartier Shell`) sont des **coquilles vides** : 0 bloc, 0 adresse.

Donc : **périmètre pilote = Quartier 7, traité à fond.** Pas une reprise bâclée. Faire entrer les
68 autres quartiers = rejouer le script PostGIS qui a produit Q7 — un travail back/outillage, que
CLAUDE.md §1 exclut explicitement du front. **Ne rien construire côté front qui suppose leur
arrivée.**

*(Corollaire à remonter côté back : `A1` de `dasApi/docs/failles-recensement.md` — « le socle est
alimenté à la main par le Gestionnaire », « aucune campagne ne peut couvrir plus de parcelles que
le Gestionnaire n'en a créées une par une » — est **périmé**. Il y a 28 474 parcelles en base. Le
sujet n'est pas la saisie manuelle, c'est le rapprochement cadastre → référentiel.)*

### 2.1 Contrat d'édition

```
PATCH /api/adresses/{id}
Body : { numero: int, boundaryWkt: string }
→ 200 AdresseResponse
```

Validation back (`UpdateAdresseRequestValidator`) :

- `numero` **> 0**, et **unique dans le bloc** → sinon **409** ;
- `boundaryWkt` **obligatoire et non vide**, `MULTIPOLYGON`/`POLYGON` WKT, SRID 4326.

> ⚠️ **Remplacement complet, malgré le verbe `PATCH`.** Les deux champs sont exigés à chaque
> appel. Pour ne changer que le numéro, il faut **renvoyer la géométrie existante à l'identique**.
>
> **Et surtout : ne jamais reconstruire ce WKT depuis la tuile vectorielle.** Une tuile est
> simplifiée et découpée aux bords — une parcelle à cheval sur deux tuiles y est tronquée. On
> écrirait une géométrie fausse dans le référentiel national. La seule source acceptable est le
> `boundaryWkt` renvoyé par `GET /api/adresses/{id}`.

Le bloc de rattachement (`blocId`) **n'est pas modifiable** par cette route : déplacer une
parcelle d'un bloc à l'autre changerait son `addressCode`. Ne pas exposer de champ bloc éditable.

Permission : `adresses.update` → **Gestionnaire** (+ Admin par bypass). Masquer l'action pour les
autres rôles plutôt que de laisser un bouton qui finit en 403.

### 2.2 Travail à faire

- **`AddressDetail` doit porter `boundaryWkt`.** Le modèle front ne l'expose pas aujourd'hui,
  alors que `AdresseDetailResponse` le renvoie déjà. Sans ce champ, l'édition du numéro est
  impossible (rien à renvoyer dans le body). C'est le prérequis technique du lot.
- `AdresseApiPort` : ajouter `update(id, payload: UpdateAdressePayload)`.
  `MockAdresseApiService.update()` doit **reproduire le 409 d'unicité du numéro dans le bloc** —
  sinon le seul cas d'erreur corrigeable par l'opérateur n'est jamais testable en mock.
- Store : `updateAdresse` / `...Success` / `...Failure`, avec rechargement du détail **et** de la
  page en cas de succès (la ligne de liste affiche le numéro).
- **Erreur mappée par `code`, jamais par `message`** (CLAUDE.md §6) : le 409 → clé i18n dédiée
  (« Ce numéro est déjà utilisé dans ce bloc »), pas un `common.error` générique.
- UI : édition du numéro depuis le tiroir de détail (`address-detail-drawer`), qui affiche déjà
  la fiche complète. Pas de nouvel écran. Le bouton « Modifier » du tiroir existe déjà **et ne
  fait rien** — c'est lui qu'on branche.
- **Les 4 boutons morts de l'en-tête de liste** (`adresse-list.component.html`) :
  - *Créer une adresse* → **retiré** : décision §2.0, les adresses ne se créent plus ici ;
  - *Importer* → contredit CLAUDE.md §1 (« pas d'import de données géo côté front ») ;
  - *Fusionner doublons* → aucune route de déduplication ;
  - *Exporter* → aucune route d'export.
  → **Les quatre partent.** Un bouton mort dans une barre d'action est un bug d'interface : il
  promet une fonction qui n'existe pas.

---

## Partie 3 — Écran « Codes postaux » (refonte complète)

### 3.1 Le modèle actuel est faux de bout en bout

`core/postcodes/models/postcodes.models.ts` décrit : un code au format `"PC 1001"`, un statut
`active | reserved | retired`, une date d'émission, un histogramme mensuel d'émissions, et une
action « allouer un code postal ». **Rien de tout cela n'existe** — ni côté back, ni dans le
domaine.

### 3.2 Le modèle réel

Règle donnée par le responsable projet le 2026-08-18, implémentée dans `PostcodeGenerator` :

```
code postal = City.Code (2 chiffres, zéro-padé) + Quartier.AreaNumber (3 chiffres, zéro-padé)
  Djibouti (77), quartier 101 → 77101
  Djibouti (77), quartier 7   → 77007
```

Trois conséquences qui commandent tout l'écran :

1. **Un code postal ne s'alloue pas, il se calcule.** Il n'est **jamais stocké**. La seule façon
   d'agir dessus est de modifier ses deux composants : `City.Code` ou `Quartier.AreaNumber`.
2. **`null` est un état réel et fréquent** : `PostcodeGenerator.Generate()` renvoie `null` dès
   qu'un composant manque, délibérément — un `AreaNumber` absent concaténé donnerait `"77000"`,
   *syntaxiquement valide et faux*. Le commentaire back est sans ambiguïté : « un code postal
   absent se rattrape ; un code postal faux se propage jusqu'au courrier ». **Ne jamais combler
   un `null` côté front**, ni par un placeholder qui ressemble à un code.
3. **Le vrai sujet de l'écran, c'est la complétude.** Les quartiers antérieurs au 2026-08-12 et
   les villes antérieures au 2026-08-18 n'ont pas de numéro / de code, et sont « en attente de
   reprise » (dixit les commentaires de `QuartierResponse` et `CityResponse`). L'écran sert à
   **voir ce qui manque et à le corriger**, pas à émettre des codes.

### 3.3 Sources de données

```
GET /api/quartiers?cityId=&communeId=&zoneId=
→ QuartierResponse { id, nom, code, areaNumber: int|null, postcode: string|null,
                     cityId, communeId: UUID|null, zoneId: UUID|null, boundaryWkt: string|null }
   ↑ le back calcule déjà `postcode` : le front le LIT, il ne le recompose pas (CLAUDE.md §9).

GET /api/cities
→ CityResponse { id, name, code: int|null, boundaryWkt }
```

### 3.4 Écriture — deux routes, deux pièges

**Corriger le numéro d'un quartier :**

```
PATCH /api/quartiers/{id}
Body : { nom, code?, areaNumber, cityId, communeId?, zoneId?, boundaryWkt? }
```

> ⚠️ **C'est un remplacement complet, pas un patch partiel** malgré le verbe. N'envoyer que
> `areaNumber` écraserait le nom et le rattachement. **Repartir de la ligne courante et ne
> changer que `areaNumber`.**

- `areaNumber` ∈ **[1, 999]** (il forme les 3 derniers chiffres) ;
- **unique dans la ville** → 409 `Quartiers.AreaNumberAlreadyUsed` ;
- `cityId` **non modifiable** → 400 `Quartiers.CityNotChangeable` (déplacer un quartier casserait
  les libellés d'adresse déjà émis) : ne pas exposer de champ ville éditable ;
- `code` (ex. `"GB"`) est le **code du quartier**, *pas* le code postal — deux notions distinctes
  dans la même ligne, ne pas les confondre à l'affichage. Omis, il est conservé.

**Corriger le code d'une ville :**

```
PATCH /api/cities/{id}
Body : { name, code, boundaryWkt? }     — code ∈ [1, 99], même logique de remplacement complet
```

Modifier le code d'une ville **change le code postal de tous ses quartiers d'un coup**. L'écran
doit le dire avant confirmation (« N quartiers seront renumérotés »), pas laisser découvrir.

Permissions : `quartiers.update` / `cities.update` → **Gestionnaire** (+ Admin). Le Superviseur
est en lecture seule sur cet écran : masquer les actions d'édition selon le rôle.

### 3.5 L'écran cible

- **KPIs** : quartiers avec code postal / sans (`areaNumber` ou `city.code` manquant) / villes
  sans code. Trois chiffres qui disent l'état de complétude du référentiel.
- **Tableau** : quartier · ville · `code` quartier · `areaNumber` · **code postal dérivé** ·
  état. Filtrable par ville, et « sans code postal uniquement » (c'est la file de travail réelle).
- **Édition en ligne** de `areaNumber`, avec le 409 rendu lisible (« ce numéro est déjà pris dans
  cette ville »).
- **Bloc villes** : liste des villes et leur code, éditable, avec l'avertissement de propagation.
- **À supprimer** : `PostcodeStatus` (et son entrée dans `das.models.ts` si plus aucun usage),
  `issuedAt`, `addressCount`, l'histogramme mensuel, le formulaire d'allocation, le format
  `"PC ..."` et sa regex de validation.
- i18n : purge symétrique fr/en des clés `postcodes.*` obsolètes, ajout des nouvelles.
- Le module **garde son nom et sa route** (`/postcodes`, `core/postcodes`) — même précédent que
  `field-operations`, reconstruit sans être renommé : un renommage est un lot à part, jamais
  mélangé à une refonte fonctionnelle.
- Une fois câblé : `postcodes` passe à `'wired'` dans le registre → le badge disparaît de
  lui-même. C'est le premier module à faire la transition, il sert de démonstration.

---

## Ordre d'exécution

1. **Partie 1** (registre + badge). Indépendante, livre de la valeur seule, et met les 7 écrans
   non câblés dans un état honnête immédiatement.
2. **Partie 3** (codes postaux). Aucune décision en suspens, et une valeur immédiate mesurable :
   `Cities.Code` est `NULL` sur les 2 villes et `AreaNumber` est `NULL` sur les 6 quartiers —
   **aucun code postal n'est calculable aujourd'hui**. 8 valeurs à saisir dans cet écran, et les
   2 512 adresses en gagnent un d'un coup.
3. **Partie 2** (édition d'adresse). Débloquée depuis l'arbitrage du 2026-08-23 ; le prérequis
   est d'exposer `boundaryWkt` sur `AddressDetail`.

Aucune modification de `dasApi` n'est nécessaire dans ce lot : les trois parties tiennent sur des
routes existantes.

## Vérification (à chaque partie)

- `npx ng build --configuration development` — 0 erreur (Node ≥ 20.19 : `nvm use 24.19.0`).
- `npx ng test --watch=false` — suite au vert.
- Audit i18n : aucune clé utilisée dans un template absente de `fr.json`/`en.json`, et symétrie
  fr/en parfaite.
- Les deux modes (`useMockApi` à `true` et `false`) doivent rester corrects — c'est le point de
  la partie 1, il se vérifie en basculant le toggle.
