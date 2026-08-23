# Contrat API `/adresses` (écran Registry) — recoupement avec le domaine réel

> Réponse au contrat fourni par le front le 2026-08-18 (7 routes REST sur `/api/adresses`).
> Prolonge [`contrat-api-frontend.md`](contrat-api-frontend.md), dont la section **M3 —
> Registre** annonçait déjà ces 7 routes comme « module absent ». Ce document remplace M3 :
> il descend au niveau du champ, ce que la première passe ne faisait pas.
>
> **Version front de ce document** : [`docs/guide-integration-frontend.md`](../guide-integration-frontend.md),
> section 5. Elle décrit les routes livrées et les pièges d'intégration, sans les arbitrages ni
> la dette listés ici. **Les deux fichiers se mettent à jour ensemble.**
>
> **LES 7 ROUTES SONT LIVRÉES (2026-08-18)** — 5 répondent telles quelles, 2 sont couvertes
> autrement (`approve` → `/bulk`, `flag` → `POST /api/surveys/{id}/reject`). Le verdict « 0/7 »
> plus bas est celui de l'analyse initiale, conservé pour la traçabilité du raisonnement.
>
> **IMPLÉMENTÉ le 2026-08-18** — `City.Code`, unicité de `Quartier.AreaNumber`,
> `PostcodeGenerator`, `AddressCodeGenerator` et le gel de `Adresse.AddressCode` à la
> validation définitive sont **en place et compilent** (migration
> `20260818092036_AddCityCodeAreaNumberUniqueAndAddressCode`, **appliquée sur la base de dev**
> le 2026-08-18, avec `City.Code = 77` posé sur Djibouti). Voir §7.
>
> **Q5 / Q6 / Q7 tranchées le 2026-08-18** par le front — voir §5. `region` = `City`,
> `assignedTeamName` = l'agent titulaire du bloc, `geom` en GeoJSON. La réponse à Q6
> résout la **lecture** mais rouvre l'**écriture** : voir §4.8, qui est le point le plus
> important de cette mise à jour.

---

## Verdict en une ligne

**0 route sur 7 est implémentée.** Mais le blocage n'est pas là : **11 champs du contrat ne
correspondaient à aucune donnée du domaine**, et 4 d'entre eux n'étaient pas un oubli
d'implémentation — des concepts jamais modélisés. Écrire les 7 routes ne suffit donc pas ;
il faut d'abord trancher ce qu'on ajoute au modèle.

**Après Q5/Q6/Q7 puis la règle du `postcode` (2026-08-18)** : 3 de ces 11 champs se résolvent
sans rien ajouter au modèle (`region` = `City`, `assignedTeamName` = l'agent titulaire du
bloc, `postcode` = **dérivé** de `City.Code` + `Quartier.AreaNumber`), et `geom` est arbitré.
**8 restent sans contrepartie**, dont `street`, qui demande une décision du responsable
projet.

Deux points neufs sont apparus en tranchant, et ce sont maintenant les plus importants du
document :

- **§4.8** — réassigner depuis une liste d'adresses réaffecterait des **blocs entiers**,
  y compris les adresses non sélectionnées. `PATCH /bulk {team}` doit être refusé.
- **§3.1 / R1** — `Quartier.AreaNumber` n'a **aucune contrainte d'unicité**. Le code postal
  calculé n'est donc pas garanti unique, et l'index qui le corrigerait ne peut pas être posé
  avant la reprise des `AreaNumber` historiques.

Les conventions transverses du contrat sont en revanche **toutes conformes** à ce qu'on fait
déjà : `/api`, JWT, camelCase, ISO 8601 UTC, `id` UUID, 404/400. Rien à négocier de ce côté.

---

## 1. Ce qui est déjà fait

| Élément | État |
|---|---|
| Préfixe `/api`, JWT sur toutes les routes | ✅ conforme |
| camelCase JSON | ✅ conforme (défaut ASP.NET Core, aucune config nécessaire) |
| Dates ISO 8601 UTC, `id` UUID | ✅ conforme |
| `404` sur `{id}` inconnu, `400` sur payload invalide | ✅ conforme (`ErrorResultExtensions`) |
| Hiérarchie `City → Commune → Zone → Quartier → Bloc → Adresse` | ✅ conforme au modèle |
| Règle « `postcode` appartient au quartier, pas à la zone » | ✅ correcte, et confirmée par la règle de calcul : il se dérive de `Quartier.AreaNumber` (§3.1) |
| **§4** `GET /api/adresses/{id}` | ⚠️ la route existe (200/404, permission `adresses.view`), mais renvoie `AdresseResponse` — **aucun** des 6 blocs `components` / `location` / `propertyInfo` / `validation` / `history` / `linked` |
| **§3** filtre `blocId` | ⚠️ existe via `GET /api/adresses?blocId=`, **non paginé**, renvoie tout |

Rien d'autre.

---

## 2. Ce qui manque (implémentable sans toucher au modèle)

Travail normal, sans arbitrage métier :

- **La pagination elle-même.** Aucun de nos **87 endpoints** n'est paginé. `POST /search` ne
  peut pas être la première route paginée sans qu'on pose d'abord une **convention
  d'enveloppe transverse**. Celle proposée par le front (`{ items, total, page, pageSize }`)
  est bonne — on l'adopte pour tous les futurs endpoints de liste, pas seulement celui-ci.
- **Les FK aplaties `cityId / communeId / zoneId / quartierId`.** `Adresse` ne porte que
  `BlocId` ; les quatre autres demandent des jointures (`Adresse → Bloc → Quartier →
  Commune → Zone`). Faisable — `AdresseQueries.Rows` fait déjà `Bloc → Quartier → City`.
  ⚠️ **Piège, et il est permanent** : `Quartier.CommuneId` et `Quartier.ZoneId` sont
  **nullables par conception** — seule Djibouti-ville est découpée en communes (§4.9). Un
  filtre `communeId` exclura donc toujours les quartiers d'Ali Sabieh et des autres villes.
  Ce n'est pas une dette qui se résorbera : la hiérarchie du contrat
  (`City → Commune → Zone → Quartier`) n'a que **deux niveaux garantis**, `City` et
  `Quartier`. Les filtres `communeId` / `zoneId` sont des raffinements applicables à
  Djibouti-ville seulement, et l'UI doit le savoir.
