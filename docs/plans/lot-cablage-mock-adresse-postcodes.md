# Lot : tag « mock », création d'adresse, écran codes postaux

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

## Partie 2 — Écran « Créer une adresse »

### 2.1 État actuel

`adresse-list.component.html` porte 4 boutons d'en-tête — **Importer, Fusionner doublons, Créer,
Exporter** — dont **aucun n'a de handler**. Ce sont des boutons morts depuis l'origine.

### 2.2 Contrat réel

```
POST /api/adresses
Body : { blocId: UUID, numero: int, boundaryWkt: string }
→ 201 AdresseResponse { id, blocId, numero, boundaryWkt, locationWkt,
                        blocCode, blocName, quartierNom, cityName, libelle }
```

Validation back (`CreateAdresseRequestValidator`) :

- `blocId` non vide ;
- `numero` **> 0**, et **unique dans le bloc** → sinon **409** ;
- `boundaryWkt` **obligatoire**, `MULTIPOLYGON` ou `POLYGON` WKT valide, SRID 4326.
  Message back explicite : *« une parcelle sans emprise n'a pas de position »*.

Permission : `adresses.create` → **Gestionnaire** (+ Admin par bypass). Un Superviseur reçoit un
403 : masquer l'action pour les rôles qui ne l'ont pas, plutôt que de laisser un bouton qui échoue.

### 2.3 Décision ouverte — comment produire `boundaryWkt` ⚠️

C'est **le** point bloquant du chantier, et c'est une décision produit, pas technique. Trois
options, à trancher avant de coder :

| Option | Ce que ça donne | Coût |
|---|---|---|
| **A. Clic sur la carte → carré généré** | L'opérateur place un point, le front en fait un petit carré (~30 m). Aucune dépendance. C'est déjà ce que fait `squareMulti()` dans `mock-adresse-api.service.ts`. | Faible |
| **B. Dessin libre du polygone** | Emprise réelle de la parcelle. Nécessite une lib de dessin (MapLibre n'en a pas ; `terra-draw` ou fork de `mapbox-gl-draw`) → décision de dépendance. | Moyen |
| **C. Saisie WKT brute** | Champ texte. Utilisable seulement par quelqu'un qui a déjà le WKT. | Nul |

**Recommandation : A pour la v1**, B en second lot si le besoin d'emprise fidèle se confirme.
Raison : le carré est une approximation *assumée et visible*, alors que l'absence d'écran de
création bloque complètement la saisie du socle — or `A1` (`dasApi/docs/failles-recensement.md`)
rappelle que **tout le recensement dépend du volume d'adresses saisies à la main**. Débloquer la
saisie prime sur la fidélité du contour, qui pourra être reprise plus tard par le terrain.

> ⚠️ **À confirmer avec le responsable projet avant implémentation.** Si des carrés approximatifs
> sont inacceptables dans le référentiel national, c'est B, et le lot change de taille.

### 2.4 Travail à faire

- `AdresseApiPort` : ajouter `create(payload: CreateAdressePayload): Observable<CreatedAdresse>`.
  Nouveaux modèles dans `adresse.models.ts` — ne **pas** réutiliser `AddressListItem` :
  `AdresseResponse` a une forme différente (pas de `workflowStage`, pas de `lastUpdate`).
- `AdresseApiService.create()` → `POST /api/adresses`. `MockAdresseApiService.create()` → ajoute
  au tableau en mémoire, avec la **même règle d'unicité du numéro dans le bloc** (le mock doit
  reproduire le 409, sinon le cas d'erreur ne se teste jamais).
- Store : action `createAdresse` / `createAdresseSuccess` / `createAdresseFailure`, effet qui
  enchaîne sur `loadPage()` en cas de succès (la liste doit montrer la nouvelle ligne).
- **Mapping d'erreur par `code`, jamais par `message`** (CLAUDE.md §6) : le 409 back porte un
  code métier → clé i18n dédiée (« Ce numéro existe déjà dans ce bloc »), pas un `common.error`
  générique. C'est la seule erreur que l'opérateur peut corriger lui-même, elle doit être lisible.
- UI : formulaire en tiroir/modale — sélection du bloc via `HierarchyCascadeComponent` (déjà
  découplé, cf. CLAUDE.md §4), champ `numero`, carte de placement (option A).
- **Les 3 autres boutons.** Aucun back derrière :
  - *Importer* → contredit frontalement CLAUDE.md §1 (« pas d'import de données géo côté front ») ;
  - *Fusionner doublons* → aucune route de déduplication ;
  - *Exporter* → aucune route d'export.
  → **Les retirer.** Un bouton mort dans une barre d'action est un bug d'interface : il promet une
  fonction qui n'existe pas. Les réintroduire le jour où la route existe.

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
2. **Partie 3** (codes postaux) — entièrement spécifiée par des routes qui existent, aucune
   décision en suspens.
3. **Partie 2** (création d'adresse) — **bloquée** tant que la question du `boundaryWkt` (§2.3)
   n'est pas tranchée.

## Vérification (à chaque partie)

- `npx ng build --configuration development` — 0 erreur (Node ≥ 20.19 : `nvm use 24.19.0`).
- `npx ng test --watch=false` — suite au vert.
- Audit i18n : aucune clé utilisée dans un template absente de `fr.json`/`en.json`, et symétrie
  fr/en parfaite.
- Les deux modes (`useMockApi` à `true` et `false`) doivent rester corrects — c'est le point de
  la partie 1, il se vérifie en basculant le toggle.