- **`lastUpdate`.** `Adresse` n'a **aucun horodatage** (ni `CreatedAt` ni `UpdatedAt`). Deux
  colonnes à ajouter, ou on dérive du dernier `Survey` — mais alors une adresse jamais
  relevée n'a pas de date.
- **`workflowStage` dérivé** `registered/surveyed/verified` depuis `SurveyStatus`
  (`Draft/Submitted/Validated/Rejected`) : dérivable, avec la réserve du §4.3.
- **`geom` en GeoJSON** (Q7 tranchée) : d'accord aussi sur `null` en liste. Deux conséquences
  concrètes :
  - **Nouvelle dépendance** : `NetTopologySuite.IO.GeoJSON4STJ` n'est pas référencé (on n'a
    que `NetTopologySuite` 2.6.0 et le provider Npgsql). Il faut l'ajouter et enregistrer
    `GeoJsonConverterFactory` dans le `ConfigureHttpJsonOptions` de `Program.cs`, à côté du
    `JsonStringEnumConverter` déjà présent.
  - **L'enregistrer globalement est sans risque** : aucun de nos DTO actuels n'expose un type
    `Geometry` — ils exposent tous des `string` WKT produites par `GeometryWkt.ToWkt`. Le
    convertisseur ne peut donc rien changer à l'existant.
  - En revanche l'API portera **deux représentations géométriques** : WKT sur tout le CRUD
    géographique, GeoJSON sur le Registry. C'est un écart assumé, à documenter dans
    `guide-integration-frontend.md` — sinon le prochain endpoint hésitera.

---

## 3. Ce qui n'existe pas dans le domaine

C'est le vrai contenu de cette revue. Chaque ligne bloque un ou plusieurs champs du contrat.

### 3.1 `postcode` — **dérivé**, pas stocké (règle donnée le 2026-08-18)

Aucun code postal dans la codebase (`grep -rni "postcode\|CodePostal" src/` → 0 résultat).
Mais la règle fournie par le responsable projet évite d'en créer un :

```
postcode = City.Code (numérique, ex. Djibouti = 77) + Quartier.AreaNumber
                                                       ex. 77101, 77102
```

**Bonne nouvelle** : c'est une **projection calculée**, pas une colonne à saisir ni un
référentiel à charger. Aucune reprise de données, aucun écran d'administration. `AreaNumber`
existe déjà sur `Quartier` ; il ne manque que `City.Code`. Ça déclasse `postcode` de
« bloqué sur décision » à « implémentable », **sous trois réserves sérieuses**.

#### R1 — `AreaNumber` n'a **aucune contrainte d'unicité** ⚠️ bloquant

`QuartierConfiguration` pose l'unicité sur `Code` (globale) et sur `(CityId, Nom)`.
**`AreaNumber` n'est indexé nulle part** — deux quartiers de la même ville peuvent partager
le même numéro aujourd'hui, donc **le même code postal**. Pour un code postal, dont la
raison d'être est d'identifier une zone de distribution, c'est disqualifiant.

Il faut ajouter `HasIndex(q => new { q.CityId, q.AreaNumber }).IsUnique()`. **Mais cet index
échouera à la création** : `CLAUDE.md` rappelle que tous les quartiers antérieurs au
2026-08-12 ont `AreaNumber = 0`. Dès qu'une ville en compte deux, la migration plante.

→ **L'unicité du code postal est suspendue à la reprise de données des `AreaNumber`.** C'est
le même chantier que celui déjà en attente pour `Quartier.CommuneId`. À traiter ensemble.

#### R2 — `AreaNumber = 0` doit produire `null`, jamais `"77000"`

Sur les lignes historiques, `0` se lit « non renseigné ». Concaténer donnerait un code postal
**syntaxiquement valide et faux**, que rien en aval ne pourrait distinguer d'un vrai. Un
`postcode` absent est récupérable ; un `postcode` faux se propage jusqu'au courrier.

→ `AreaNumber == 0` ⇒ `postcode = null`. Idem si la ville n'a pas encore de `Code`.

#### R3 — La largeur du champ n'est pas définie

Les exemples du contrat (`77101`, `77102`) sont sur 5 caractères, soit `77` + **3 chiffres**.
Mais `AreaNumber` est un `int` que le validateur contraint seulement à `> 0` : un quartier
n° 7 donnerait `777` et un n° 1234 donnerait `771234`. Trois longueurs différentes dans le
même `<select>`.

→ **Question Q8** : confirmer le format `CC` + `NNN` zéro-padé (`7` → `77007`), et donc
plafonner `AreaNumber` à 999 dans les deux validateurs.

#### Ce que ça débloque

`postcodes[]` (§2), `postcode` (§3, §4, `components`), `linked.kind = "postcode"` (§4), et le
filtre `postcode` (§3) — avec la réserve habituelle : **`postcode` et `quartierId` désignent
la même chose** (à ville donnée, la correspondance est 1:1). Même piège que `region`/`cityId`
au §3.10 : le contrat les combine en ET, un désaccord donne 0 résultat. `quartierId` fait foi.

#### Où vit la dérivation

Dans un helper **partagé** sous `Application/Features/Geographie/Quartiers/`, sur le modèle
de `QuartierCodeGenerator` / `QuartierCodeAssigner` — **pas recopié dans chaque handler**. La
règle « le code postal se calcule ici et nulle part ailleurs » doit tenir dès le premier
usage, sinon elle ne tiendra jamais.

#### Le préalable : `City.Code`

`City` ne porte aujourd'hui que `Name` et `Boundary` (`City.Create(name)`), et
`CityResponse` est `(Id, Name, BoundaryWkt)`. Ajouter un `Code` **numérique** touche l'entité,
la configuration (+ index unique), une migration, les slices `CreateCity` / `UpdateCity`,
leurs validateurs, `CityResponse` et `CityEndpoints`. Petit mais transverse.

⚠️ **Ne pas le confondre avec le `DJ` de `addressCode`** (§3.7) : `DJ` est l'indicatif pays
ISO 3166 de Djibouti, `77` est le code postal de la ville. Deux valeurs distinctes — un seul
champ `City.Code` ne peut pas servir aux deux.

### 3.2 `street` — aucun lien entre une adresse et une rue

`Street` est une entité **totalement autonome** : `Id`, `Code`, `Name`, `Type`, `Boundary`
(LineString). **Aucune FK** vers `Adresse`, `Bloc` ou `Quartier`.

Ce n'est pas un oubli : c'est la décision du **2026-08-08** — une adresse s'exprime avec
quatre éléments, *numéro / bloc / quartier / ville*. **La rue n'entre pas dans l'adresse.**
Le `Libelle` calculé aujourd'hui est `"42 Bloc 12, Quartier 7, Djibouti"`.

Impact : `street` (§3, §4, `components`), `linked.kind = "street"`, et la mention
« `search` : texte libre (code adresse, **rue**…) ».

**Décision attendue** : soit on rattache les adresses aux rues (nouvelle FK + reprise de
données + révision du libellé), soit ces champs disparaissent du contrat. Le second est
cohérent avec l'existant ; le premier revient sur un arbitrage du responsable projet.

### 3.3 `team` / `assignedTeamName` — aucune équipe, mais **tranché en lecture** (Q6)

> **Résolu le 2026-08-18** : le front confirme que `assignedTeamName` doit se lire comme
> **l'agent titulaire du bloc**, pas comme une équipe. On ne crée donc **pas** d'entité
> `Team`. Ce qui suit reste le constat d'origine ; les conséquences sont en fin de section,
> et l'**écriture** (`PATCH /bulk {team}`) reste bloquée — voir §4.8.

`grep -rni "team\|équipe" src/` → **0 résultat**.

Notre modèle affecte un **agent individuel** à un **bloc, dans une campagne**
(`CampaignBloc.AgentId`). Il n'y a pas de groupe d'agents, et c'est structurant : voir
[`module-recensement.md`](module-recensement.md), où la *charge* se déduit du bloc et la
*production* se compte sur `Survey.AgentId`.

Impact : `teams[]` (§2), filtre `team` (§3), `assignedTeamName` (§3, §4), `team` (§6),
`linked.kind = "team"`. **Cinq champs sur une notion inexistante.**

Note : c'est le même écart que **E2** de [`contrat-api-frontend.md`](contrat-api-frontend.md)
(le front attendait `PATCH /blocks/{id}/assign {userId}`, un titulaire absolu). Le front
raisonne systématiquement en « une adresse a un responsable » ; chez nous le responsable est
**scopé campagne** et se déduit. À clarifier une fois pour toutes — ça revient à chaque
contrat.

**Décision retenue** : option (a) — `assignedTeamName` porte le nom de l'agent titulaire du
bloc dans la campagne active. Aucun modèle à ajouter. Chaîne de lecture :

```
Adresse → Bloc → CampaignBloc (campagne InProgress) → AgentId → User.FullName
```

Quatre conséquences à ne pas découvrir en recette :

- **`null` est le cas courant, pas l'exception.** Le champ vaut `null` dès qu'aucune campagne
  n'est `InProgress`, et pour tout bloc non affecté dans celle qui l'est. Entre deux
  campagnes, **toute la colonne est vide**. Ce n'est pas un bug d'affichage.
- **Le champ suit les réaffectations, et c'est voulu.** Il montre le **titulaire courant**
  (la *charge*), jamais qui a effectivement relevé (la *production*, `Survey.AgentId`). Les
  deux peuvent différer sur une même ligne après une réaffectation — c'est le pilier posé
  dans [`module-recensement.md`](module-recensement.md), à ne pas « corriger ».
- **`teams[]` (§2) et le filtre `team` (§3)** deviennent la liste des agents titulaires d'au
  moins un bloc dans la campagne active. Faisable, mais **filtrer sur `User.FullName` est
  fragile** : rien ne garantit son unicité et un homonyme fusionnerait deux agents. Si le
  front peut passer un `agentId`, c'est nettement préférable ; sinon on filtre sur le nom en
  acceptant le risque.
- **`linked[].kind = "team"`** → `{ id: userId, kind: "team", label: fullName }`.

Le nom `assignedTeamName` reste trompeur (il porte une personne), mais le type front est
déjà écrit : **on ne le renomme pas**, on le documente.

### 3.4 `history[]` — aucun journal d'audit

Aucune table d'audit, sur `Adresse` ni ailleurs. `Survey` porte `CreatedAtUtc`,
`ValidatedAtUtc`, `ValidatedByUserId`, `RejectionReason` : on peut fabriquer un historique
**du relevé**, pas **de l'adresse** (création, modification de numéro, de géométrie — rien
n'est tracé).

### 3.5 `flag` / `duplicatesFlagged` — aucun marquage

Rien ne permet de signaler une adresse, ni de compter les doublons. §7 et le KPI
`duplicatesFlagged` (§1) supposent une entité ou une colonne à créer, plus une notion de
« file de vérification » distincte de la file de validation des relevés.

### 3.6 `validation.score` — n'existe pas

Aucun score de qualité 0–100 n'est calculé ni stocké. À définir de zéro : **sur quoi
porte-t-il ?** (complétude des champs du relevé ? écart GPS ? `IsMockLocation` ?) Les signaux
existent (`GpsAccuracyM`, `DistanceFromAddressM`, `IsMockLocation`), la formule non.

### 3.7 `addressCode` (`DJ-BLS-Q7-0042`) — n'existe pas, mais est presque dérivable

> ⚠️ **SECTION PÉRIMÉE (constat du 2026-08-23).** Le format décrit ci-dessous — alphanumérique,
> avec préfixe pays `DJ` et code de commune — **a été abandonné le 2026-08-18**. Le format réel
> est **entièrement numérique** (`77-007-7-42`), sans préfixe pays ni segment commune, et il
> **existe** : implémenté dans `AddressCodeGenerator`, figé à la validation `Definitive` d'un
> relevé. Voir **`docs/plans/adressage.md`**, qui fait autorité sur le sujet. La suite de cette
> section n'est conservée que comme trace de l'analyse d'origine.

On a `Adresse.Numero` (int) et le `Libelle` composé. Le format proposé se décompose :
`BLS` = `Commune.Code` ✅, `Q7` = `Quartier.Code` ✅, `0042` = `Numero` ✅, et **`DJ` =
l'indicatif pays ISO 3166** de Djibouti — donc une **constante**, pas une donnée à modéliser.

⚠️ **Ne pas le confondre avec le `City.Code` numérique** introduit pour le code postal
(§3.1) : `DJ` identifie le pays, `77` identifie la ville. Si le préfixe doit un jour varier,
c'est un champ de configuration, pas une colonne de `City`.

Reste que c'est une **nouvelle convention d'identifiant à arrêter** — et à figer. Le point
dur n'est pas de la calculer mais de la **stabiliser** : `Quartier.Code` est modifiable
(`SetCode`) et `QuartierCodeAssigner` peut même en dériver un nouveau. Un `addressCode`
recalculé à la volée **changerait donc quand on renomme un quartier** — ce qui en fait un
libellé, pas un identifiant. Si le front s'en sert comme clé (recherche, référence
imprimée), il faut le **persister à la création** de l'adresse et ne plus y toucher.

### 3.8 `occupancyType` (`owner | tenant | vacant`) — confusion avec nos catalogues

⚠️ **Ne pas mapper sur `EtatOccupation`.** Malgré le nom, `EtatOccupation` est l'**état du
bâti** : `Bon état / Dégradé / En construction / En ruine`. Le régime d'occupation
(propriétaire / locataire / vacant) **n'est relevé nulle part** — ni sur `Survey`, ni sur
`Unit`.

### 3.9 `propertyType` — existe, mais ni sous cette forme ni avec ces valeurs

`TypeOccupation` couvre le besoin, avec 11 valeurs françaises : *Maison individuelle, Villa,
Immeuble d'habitation, Immeuble mixte, Commerce, Administration, École, Mosquée, Hôpital,
Terrain nu, Entrepôt* (`TypeOccupationNames`).

Deux écarts avec `residential | commercial | industrial | institutional` :

1. **Ce n'est pas un enum C#** — c'est une **entité catalogue seedée en base**, avec un `Id`.
   Une « liste fermée » côté front la fige alors qu'elle est faite pour évoluer sans
   déploiement.
2. **Les granularités ne coïncident pas.** Notre liste distingue *Villa* de *Maison
   individuelle* ; la liste front regroupe tout en `residential`. Et *Immeuble mixte
   (logements + commerces)* n'a aucune case.

### 3.10 `region` — **résolu (Q5)** : c'est notre `City`

> **Confirmé le 2026-08-18** : `region` = `City`. Aucun niveau administratif à ajouter,
> simple renommage à la projection.

`regions[]` (§2) = les `City.Name` distincts ; `components.region` = `City.Name`.

⚠️ **Un seul piège** : `region` (nom) et `cityId` (FK) désignent alors **la même dimension**,
et le contrat les expose comme deux filtres indépendants combinés en ET. Envoyer les deux en
désaccord donnerait 0 résultat sans que l'UI comprenne pourquoi. Le contrat précise que
`region` est « présent mais actuellement inutilisé par l'UI » — on **l'accepte et on
l'ignore**, `cityId` fait foi. À ne pas transformer en filtre réel plus tard sans arbitrer
lequel gagne.

### 3.11 `location.parcelNumber` (`P-0042`)

Probablement `Adresse.Numero` reformaté — à confirmer. Si c'est un numéro cadastral distinct,
il n'existe pas.

---

## 4. Ce qui ne colle pas avec nos conventions

### 4.1 §6 — `stage` forcé en masse écrit sur une valeur dérivée

Le contrat pose lui-même que `workflowStage` est **dérivé du dernier `Survey`**, puis définit
un `PATCH` qui le **force**. Les deux ne peuvent pas être vrais en même temps : ou bien c'est
une projection en lecture seule, ou bien c'est un état stocké.

C'est exactement le travers de **E2** : aplatir en un champ scalaire ce que le modèle calcule.

**Notre position** : `registered / surveyed / verified` sont **dérivés et non inscriptibles**.
Un back-office ne « force » pas un relevé terrain — le cycle du relevé a ses propres routes
(`/api/surveys/{id}/validate|reject|request-correction`) avec leurs contrôles (un superviseur
ne valide pas son propre relevé). Les court-circuiter par un `PATCH /bulk` viderait ces
garde-fous.

**Réponse à la question 1 du front** : **option 1, amendée.** `approved` et `published` sont
un cycle **back-office sur l'adresse**, distinct du cycle **terrain sur le relevé**. On les
persiste dans un champ dédié sur `Adresse` (ex. `PublicationStatus`), et :

- `workflowStage` **en lecture** = fusion des deux (le back-office l'emporte quand il est
  posé) ;
- `PATCH /bulk` **en écriture** n'accepte que `approved` / `published`, et renvoie **400** sur
  `registered` / `surveyed` / `verified`.

Donc : **garde tes boutons Approuver / Publier**, mais retire tout bouton qui prétendrait
forcer les trois premières étapes.

### 4.2 §5 et §6 — les actions groupées sont refusées

**Décision du 2026-08-18, à transmettre au front.** `POST /adresses/approve` (lot) et la partie
`stage` de `PATCH /adresses/bulk` ne seront pas implémentées. Ce n'est pas un arbitrage de
priorité : c'est le métier qui l'interdit.

**Un relevé se valide un par un, parce qu'il porte des photos.** Valider, c'est examiner les
clichés du terrain, le point GPS, l'écart à la parcelle — un acte de contrôle humain sur une
pièce. Un bouton « approuver les 40 sélectionnées » ne fait pas ce contrôle : il le
court-circuite en le donnant à croire. Toute la valeur du cycle de validation vient de ce que
quelqu'un a réellement regardé.

S'y ajoutent les garde-fous que le lot contournerait : un superviseur ne valide pas son propre
relevé, la fenêtre de saisie est contrôlée à l'écriture, et la validation porte un
`ValidationType` (`Definitive` / `Temporary`) qui est une décision par parcelle, pas un
attribut de sélection. `Definitive` déclenche en plus le gel du code d'adresse — irréversible.

**Ce qui existe et qu'il faut utiliser à la place** (routes déjà en service, voir §4.10) :

| Action | Route |
|---|---|
| Valider | `POST /api/surveys/{id}/validate` |
| Rejeter | `POST /api/surveys/{id}/reject` |
| Renvoyer en correction | `POST /api/surveys/{id}/request-correction` |
| File d'attente | `GET /api/surveys?status=Submitted` |
| Photos à examiner | `GET /api/surveys/{id}/photos` |

Côté UI, la file de validation est donc une **liste où l'on traite un élément à la fois**, avec
les photos affichées — pas un tableau à cases à cocher suivi d'une action de masse.

Reste que `POST /approve` et `PATCH /bulk {stage}` faisaient de toute façon **double emploi** :
`approve` n'est qu'un `bulk` avec `stage: "approved"`. Si un jour une action groupée se
justifie, ce sera sur `approved`/`published` — le cycle back-office, qui n'examine pas de
photos — et via `/bulk` seul.

### 4.3 `workflowStage` écrase deux dimensions du modèle

Notre relevé porte `SurveyStatus` (Draft/Submitted/Validated/Rejected) **et** `ValidationType`
(`Definitive` = la parcelle sort du périmètre / `Temporary` = livrable sans en sortir). Le
mapping proposé les aplatit et perd `ValidationType`, ainsi que la troisième issue du
superviseur, `request-correction` — déjà signalée comme un angle mort du front dans
[`contrat-api-frontend.md`](contrat-api-frontend.md).

### 4.4 `204` sur mutation — écart avec nos `PATCH` existants

Nos `PATCH` renvoient **200 + la ressource** (cf. `PATCH /api/adresses/{id}`) ; seuls les
`DELETE` renvoient 204. Le 204 sur `/approve`, `/bulk` et `/flag` est **acceptable** (actions
de masse, pas une ressource à renvoyer) — mais c'est une exception à assumer, pas la règle
maison. À noter dans le guide d'intégration.

### 4.5 Permissions non spécifiées

Le contrat dit « JWT sur toutes les routes ». Chez nous ça ne suffit pas : chaque endpoint
porte `.RequirePermission(...)`. Proposition :

- `summary`, `filter-options`, `search`, `{id}` → `adresses.view` (existe)
- `approve`, `bulk` → **`adresses.approve`** (à créer)
- `{id}/flag` → **`adresses.flag`** (à créer)

Rappel : `SeedPermissionsAsync` est incrémental depuis le 2026-08-12, ajouter au catalogue
suffit. Et **Admin bypasse tout** sans ligne `RolePermission`.

### 4.6 Mélange français / anglais sur la même ressource

`/api/adresses` est français (historique), les sous-routes et les champs proposés sont anglais
(`addressCode`, `postcode`, `quartier`, `zone`, `workflowStage`). C'est **conforme** à la
règle du 2026-08-07 (code neuf en anglais, pas de renommage rétroactif) — mais il faut assumer
que la même ressource aura **deux DTO dans deux langues** : `AdresseResponse` (`numero`,
`quartierNom`, `libelle`) pour le CRUD, et le DTO Registry en anglais. À écrire noir sur
blanc, sinon quelqu'un « harmonisera » et cassera le CRUD existant.

### 4.7 La vue `adresses_tiles` / les tuiles Martin n'existent pas ici

Le contrat s'appuie sur « les mêmes FK aplaties que la vue `adresses_tiles` » comme sur un
acquis. **Aucune trace de Martin, de tuiles vectorielles ou de cette vue dans le dépôt ni dans
`docs/`** — aucune migration ne crée de vue.

Si elle existe hors dépôt (déployée à la main ?), il **faut la rapatrier en migration** :
faire dépendre la cohérence liste/carte d'un objet SQL non versionné est une bombe à
retardement. Sinon, la contrainte « mêmes FK que la vue » n'a pas d'objet, et c'est notre
projection qui fait référence.

### 4.8 §6 — `PATCH /bulk {team}` reste impossible, même après Q6

**Ouvert par la réponse à Q6.** Lire le titulaire depuis le bloc règle l'affichage ; ça ne
règle pas la réassignation, et ça la rend même franchement dangereuse.

Le contrat décrit `PATCH /bulk { ids: [adresseId], team }` comme « réassigne l'équipe » sur
une sélection d'**adresses**. Or **la maille d'affectation est le BLOC** (bascule du
2026-08-11) : il n'existe aucun endroit où écrire un titulaire sur une adresse. Exécuter ce
`PATCH` supposerait de remonter chaque adresse à son bloc et de réaffecter le bloc.

**Ce qui casse** : un bloc contient N adresses. Réassigner à partir d'une sélection de 3
adresses réaffecte le bloc **entier** — donc les N-3 autres, que l'opérateur n'a pas
sélectionnées et ne voit pas dans son écran. Une action « sur 3 lignes » en déplace des
centaines, silencieusement. C'est précisément le genre d'effet de bord que la maille bloc
avait pour but d'éviter.

**Position** : `PATCH /bulk` **rejette `team` en 400**. La réassignation passe par la route
existante, qui opère à la bonne maille et dans la bonne campagne :

```
PATCH /api/campaigns/{campaignId}/blocs/{blocId}/agent   { agentId }
```

Conséquence pour le front : dans le tiroir Registry, `assignedTeamName` est **en lecture
seule**. Le bouton de réassignation, s'il doit exister, appartient à un écran de blocs — pas
à une liste d'adresses. C'est le troisième contrat d'affilée où le front veut écrire un
responsable au niveau adresse (cf. **E2** dans
[`contrat-api-frontend.md`](contrat-api-frontend.md)) ; autant le trancher définitivement ici.

Si le besoin métier réel est « réassigner d'un coup les blocs couvrant cette sélection », ça
se fait — mais avec une route qui **prend des `blocId`**, dit combien d'adresses sont
touchées, et demande confirmation. Pas avec un `PATCH` masqué derrière une liste d'adresses.

### 4.9 `CommuneId` — reste nullable : ni `UNIQUE`, ni `NOT NULL`

Deux propositions successives ont été examinées le 2026-08-18, aucune n'est appliquée. La
raison finale est **métier, pas technique**, et elle corrige une hypothèse fausse que portait
le modèle depuis le 2026-08-12.

**`UNIQUE` — écarté** (l'intention était juste, la contrainte fait l'inverse). Un index unique
sur `Quartiers.CommuneId` signifie « cette valeur n'apparaît que sur une ligne », donc **une
commune ne contiendrait qu'un seul quartier** : Boulaos aurait droit à un quartier, le
deuxième partirait en 409. Ce qu'on veut — « un quartier appartient à une seule commune » —
est **déjà garanti par construction** : la colonne est scalaire, une ligne ne peut y stocker
qu'une valeur. Il n'y a rien à contraindre.

**`NOT NULL` — implémenté puis retiré.** L'objectif « exactement une commune » était le bon
pour Djibouti-ville, mais **seule Djibouti-ville est découpée en communes**. Ali Sabieh n'en a
aucune, et n'en aura pas. Un `NOT NULL` rendait donc tout Ali Sabieh inexprimable — ce que la
base confirmait déjà : sur 9 quartiers, les 3 d'Ali Sabieh n'avaient pas de commune et aucune
commune n'existait pour eux.

→ **`CommuneId` nullable est une option fonctionnelle du modèle, pas une dette.** La
formulation « état transitoire en attente de reprise » qui figurait dans `CLAUDE.md` depuis le
2026-08-12 était fausse et a été corrigée.

#### Ce que ça change ailleurs (le vrai impact)

C'est **`CityId`, et non la commune, qui porte le rattachement obligatoire** d'un quartier.
Deux conséquences appliquées :

- **`CityId` redevient fourni par le client.** `CreateQuartierRequest` /
  `UpdateQuartierRequest` prennent désormais `cityId` (requis) **et** `communeId` (optionnel),
  là où depuis le 2026-08-12 la ville se déduisait de `Commune.CityId`. Cette déduction
  supposait qu'un quartier ait toujours une commune : elle ne pouvait pas exprimer Ali Sabieh.
- **`QuartierPlacement` refondu** : il ne *résout* plus la ville, il *valide* le triplet
  (ville, commune?, zone?) — `commune.CityId == cityId`, `zone.CommuneId == communeId`, et une
  zone sans commune est refusée (une zone est une partie d'une commune). Les invariants sont
  au même endroit qu'avant, partagés par Create et Update.

Note pour le front : `Quartier.CityId` n'est donc plus « redondant, à supprimer après la
reprise de données » comme l'annonçait `CLAUDE.md` — c'est la colonne structurante.

### 4.10 Le cycle du relevé existe déjà — ne pas le reconstruire

Point souvent manqué en lisant le contrat : les trois premières étapes de `workflowStage`
(`registered → surveyed → verified`) ne sont **pas à construire**. Elles sont dérivées du
`Survey`, et tout le cycle est en service depuis le module Recensement :

- `POST /api/surveys/{id}/validate` · `/reject` · `/request-correction`
- `GET /api/surveys?status=Submitted` — la file de validation
- **`GET /api/surveys/current`** — « dernier relevé validé de chaque adresse ». C'est
  exactement la projection dont le Registry a besoin pour dériver `workflowStage` ; elle est
  écrite, testée, et gère déjà le cas `NotSurveyable`.
- `GET /api/surveys/stalled` et `/suspicious` — relevés en souffrance et file anti-fraude

Ce qui manque réellement au §5/§6 se réduit donc à : **`approved` / `published`** (la couche
back-office, non dérivable d'un relevé) et **`flag`**. Le reste est une **façade** au-dessus de
l'existant, pas une reconstruction — et cette façade agrège, elle ne remplace pas : la
troisième issue du superviseur (`request-correction`) ne doit pas disparaître dans un modèle à
deux boutons.

---

## 5. Réponses aux 4 questions du front

1. **`approved` / `published`** → option 1 amendée : persistés dans un champ dédié sur
   `Adresse`, `PATCH /bulk` n'accepte **que** ces deux valeurs, 400 sur les trois autres
   (§4.1). **Garde tes boutons Approuver / Publier.**
2. **Liste fermée `propertyType` / `occupancyType`** → on ne peut pas répondre en l'état.
   `occupancyType` **n'est relevé nulle part** (§3.8 — à ne pas confondre avec
   `EtatOccupation`, qui est l'état du bâti). `propertyType` correspond à `TypeOccupation`,
   mais c'est un **catalogue en base de 11 valeurs françaises**, pas un enum figé (§3.9).
   Contre-proposition : on ajoute une colonne `Key` stable au catalogue
   (`maison_individuelle`, `villa`, `immeuble_habitation`, …) et l'API renvoie cette clé — le
   front traduit `registry.type.{key}`, et **ajouter un type en base ne casse plus le front**
   (valeur inconnue → repli sur le libellé français renvoyé à côté).
3. **`history[].actionKey`** → aucun journal n'existe (§3.4). Rien à figer tant qu'on n'a pas
   décidé ce qu'on trace. Si on part du seul `Survey` : `history.surveyed`,
   `history.submitted`, `history.validated`, `history.rejected`,
   `history.correction_requested`. `history.registered` supposerait une date de création sur
   `Adresse`, qui n'existe pas.
4. **Pas de `GET /api/adresses` paginé en doublon** → d'accord sur le principe, **mais**
   `GET /api/adresses?blocId=` **existe déjà** et n'est pas paginé. On ne le supprime pas sans
   savoir qui le consomme. Position : il reste, non paginé, comme lecture CRUD d'un bloc ;
   `POST /search` est la seule route de liste du Registry.

**Q5 / Q6 / Q7 — répondues par le front le 2026-08-18 :**

- **Q5** — `region` = `City`. ✅ Renommage à la projection, rien à modéliser (§3.10). Réserve :
  `region` et `cityId` deviennent redondants, `cityId` fait foi.
- **Q6** — `assignedTeamName` = **l'agent titulaire du bloc**. ✅ Pas d'entité `Team` (§3.3).
  ⚠️ Vaut pour la **lecture seule** : `PATCH /bulk {team}` reste refusé, la réassignation
  garde la maille bloc (**§4.8** — à lire avant de coder quoi que ce soit sur §6).
- **Q7** — `geom` en **GeoJSON**. ✅ Ajoute `NetTopologySuite.IO.GeoJSON4STJ` + le
  `GeoJsonConverterFactory` (§2). L'API portera WKT sur le CRUD et GeoJSON sur le Registry —
  écart assumé, à documenter côté guide front.

**`postcode` — règle donnée le 2026-08-18** : `City.Code` (numérique, Djibouti = 77) +
`Quartier.AreaNumber`. ✅ Dérivé, aucune saisie, aucun référentiel à charger (§3.1). Trois
réserves : unicité non garantie (R1, bloquant), `AreaNumber = 0` ⇒ `null` (R2), largeur à
confirmer (**Q8** ci-dessous, R3).

**Q8 en retour** — le format est-il `CC` + `NNN` zéro-padé, c'est-à-dire quartier n° 7 ⇒
`77007` (et non `777`) ? Si oui on plafonne `AreaNumber` à 999 côté validateurs. Les exemples
`77101` / `77102` le suggèrent mais ne le prouvent pas.

**Reste ouvert, par ordre de blocage** : `street` (§3.2), `occupancyType` (§3.8),
`propertyType` (§3.9), `flag` / `duplicatesFlagged` (§3.5), `validation.score` (§3.6),
`addressCode` (§3.7, à persister si c'est une clé).

---

## 6. Ordre de traitement proposé

Ce qui ne dépend d'aucune décision et sert à tout le monde (Q5/Q6/Q7 ont élargi ce lot) :

1. **Convention de pagination transverse** + `POST /api/adresses/search` avec les champs
   désormais dérivables : `id`, `numero` / `addressCode` partiel, `quartier`, `zone`,
   `region` (= `City.Name`), `workflowStage`, `assignedTeamName`, FK hiérarchiques,
   `geom: null`.
2. **`CreatedAtUtc` / `UpdatedAtUtc` sur `Adresse`** — débloque `lastUpdate` et
   `history.registered`, utile indépendamment du front.
3. **`City.Code` numérique** (§3.1) : entité + config avec index unique + migration + slices
   `CreateCity` / `UpdateCity` + `CityResponse` + endpoints. Préalable à `postcode` — et le
   seul champ à ajouter au modèle dans tout ce lot.
4. **Helper de dérivation du `postcode`** sous `Features/Geographie/Quartiers/`, partagé
   (§3.1), avec `AreaNumber == 0` ⇒ `null`.
5. **`GET /api/adresses/filter-options`** : `regions` (villes), `zones`, `teams` (agents
   titulaires dans la campagne active) **et `postcodes`** deviennent tous alimentables. Plus
   aucun champ ne renvoie `[]` par défaut.
6. **GeoJSON** : package + converter (§2). Petit, indépendant, à faire avant d'écrire les DTO.

À traiter avec la reprise de données (pas avant) : **index unique
`(CityId, AreaNumber)`** sur `Quartier` (§3.1 R1), à faire dans le même chantier que la
reprise de `Quartier.CommuneId`.

Bloqué sur décision : `street` (§3.2), `flag` + `duplicatesFlagged` (§3.5),
`validation.score` (§3.6), `addressCode` (§3.7), `occupancyType` (§3.8), `propertyType`
(§3.9), `approved` / `published` (§4.1), **écriture de `team` (§4.8)**, format du `postcode`
(**Q8**, §3.1 R3).

**`GET /api/adresses/summary` est en réalité la route la plus bloquée du lot** : 2 de ses 4
KPI (`duplicatesFlagged`, `publishedToday`) reposent sur des concepts inexistants. Ne pas la
prendre en premier sous prétexte qu'elle a l'air simple.


---

## 7. Implémenté le 2026-08-18

Décisions du responsable projet appliquées au modèle. `dotnet build` : **0 erreur**.
La migration `20260818092036_AddCityCodeAreaNumberUniqueAndAddressCode` a été **appliquée sur
la base de dev** le 2026-08-18 (sauvegarde `pg_dump` prise avant). Résultat vérifié :
conversion `0 → NULL` faite (6 lignes, plus aucun `0`), les 3 index uniques créés, et
`City.Code = 77` posé sur Djibouti — les codes postaux sortent (`77007`, `77008`, `77009`).

### Ce qui a été fait

| Décision | Mise en œuvre |
|---|---|
| Format `CC` + `NNN` zéro-padé (**Q8**) | `PostcodeGenerator` — `77` + `007` = `77007`. `AreaNumber` plafonné à `1..999` et `City.Code` à `1..99` dans les 4 validateurs, ce qui garantit 5 caractères |
| Ajouter `City.Code` | `int?` + index unique, garde 409 dans Create/Update, exposé dans `CityResponse`, `CityBody` et les deux requests |
| `AreaNumber` unique | Index unique **`(CityId, AreaNumber)`** + double garde 409 dans les handlers, sur le modèle de celle qui existait sur le nom |
| Code adresse figé à la validation définitive | `Adresse.AddressCode` + `FreezeAddressCode`, posé par `ValidateSurveyHandler` quand `ValidationType.Definitive` |

`QuartierResponse` gagne `postcode` (dérivé, jamais stocké) et `AdresseResponse` gagne
`addressCode`. Les 4 handlers Quartier passent par une projection partagée neuve,
`QuartierQueries` — le code postal a besoin de `City.Code`, donc d'une jointure que chacun
aurait dû recopier.

### `AreaNumber` : nullable plutôt que supprimé/recréé

La consigne était « pour faire simple, supprime la colonne et recrée ». **Ça n'aurait pas
atteint le but** : recréer la colonne remet tout le monde à `0`, et l'index unique
`(CityId, AreaNumber)` échoue alors exactement pareil dès qu'une ville a deux quartiers — en
ayant au passage détruit les numéros réels saisis depuis le 2026-08-12.

Ce qui débloque l'index, c'est de rendre la colonne **nullable** : Postgres traite deux
`NULL` comme distincts dans un index unique. La migration convertit donc `0 → NULL` (le
sentinelle signifiait déjà « non renseigné ») **sans toucher aux numéros réels**. Résultat
identique à la demande, sans la perte de données.

### Précaution avant d'appliquer la migration

La migration s'interrompt volontairement, avec un message nommant les lignes fautives, si
**deux quartiers d'une même ville portent déjà le même numéro réel**. Ce cas est possible :
aucune contrainte ne l'empêchait jusqu'ici. On ne peut pas le résoudre automatiquement — il
faudrait choisir lequel des deux garde son numéro. C'est une reprise de données, pas une
devinette.

```
dotnet ef database update --project src/DASApi.Infrastructure --startup-project src/DASApi.WebApi   --connection "Host=localhost;Port=5433;Database=dasapi;Username=postgres;Password=postgres"
```

⚠️ **Passer `--connection` explicitement** : `Program.cs` retombe sur un `Host=...;Port=5435`
codé en dur quand `ConnectionStrings:DefaultConnection` n'est pas résolu, et `dotnet ef`
n'applique pas forcément le profil de lancement. Sans ce paramètre, la migration peut viser
une autre base que celle attendue.

**Reste à saisir sur la base de dev** (aucun code postal tant que ce n'est pas fait) :
`City.Code` pour Ali Sabieh, et `AreaNumber` sur les 6 quartiers qui n'en ont pas
— 3 à Djibouti (Cheik Moussa, Einguela, Quartier 7) et les 3 d'Ali Sabieh.

### Non fait, et pourquoi

**`Quartier.CommuneId` reste nullable** — ni `UNIQUE` (produirait l'inverse de l'effet
voulu), ni `NOT NULL` (rendrait Ali Sabieh inexprimable : seule Djibouti-ville a des
communes). Voir §4.9, qui décrit aussi l'impact réel : `CityId` redevient fourni par le
client et `QuartierPlacement` a été refondu.

### Reste à faire sur ce lot

`addressCode` n'est pour l'instant **que figé et exposé** : la migration ne rétro-remplit pas
les adresses dont un relevé a déjà été validé définitivement avant aujourd'hui. Elles
resteront à `null` jusqu'à une prochaine validation. Un script de rattrapage est à prévoir si
ces adresses existent déjà en base.


---

## 8. Livraison finale (2026-08-18)

### Routes

| Route | Livré | Notes |
|---|---|---|
| `GET /summary` | ✅ | 4 KPI sur 4. `duplicatesFlagged` = dernier relevé rejeté (nom hérité, trompeur). `publishedToday` sur la journée de Djibouti |
| `GET /filter-options` | ✅ | 4 listes alimentées |
| `POST /search` | ✅ | Paginée. Tous les filtres du contrat réellement appliqués, y compris `postcode`/`zone`/`region` |
| `GET /{id}` | ✅ | Sur-ensemble de l'ancienne réponse — rien n'a disparu |
| `PATCH /bulk` | ✅ | Restreinte à `Approved`/`Published`, sans `team` |
| `POST /approve` | ➡️ | Redondante avec `/bulk` |
| `POST /{id}/flag` | ➡️ | = `POST /api/surveys/{id}/reject` |

Hors contrat, livrés au passage : `GET /api/surveys/productivity`, `Adresse.PublicationStatus`,
`Bloc.Number`, `City.Code`, code postal et code d'adresse dérivés, `PagedResponse<T>`.

### Ce que ce module a révélé, au-delà du front

- **Aucun de nos 87 endpoints ne paginait.** `PagedResponse<T>` (`Application/Common`) est
  désormais la convention transverse, pas un DTO de cette route.
- **`Quartier.AreaNumber` n'avait aucune contrainte d'unicité**, et `Bloc` n'avait aucun
  numéro. Les deux manquaient à un adressage cohérent, indépendamment du Registry.
- **Le tri d'une liste paginée doit être totalement déterministe** (`Id` en dernier critère),
  sinon la pagination saute ou duplique des lignes — invisible en dev, systématique en prod.

### Dette assumée

- **Recherche libre non indexable** : `ToLower().Contains()` plutôt que `EF.Functions.ILike`,
  pour ne pas faire remonter le provider Npgsql dans la couche Application. `LOWER()` interdit
  l'index B-tree. À repasser en index d'expression ou recherche plein texte si le volume
  l'impose.
- **5 sous-requêtes corrélées par ligne** dans `SearchAdresses` (dernier relevé ×3, zone,
  agent). Correct et lisible, **non mesuré** : la base de test ne contient que 165 adresses et
  **0 relevé**, donc les sous-requêtes sur `Surveys` n'ont jamais rendu de ligne.
- **`GET /api/surveys/productivity` n'a pas été vérifié sur des données** — 0 relevé en base.
  Seul le chemin vide (`[]`, 200) est prouvé.
- **`campaignStatus` n'appelle pas `CampaignAutoCloser`**, contrairement à
  `GetCampaignProgress` : déclencher une bascule d'état depuis une lecture de statistiques
  serait un effet de bord indésirable. Conséquence : une campagne échue peut y apparaître
  `InProgress`.

### Reste ouvert

`street` (reporté — règle métier du module Voirie non arrêtée), `history` (aucun journal
d'audit), `occupancyType` (non relevé), `validation.notes`, clé stable sur le catalogue
`TypeOccupation`.
