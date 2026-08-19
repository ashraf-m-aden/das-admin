# Module Recensement — Campagnes & Relevés terrain

## Contexte

Le module [[recensement-geographie]] a posé le **socle géographique** (`City → Quartier → Bloc → Adresse`, plus `Street` autonome) : où sont les choses. Il lui manque le **pilotage du travail terrain** : qui va relever quoi, quand, et quel est l'état constaté à chaque passage.

Ce document spécifie cet ajout, à partir de la proposition de schéma rédigée le 2026-08-09.

Backend .NET 10 + PostgreSQL + PostGIS, Vertical Slice, Minimal API, sans MediatR ni AutoMapper, FluentValidation — inchangé.

## Périmètre : cinq tables ajoutées, une supprimée

**Contrainte posée le 2026-08-09 : on n'altère aucune table déjà construite.** Le socle géographique (`Cities`, `Quartiers`, `Blocs`, `Adresses`, `Streets`, `TypeOccupations`, `EtatOccupations`) et les tables Auth restent **exactement en l'état** — pas de changement de type, pas de colonne ajoutée ou supprimée.

Seule exception, décidée le 2026-08-09 : **`Occupations` est supprimée**, `Surveys` la remplaçant intégralement (voir plus bas). La migration se résume donc à quatre `CreateTable` et un `DropTable`.

Les **cinq tables nouvelles** :

| Table | Rôle |
|---|---|
| `Units` | Unités d'un immeuble (appartement, local), rattachées à une `Adresse` |
| `Campaigns` | Campagne de recensement |
| `CampaignAssignments` | Feuille de route figée : une parcelle affectée à un agent pour une campagne |
| `Surveys` | Constat réel d'un passage terrain, avec cycle de validation |
| `SurveyPhotos` | Photos justificatives d'un relevé, déposées par le mobile dans le stockage objet |

Migrations EF Core : cinq `CreateTable`, un `DropTable`, et **trois index uniques posés sur des tables existantes** (`City.Name`, `(CityId, Nom)` sur `Quartier`, `(QuartierId, Code)` sur `Bloc` — faille `D2`). Ces index sont la seule entorse au cadrage « ajout pur » : aucune colonne ni aucun type n'est touché. **Vérifier et dédoublonner la base avant de les poser**, sinon la migration échoue.

> Les décisions ci-dessous intègrent les arbitrages de la revue de failles du 2026-08-09 — voir [`docs/failles-recensement.md`](../failles-recensement.md). Chaque règle issue de cette revue est annotée de son identifiant (`A2`, `B1`…).

### Ce que la proposition demandait et qui est écarté à ce stade

La proposition initiale réécrivait le socle. Ces points sont **différés**, pas rejetés sur le fond — ils feront l'objet d'un lot distinct s'ils sont confirmés :

- `Boundary` en `MultiPolygon` (au lieu de `Polygon`) sur `Cities`/`Quartiers`/`Blocs`, et **NOT NULL** sur les deux premiers.
- `Quartiers.Code` UNIQUE (ex. `"Q7"`, identifiant de l'export GIS).
- **`Adresse` transformée en parcelle** : emprise `Boundary` MultiPolygon + point `Location`, en remplacement de `Latitude`/`Longitude`. `Adresse` reste donc un simple point en `numeric(8,6)`/`numeric(9,6)`, et aucune emprise foncière n'est stockée.

## Suppression d'`Occupations`

`Occupation` (1:1 avec `Adresse`) et `Survey` décrivent le même objet métier — ce qui occupe une parcelle — avec des champs quasi identiques. Les faire cohabiter créerait deux sources de vérité que rien ne synchronise : valider un relevé ne mettrait pas à jour l'`Occupation`, et l'API exposerait deux réponses divergentes pour la même adresse.

`Survey` couvre tout ce que faisait `Occupation` et davantage : `TypeOccupationId`, `EtatOccupationId`, `Nom` → `Name`, `NombreEtages` → `FloorCount`, `NombreAppartements` → `ApartmentCount`, `NombreCommerces` → `ShopCount`, `AccessiblePmr` → `WheelchairAccessible`, plus la traçabilité (agent, horodatage, GPS, photo) et le cycle de validation. L'« état courant » d'une adresse, qui était une ligne `Occupation`, devient le dernier `Survey` validé (voir la requête dédiée).

**`Occupations` est donc supprimée**, pas dépréciée. La base de dev étant repartie de zéro, aucune reprise de données n'est nécessaire.

### Inventaire de la suppression

À retirer :

| Emplacement | Élément |
|---|---|
| `Domain/Entities/` | `Occupation.cs` |
| `Domain/Constants/PermissionNames.cs` | `OccupationsCreate/Update/Delete/View` |
| `Infrastructure/Persistence/Configurations/` | `OccupationConfiguration.cs` |
| `Infrastructure/Persistence/DasDbContext.cs` | `DbSet<Occupation> Occupations` |
| `Infrastructure/Persistence/Seed/DbInitializer.cs` | entrées `occupations.*` du `RolePermissionsCatalog` |
| `Application/Common/Interfaces/IDasDbContext.cs` | `DbSet<Occupation> Occupations` |
| `Application/Features/Geographie/Occupations/` | le dossier entier — 5 slices (`CreateOccupation`, `UpdateOccupation`, `DeleteOccupation`, `GetOccupations`, `GetOccupationById`) + `OccupationResponse.cs` |
| `Application/DependencyInjection.cs` | 5 `AddScoped<*OccupationHandler>` et leurs `using` |
| `WebApi/Features/Geographie/OccupationEndpoints.cs` | le fichier, et son appel dans `GeographieEndpoints.cs` |
| `WebApi/DASApi.http` | la requête `POST /api/occupations` et les mentions d'occupation dans les commentaires de la chaîne d'adressage |
| Migration | `DropTable("Occupations")` |

À **conserver impérativement** — `Survey` en dépend :

`TypeOccupation`/`EtatOccupation` (entités, configurations, `TypeOccupationNames`/`EtatOccupationNames`, seed du `DbInitializer`), les slices `TypesOccupation`/`EtatsOccupation` et `WebApi/Features/Geographie/ReferenceEndpoints.cs` (`GET /api/types-occupation`, `GET /api/etats-occupation`). Ce sont des catalogues de référence, sans lien avec la table `Occupations` elle-même — la proximité de nom rend la confusion facile.

**Documents à mettre à jour** une fois la suppression faite : `docs/schema-recensement-gis.md` (table `Occupations` et diagramme ER), `docs/plans/recensement-geographie.md` (décisions sur `Occupation` 1:1) et `CLAUDE.md` (mentions d'`Occupation` dans la description du module).

## Arbitrages du 2026-08-09

- **Pas de table `Agents`.** La proposition créait une table `Agents` (`Nom`, `Statut` Actif/Inactif) alors que `User` existe déjà avec `IsActive` et le rôle `AgentTerrain` ([[auth]]). Deux référentiels de personnes se désynchronisent nécessairement — un agent désactivé dans `Users` serait resté « Actif » dans `Agents` tout en ne pouvant plus se connecter. **`AgentId` est donc une FK vers `Users.Id`**, et le statut actif est porté par `User.IsActive`. Corollaire : `Survey.ValidatedByUserId` pointe aussi vers `Users` — celui qui valide est un **Superviseur**, pas un agent (la proposition le faisait pointer vers `Agents`, ce qui était une erreur).
- **Le CRUD géographique existant est conservé.** La proposition disait « rattachement par jointure spatiale, pas de saisie manuelle », ce qui aurait supprimé des endpoints livrés et testés de bout en bout le 2026-08-08. Un éventuel import GIS en masse sera un **chemin supplémentaire**, pas un remplacement. Les workflows `BlocSuggestion`/`StreetSuggestion` et les champs `Bloc.Name`/`Street.Name`, absents de la proposition, sont conservés sans changement.
- **Noms anglais pour les entités neuves**, en application de la convention du 2026-08-07 (CLAUDE.md). Les entités existantes ne sont **pas** renommées.

  | Proposition initiale | Retenu | Raison du choix |
  |---|---|---|
  | `Releves` | **`Surveys`** | Un relevé terrain = une observation datée |
  | `Periodes` | **`Campaigns`** | La proposition la décrivait déjà comme « une campagne de recensement » ; `Period` seul ne dit pas de quoi il s'agit |
  | `PeriodeAdresses` | **`CampaignAssignments`** | La table porte un `AgentId` et un statut de tâche : c'est une affectation, pas une simple table de jointure |
  | `Unites` | **`Units`** | — |

## Conventions (rappel)

- PK en `uuid`, géométrie en `geometry(..., 4326)` (WGS84, aligné sur le GPS mobile et l'affichage carto), index GiST sur toute colonne géométrique.
- Mesures métriques calculées à la volée : `ST_Area(geom::geography)` ou `ST_Transform(geom, 32638)` (UTM 38N, la zone de Djibouti).
- Nommage EF Core en PascalCase (tables et colonnes entre guillemets en SQL brut).
- Mapping .NET via NetTopologySuite (`UseNpgsql(cs, o => o.UseNetTopologySuite())`), déjà en place.
- Enums C# stockés en string (`HasConversion<string>()`), cohérent avec `JsonStringEnumConverter` configuré dans `Program.cs` — même pattern que `SuggestionStatus`/`TypeVoie`.

---

## Vue d'ensemble

```
Existant, inchangé          City → Quartier → Bloc → Adresse
                            Street
                            TypeOccupation, EtatOccupation

Supprimé                    Adresse → Occupation   (remplacée par Survey)

Nouveau — unités            Unit ──> Adresse

Nouveau — pilotage          Campaign → CampaignAssignment → Survey
                                              ↓                ↓
                                           Adresse          Adresse (dénormalisé)
                                           User             User
```

Les tables neuves ne référencent l'existant que par des FK sortantes (`Adresses.Id`, `Users.Id`, `TypeOccupations.Id`, `EtatOccupations.Id`) — aucune table existante n'a besoin de connaître les nouvelles. C'est ce qui rend le lot additif malgré la suppression d'`Occupations` : aucune FK entrante à défaire, la seule référence était `Occupations.AdresseId`, qui disparaît avec la table.

---

## `Units`

Rattachée à la **parcelle** (`Adresses`), **pas au relevé** : les unités d'un immeuble sont une réalité stable, elles ne doivent pas se dupliquer à chaque nouvelle campagne. Table vide pour une maison individuelle, plusieurs lignes pour un immeuble.

| Colonne | Type | Nullable | Note |
|---|---|---|---|
| `Id` | `uuid` | non (PK) | |
| `AdresseId` | `uuid` | non | FK → `Adresses.Id`, `ON DELETE CASCADE` |
| `Floor` | `integer` | non | 0 = RDC |
| `Number` | `varchar(50)` | non | `"A3"`, `"Appt 12"`, `"Local 2"` |
| `Type` | `varchar(30)` | non | Enum `UnitType` : `Apartment` / `Shop` / `Office` |
| `EntryPoint` | `geometry(Point, 4326)` | oui | Entrée propre si différente — index GiST |

Index UNIQUE composite `(AdresseId, Floor, Number)`.

**`UnitType` en enum C# stocké string, pas en table de référence** — contrairement à `TypeOccupation`/`EtatOccupation`. La proposition laissait ce champ en `varchar` libre, ce qui n'est aucun des deux patterns du repo. Choix de l'enum : liste courte et figée, aucun besoin de filtrage relationnel ni d'ajout de valeur sans déploiement (même raisonnement que `TypeVoie`).

**Logique de livraison** : s'il existe des `Units` pour la parcelle, on livre à l'unité ; sinon on livre à la parcelle (`Survey.EntryPoint` du dernier relevé validé, à défaut les coordonnées de l'`Adresse`).

### Règles d'écriture (faille `B3`)

Les unités étant rattachées à l'adresse et non au relevé, elles échapperaient sans cela à tout contrôle. Deux règles applicatives les encadrent :

1. **Gel à la validation.** Les `Units` d'une adresse ayant un relevé `Validated` ne sont plus modifiables — sauf si l'adresse est réaffectée dans une nouvelle campagne. Sans ce gel, un agent pourrait modifier après coup les unités qui justifient un `ApartmentCount` déjà validé, et le contrôle de complétude immeuble perdrait toute valeur.
2. **Écriture scopée à l'affectation.** Un `AgentTerrain` ne peut créer ou modifier une unité que sur une adresse **qui lui est affectée dans une campagne en cours** — même contrôle que pour le relevé. Sans ça, `units.create/update` autoriserait n'importe quel agent à modifier n'importe quelle adresse de la ville.

**`Unit.Id` est fourni par le client** (même raison que pour `Survey`, voir la section hors-ligne) : les unités d'un immeuble se saisissent sur le terrain, souvent sans réseau. Une synchronisation rejouée sans identifiant client dupliquerait tous les appartements.

---

## `Campaigns`

Une campagne de recensement. Clôture **délibérée** par le superviseur, jamais déclenchée implicitement par la création de la campagne suivante (deux campagnes peuvent légitimement se chevaucher sur des quartiers différents).

**La campagne est le seul point d'entrée du travail terrain** (confirmé le 2026-08-09). `Survey.CampaignAssignmentId` est obligatoire : il n'existe pas de relevé spontané. Concrètement, aucun agent ne peut rien relever tant qu'un Superviseur n'a pas créé une campagne, sélectionné des blocs et affecté les parcelles — l'ordre de mise en service est donc imposé, et l'application mobile doit gérer le cas « aucune affectation » comme un état normal, pas comme une erreur. En contrepartie, tout relevé est traçable à une décision d'affectation, et le périmètre couvert par une campagne est connu à l'avance plutôt que reconstitué après coup.

| Colonne | Type | Nullable | Note |
|---|---|---|---|
| `Id` | `uuid` | non (PK) | |
| `Name` | `varchar(200)` | non | ex. `"Recensement Q7 - Octobre 2026"` |
| `Status` | `varchar(20)` | non | Enum `CampaignStatus` : `Planned` / `InProgress` / `Closed` |
| `OpenedAtUtc` | `timestamptz` | non | |
| `ClosedAtUtc` | `timestamptz` | oui | Renseigné à la clôture |

**Règle de clôture** : autorisée seulement si plus aucune affectation de la campagne n'est en `ToDo` et qu'aucun relevé n'est encore `Draft` ou `Submitted` (voir la requête de vérification). Autrement dit : toute parcelle affectée a soit un relevé validé, soit un abandon motivé (`Abandoned`, faille `C1`).

**Paramètre de peuplement `IncludeAlreadySurveyed` (faille `A2`)** — choisi par le Superviseur au lancement, non stocké sur la campagne :

- `false` (défaut) : les parcelles ayant déjà un relevé `Validated` sont exclues. Cas du recensement initial qui progresse par lots.
- `true` : elles sont réintégrées. Cas d'une mise à jour périodique ou d'un contrôle qualité.

Dans les deux cas, les relevés **actifs** (`Draft`/`Submitted`) restent exclus : une parcelle en cours de traitement ne doit jamais être affectée deux fois. Ce paramètre évite de figer dans le code le choix « recensement unique » ou « récurrent » — le métier tranche campagne par campagne.

---

## `CampaignAssignments`

Feuille de route **figée** de la campagne. Peuplée au lancement, une ligne par parcelle retenue. C'est ce que l'agent télécharge et met à jour.

| Colonne | Type | Nullable | Note |
|---|---|---|---|
| `Id` | `uuid` | non (PK) | |
| `CampaignId` | `uuid` | non | FK → `Campaigns.Id`, `ON DELETE CASCADE` |
| `AdresseId` | `uuid` | non | FK → `Adresses.Id`, `ON DELETE CASCADE` |
| `AgentId` | `uuid` | non | FK → `Users.Id`, `ON DELETE RESTRICT` |
| `Status` | `varchar(20)` | non | Enum `AssignmentStatus` : `ToDo` / `Done` / `Abandoned` |
| `AbandonReason` | `varchar(500)` | oui | Obligatoire si `Abandoned` |
| `AbandonedByUserId` | `uuid` | oui | FK → `Users.Id`, `ON DELETE RESTRICT` — le Superviseur qui a décidé |
| `AbandonedAtUtc` | `timestamptz` | oui | |

Index : `(CampaignId)`, `(AgentId)`, `(Status)`, UNIQUE `(CampaignId, AdresseId)` — une parcelle n'est affectée qu'une fois par campagne.

**`AssignmentStatus` reste volontairement pauvre.** La proposition en donnait trois jeux différents selon les paragraphes (`AFaire/Faite`, puis `AFaire/EnCours/Soumis` dans la règle de clôture, tandis que le SQL de vérification interrogeait en fait le statut du relevé). Tranché : le **cycle de vie détaillé appartient au `Survey`** ; l'affectation ne dit que « reste à faire », « traitée » ou « abandonnée ». Un seul endroit porte l'état du relevé, pas deux à tenir synchronisés.

**`Abandoned` (failles `B4` et `C1`)** — sortie terminale décidée par le **Superviseur**, avec motif obligatoire. Sans elle, une parcelle irréductible (agent parti, zone hors périmètre, relevé rejeté que personne ne peut refaire) laisse l'affectation en `ToDo` et **bloque définitivement la clôture de la campagne**. Une affectation `Abandoned` ne bloque pas la clôture, et la campagne close peut expliquer chaque parcelle non traitée.

À ne pas confondre avec `Survey.Outcome = NotSurveyable` : `Abandoned` signifie « personne n'ira », c'est une décision d'organisation qui ne produit aucune donnée sur la parcelle ; `NotSurveyable` signifie « l'agent y est allé et ne peut pas relever », c'est un constat motivé et validé. Voir le tableau comparatif dans la faille `B4`.

**Réaffectation (faille `C2`)** — deux opérations réservées au Superviseur (`tasks.assign`) :

1. **Unitaire** — `PATCH /api/campaign-assignments/{id}/agent`, pour un ajustement ponctuel.
2. **En masse** — transfert de toutes les affectations `ToDo` d'un agent vers un autre. C'est le cas d'usage courant : départ, absence, compte désactivé.

Uniquement sur des affectations en `ToDo` : une affectation `Done` ou `Abandoned` est terminée, et un relevé en cours appartient à son auteur. Sans ces opérations, un agent absent fige ses parcelles — et la FK `RESTRICT` vers `Users` empêche même de supprimer son compte.

**Peuplement au lancement** : parcelles des blocs sélectionnés pour lesquelles il n'existe **aucun relevé actif** (`Submitted` ou `Draft`), plus les `Validated` selon `IncludeAlreadySurveyed`. La proposition citait `EnCours`, valeur qui n'existe dans aucun enum — c'est `Draft` qui était visé.

---

## `Surveys`

Constat réel d'un passage terrain. Créé quand l'agent relève effectivement — **pas pré-généré** à l'ouverture de la campagne. Tous les champs de constat sont remplis à la création.

| Colonne | Type | Nullable | Note |
|---|---|---|---|
| `Id` | `uuid` | non (PK) | **Fourni par le client**, pas généré côté serveur (faille `A4`) |
| `CampaignAssignmentId` | `uuid` | non | FK → `CampaignAssignments.Id`, `ON DELETE CASCADE` |
| `AdresseId` | `uuid` | non | FK → `Adresses.Id` — dénormalisé |
| `AgentId` | `uuid` | non | FK → `Users.Id`, `ON DELETE RESTRICT` |
| `Outcome` | `varchar(20)` | non | Enum `SurveyOutcome` : `Surveyed` / `NotSurveyable` (faille `B4`) |
| `NotSurveyableReason` | `varchar(30)` | oui | Enum `NotSurveyableReason` : `Demolished` / `Inaccessible` / `Refused` / `NotFound`. **Obligatoire si `Outcome = NotSurveyable`** |
| `TypeOccupationId` | `uuid` | **oui** | FK → `TypeOccupations.Id`, `ON DELETE RESTRICT`. Obligatoire si `Outcome = Surveyed` |
| `EtatOccupationId` | `uuid` | **oui** | FK → `EtatOccupations.Id`, `ON DELETE RESTRICT`. Obligatoire si `Outcome = Surveyed` |
| `Name` | `varchar(200)` | oui | Nom du bâtiment / commerce |
| `FloorCount` | `integer` | non | défaut 0 |
| `ApartmentCount` | `integer` | non | défaut 0 |
| `ShopCount` | `integer` | non | défaut 0 |
| `WheelchairAccessible` | `boolean` | non | défaut false |
| `EntryPoint` | `geometry(Point, 4326)` | oui | Porte/portail pointé sur fond satellite — index GiST |
| `GpsCapture` | `geometry(Point, 4326)` | oui | Position brute du téléphone |
| `GpsAccuracyM` | `real` | oui | Précision GPS annoncée à la capture |
| `DistanceFromAddressM` | `real` | oui | Écart `GpsCapture` ↔ position de l'adresse, calculé et stocké à la création (faille `B2`). Nul si aucune position fournie |
| _(photos)_ | — | — | Table `SurveyPhotos` séparée, plusieurs par relevé — voir la section « Photos » |
| `IsMockLocation` | `boolean` | non | défaut false — anti-fraude |
| `Status` | `varchar(20)` | non | Enum `SurveyStatus` : `Draft` / `Submitted` / `Validated` / `Rejected` |
| `RejectionReason` | `varchar(500)` | oui | Renseigné seulement si `Rejected` |
| `ValidatedByUserId` | `uuid` | oui | FK → `Users.Id`, `ON DELETE RESTRICT` — un Superviseur |
| `ValidatedAtUtc` | `timestamptz` | oui | |
| `CapturedAtUtc` | `timestamptz` | non | Horodatage terrain, **fourni par le client** — falsifiable |
| `CreatedAtUtc` | `timestamptz` | non | Horodatage **serveur**, posé à l'insertion (faille `B2`) |

Index : `(AdresseId)`, `(Status)`, `(CampaignAssignmentId)`, GiST sur `(EntryPoint)`, plus un **index unique partiel** sur `(CampaignAssignmentId) WHERE "Status" IN ('Draft','Submitted')`.

**Au plus un relevé *actif* par affectation, pas un seul relevé.** La proposition disait « une affectation reçoit AU PLUS un Releve » ; appliqué littéralement (index unique simple), un relevé rejeté condamnerait l'affectation — l'agent ne pourrait jamais repasser, puisqu'il ne pourrait ni créer un second relevé ni conserver la trace du refus en corrigeant le premier. La contrainte est donc un **index unique partiel** limité aux statuts actifs : les relevés `Rejected` s'accumulent en historique, seule la concurrence de deux relevés en cours est empêchée. C'est exactement le pattern déjà en place sur `BlocSuggestions`/`StreetSuggestions` ([[recensement-geographie]]), pour la même raison : garder qui a proposé quoi et pourquoi ça a été refusé, plutôt que d'écraser une ligne à chaque tentative.

Règle applicative complémentaire : aucun nouveau relevé n'est acceptable sur une affectation qui en a déjà un `Validated` — le travail est terminé, il faut une nouvelle campagne pour repasser.

**`AdresseId` dénormalisé** alors qu'il est déductible via `CampaignAssignment` : la requête la plus fréquente du module (« état courant de chaque parcelle », toutes campagnes confondues) est un `DISTINCT ON (AdresseId)` — la jointure supplémentaire la pénaliserait sans contrepartie. Redondance assumée, à maintenir cohérente à l'écriture.

**`Survey` porte de la géométrie alors qu'`Adresse` n'en a pas** : c'est une table neuve, elle peut être en `geometry(Point, 4326)` sans toucher à l'existant. `EntryPoint` est donc, pour l'instant, la seule position d'adressage réellement spatiale du schéma — les coordonnées de l'`Adresse` restent en `numeric` et doivent être converties à la volée (`ST_SetSRID(ST_MakePoint(...), 4326)`) pour être comparées.

**Anti-fraude** : comparer `GpsCapture` (où était réellement le téléphone) et `EntryPoint` (où l'agent dit que se trouve l'entrée) ; un écart important est un signal à remonter au Superviseur. `IsMockLocation`, `GpsAccuracyM`, `CapturedAtUtc` et `AgentId` sont conservés pour le contrôle a posteriori. Ce sont des **signaux, pas des blocages** : aucun rejet automatique, la décision reste humaine.

**Contrôle de complétude immeuble** : `ApartmentCount` (annoncé par l'agent) comparé au nombre réel de lignes `Units` saisies pour la parcelle.

### Cycle de vie et acteurs

**Le relevé est un acte de terrain, exclusivement.** Seul un `AgentTerrain` peut en créer un, et seulement sur une affectation qui lui est attribuée (`CampaignAssignment.AgentId` = utilisateur courant). Ni le Gestionnaire ni le Superviseur ne saisissent de relevé : le Superviseur ne fait que statuer sur ce que l'agent a rapporté.

```
                    (agent, sur son affectation)
        ∅ ──────────────> Draft ──────────────> Submitted
                            ▲   soumission          │
              correction    │                       │  (superviseur)
                            │              ┌────────┴────────┐
                            │              ▼                 ▼
                            └────────── Rejected          Validated
                       nouveau relevé   (historique)      (terminal)
```

| Transition | Qui | Permission | Règle |
|---|---|---|---|
| ∅ → `Draft` | AgentTerrain | `tasks.submit_for_validation` | Affectation à soi, campagne `InProgress`, aucun relevé actif ni validé sur l'affectation. `Id` fourni par le client, création idempotente |
| `Draft` → `Submitted` | AgentTerrain | `tasks.submit_for_validation` | **Au moins une photo si `Outcome = Surveyed`**, motif obligatoire si `NotSurveyable` |
| `Submitted` → `Validated` | Superviseur | `tasks.validate` | **Interdit sur son propre relevé** (`B1`). Renseigne `ValidatedByUserId`/`ValidatedAtUtc` ; passe l'affectation en `Done` |
| `Submitted` → `Rejected` | Superviseur | `tasks.reject` | Idem `B1`. `RejectionReason` obligatoire ; l'affectation **retourne en `ToDo`** |
| `Submitted` → `Draft` | Superviseur | `tasks.request_correction` | Idem `B1`. Renvoi pour correction sans rejet formel — l'agent reprend le même relevé |
| `Rejected` → … | — | — | État terminal. L'agent repasse sur le terrain et crée un **nouveau** relevé |

**Interdiction de s'auto-valider (faille `B1`).** Les trois transitions de contrôle sont refusées si `Survey.AgentId` est l'utilisateur courant, **quel que soit son rôle**. Le contrôle est implémenté **dans le handler, pas dans une policy d'autorisation** : le bypass Admin de `PermissionAuthorizationHandler` court-circuite les policies mais pas le code du cas d'usage. C'est délibérément la seule règle du système qu'un Admin ne peut pas contourner — sans elle, la validation par un tiers, seule garantie de fiabilité du recensement, ne serait qu'une convention.

Le **cumul de rôles reste autorisé** : une petite équipe peut légitimement avoir la même personne agent sur un quartier et superviseur sur un autre. Ce qui est interdit, c'est de valider *son propre* relevé, pas d'occuper les deux fonctions.

### Relevé impossible : `Outcome = NotSurveyable` (faille `B4`)

Face à un terrain vague, une maison démolie, un portail fermé ou un refus des occupants, l'agent ne doit ni inventer un relevé ni laisser son affectation bloquée. Il soumet un relevé `NotSurveyable` avec un motif (`Demolished` / `Inaccessible` / `Refused` / `NotFound`).

Ce relevé suit **le même cycle de validation** qu'un relevé normal — `Outcome` est une dimension distincte de `Status`, pas un statut supplémentaire. Ce qui change : ni photo ni champs de constat ne sont exigés, `TypeOccupationId` et `EtatOccupationId` restant nuls. On ne décrit pas un bâtiment qu'on n'a pas pu observer.

Un relevé `NotSurveyable` validé passe l'affectation en `Done` : elle est traitée, avec une explication exploitable. À distinguer de `Abandoned` sur l'affectation, qui signifie « personne n'ira » et ne produit aucune donnée.

`Validated` et `Rejected` sont terminaux : un relevé traité ne se rouvre pas. La différence entre rejeter et demander une correction est délibérée — `request_correction` sert quand le constat est bon mais incomplet (photo floue, compteur manquant) et évite de perdre la saisie ; `reject` acte que le constat est faux et impose un nouveau passage terrain.

**Au moins une photo à la soumission, aucune à la création.** `Status = Submitted` exige au moins une ligne `SurveyPhotos` — **sauf si `Outcome = NotSurveyable`**. Un `Draft` est par nature incomplet : l'agent enregistre sa saisie avant que le téléversement, différé jusqu'au retour du réseau, ne soit terminé. La contrainte est portée par le validateur de la transition `Draft → Submitted`.

**`AssignmentStatus` est dérivé, avec un seul écrivain** : `Done` ⟺ il existe un relevé `Validated` pour l'affectation (quel que soit son `Outcome`). Seuls les handlers de validation, de rejet et d'abandon le modifient, ce qui évite la désynchronisation redoutée plus haut. `ToDo` couvre trois situations — jamais relevée, relevé en cours, relevé rejeté à refaire. `Abandoned` est posé exclusivement par le Superviseur.

---

## Photos (faille `A3`)

**Le mobile téléverse lui-même, le backend ne fait que valider et signer la lecture.**
L'application possède ses propres identifiants MinIO ; un service d'arrière-plan envoie les
photos dès que le réseau revient, dans le dossier `surveys/{surveyId}/`, puis transmet l'URL
au backend. Le binaire ne transite jamais par l'API, qui reste sans état.

### `SurveyPhotos`

Un relevé peut porter **plusieurs** photos — d'où une table plutôt qu'une colonne sur `Survey`.

| Colonne | Type | Nullable | Note |
|---|---|---|---|
| `Id` | `uuid` | non (PK) | |
| `SurveyId` | `uuid` | non | FK → `Surveys.Id`, `ON DELETE CASCADE` |
| `ObjectKey` | `varchar(500)` | non | ex. `surveys/{surveyId}/photo-1.jpg` |
| `UploadedAtUtc` | `timestamptz` | non | |

Index UNIQUE `(SurveyId, ObjectKey)` — le service d'envoi différé peut rejouer sans doublon.

**On stocke la clé d'objet, pas l'URL complète.** L'URL de lecture est signée à la demande et
expire : la persister n'aurait aucun sens, et l'hôte du stockage peut changer sans reprise de données.

### Endpoints

- **`POST /api/surveys/{id}/photos`** (AgentTerrain, sur son relevé en brouillon) — reçoit l'URL,
  en extrait la clé après validation, crée la ligne. Idempotent.
- **`GET /api/surveys/{id}/photos`** — régénère à chaque appel des **URLs de lecture signées**
  (`PhotoStorage:ReadUrlExpiryMinutes`, 15 min par défaut) que le navigateur consomme directement.

### Validation de l'URL reçue

Le backend refuse toute URL qui ne pointe pas sur le bucket configuré **et** sur le dossier de
*ce* relevé. Sans ce contrôle, un relevé pourrait référencer n'importe quelle image du web, ou
la photo d'un autre relevé. Les chemins contenant `..` sont également rejetés.

### Point de sécurité côté infrastructure

Des identifiants MinIO embarqués dans l'APK **sont extractibles par décompilation**. Il faut un
utilisateur MinIO dédié, **restreint en écriture seule au préfixe `surveys/`**, sans droit de
lecture ni de suppression — sinon quiconque extrait la clé peut lire ou écraser les photos de
tous les relevés. Le backend n'a besoin, lui, que d'identifiants de **lecture** (`PhotoStorage:AccessKey`).

**À définir** : taille maximale, formats acceptés, compression côté mobile, politique de rétention.

## Travail hors-ligne (faille `A4`)

Le mode nominal de l'agent est le terrain sans réseau. Deux règles en découlent :

**Identifiants générés par le client.** `Survey.Id` et `Unit.Id` sont fournis par l'appareil, pas par `Guid.NewGuid()` côté serveur. Le handler valide le format et l'unicité, mais ne génère plus.

**Création idempotente.** Un `POST` portant un `Id` déjà connu renvoie `200` avec la ressource existante, au lieu de créer un doublon ou d'échouer en `409`. L'appareil peut donc rejouer sans risque tant qu'il n'a pas reçu de réponse — le cas normal après une coupure.

**Ce que cette règle ne couvre pas**, et qui reste ouvert : l'ordre de rejeu d'une file d'opérations accumulées sur une journée, et la résolution de conflit si la campagne a été clôturée ou l'affectation réattribuée pendant la déconnexion. L'idempotence évite les doublons ; elle ne dit pas quoi faire d'un relevé devenu orphelin. À spécifier avec l'équipe mobile.

---

## Contrôle anti-fraude (faille `B2`)

Les signaux ne servent à rien s'ils ne sont ni calculés ni exposés. Trois mesures :

**1. Distance calculée et stockée.** `DistanceFromAddressM` est calculée à la création du relevé (écart entre `GpsCapture` et la position de l'adresse) et **persistée**. Stockée plutôt que recalculée à la lecture parce qu'`Adresse` est en `numeric` et non en géométrie : recalculer à chaque requête imposerait un cast par ligne et interdirait tout filtrage efficace.

**2. Horodatage serveur.** `CreatedAtUtc` est posé par l'API, en plus de `CapturedAtUtc` fourni par le client. Un écart important entre les deux est un signal en soi — sans ce doublon, la seule date disponible serait celle que l'appareil déclare.

**3. File de contrôle.** Un endpoint listant les relevés suspects pour le Superviseur, plutôt qu'un examen un par un : `DistanceFromAddressM` au-delà du seuil, `IsMockLocation = true`, `GpsAccuracyM` dégradée, ou écart `CapturedAtUtc`/`CreatedAtUtc` anormal.

**Seuil configurable** (`Survey:SuspiciousDistanceM`), jamais codé en dur — il devra être calibré sur le terrain réel. **Valeur à confirmer** : l'ordre de grandeur discuté est 50 à 200 m, sans arbitrage à ce jour.

**Pas de blocage dur.** Refuser la soumission au-delà d'un seuil produirait des faux positifs bloquants en zone dense, où le GPS dérive de plusieurs dizaines de mètres. Les signaux restent des signaux : la décision reste humaine.

---

## Suivi et files de travail (failles `C3`, `C4`)

Rien dans le système ne signale spontanément qu'il y a du travail en attente — tout est en *pull*. Sans ces endpoints, un relevé rejeté peut n'être jamais repris, ce qui alimente le blocage de clôture.

- **`GET /api/surveys`** filtrable par statut : `Submitted` pour la file du Superviseur, ses propres `Rejected`/`Draft` pour l'agent (scopé par `AgentId`).
- **Compteurs** sur un endpoint dédié, pour alimenter une pastille d'interface sans rapatrier les listes.
- **`GET /api/campaigns/{id}/progress`** — agrégats par statut d'affectation, par statut de relevé et par agent. C'est le premier écran qu'un Superviseur réclamera, et la clôture se décide dessus.

Le push mobile est hors périmètre backend immédiat. **Conséquence assumée** : le délai de réaction dépend de la fréquence à laquelle chacun consulte l'application.

---

## RBAC

Le catalogue `PermissionNames` contient **déjà**, seedées et jusqu'ici inutilisées, les permissions du workflow terrain prévues de longue date ([[auth]]) — elles sont réutilisées telles quelles plutôt que d'en créer des doublons :

| Permission existante | Usage dans ce module | Rôle |
|---|---|---|
| `tasks.assign` | Créer une campagne, peupler et affecter les `CampaignAssignments` | Superviseur |
| `tasks.validate` | Passer un `Survey` en `Validated` | Superviseur |
| `tasks.reject` | Passer un `Survey` en `Rejected` avec motif | Superviseur |
| `tasks.request_correction` | Renvoyer à l'agent un `Survey` soumis | Superviseur |
| `tasks.view_own` | Lire ses propres affectations et relevés | AgentTerrain |
| `tasks.submit_for_validation` | Créer un `Survey` et le passer `Draft` → `Submitted` | AgentTerrain |

Permissions **à ajouter** : `campaigns.view` et `surveys.view` (lecture de toutes les campagnes / de tous les relevés — Gestionnaire + Superviseur), `units.create/update/view` (Gestionnaire + AgentTerrain pour la saisie terrain). `units.delete` et `campaigns.delete` restent **réservées à Admin** : aucune ligne `RolePermission` seedée, comme le reste du module (cf. le bypass de `PermissionAuthorizationHandler`).

Opérations issues de la revue de failles et leur permission :

| Opération | Permission | Rôle |
|---|---|---|
| Abandonner une affectation (`C1`) | `tasks.assign` | Superviseur |
| Réaffecter une parcelle, à l'unité ou en masse (`C2`) | `tasks.assign` | Superviseur |
| Consulter la file des relevés suspects (`B2`) | `surveys.view` | Superviseur + Gestionnaire |
| Consulter l'avancement d'une campagne (`C4`) | `campaigns.view` | Superviseur + Gestionnaire |
| Rattacher une photo à son relevé (`A3`) | `tasks.submit_for_validation` | AgentTerrain, sur son propre relevé |
| Lire les photos d'un relevé | `tasks.view_own` **ou** `surveys.view` | Agent (les siennes) + Superviseur/Gestionnaire |

Permissions **à retirer** : `occupations.create/update/delete/view`, sans objet une fois la table supprimée. `surveys.view` les remplace en lecture ; l'écriture passe par `tasks.submit_for_validation` (agent) et `tasks.validate`/`tasks.reject` (superviseur), et non plus par un CRUD ouvert au Gestionnaire — **c'est un changement de modèle d'autorisation, pas un simple renommage** : le Gestionnaire ne saisit plus lui-même ce qui occupe une adresse, il consulte ce que le terrain a relevé et qu'un superviseur a validé.

**Scoping fin de l'agent** : `tasks.view_own` ne se contrôle pas par une permission seule — le handler doit filtrer `WHERE AgentId = <utilisateur courant>`. Un agent ne voit ni les affectations ni les relevés des autres, et ne peut relever que sur une affectation qui lui est attribuée : un agent qui poste un relevé sur l'affectation d'un collègue reçoit un `403`, même s'il détient `tasks.submit_for_validation`. Le contrôle porte sur `CampaignAssignment.AgentId`, pas seulement sur la permission.

**Aucune permission de création de relevé pour le Gestionnaire ni le Superviseur.** C'est volontaire et structurant : le relevé atteste d'un passage physique sur le terrain, il n'a pas de sens créé depuis un bureau. Le Superviseur agit uniquement sur des relevés existants (`tasks.validate`/`tasks.reject`/`tasks.request_correction`), le Gestionnaire n'a que la lecture (`surveys.view`).

**Piège de dev, quatrième occurrence** : `DbInitializer.SeedPermissionsAsync`/`SeedRolePermissionsAsync` ne (re)seedent rien si les tables `Permissions`/`RolePermissions` ne sont pas vides. La base de dev locale étant déjà provisionnée, les nouvelles permissions devront être insérées **en SQL** après migration — rappel : `RolePermissions` a une clé primaire composite `(RoleId, PermissionId)` et pas de colonne `Id`.

---

## Requêtes clés

### État courant d'une parcelle (dernier relevé validé)

```sql
SELECT DISTINCT ON (s."AdresseId") s.*
FROM public."Surveys" s
WHERE s."Status" = 'Validated'
ORDER BY s."AdresseId", s."CapturedAtUtc" DESC;
```

`DISTINCT ON` n'est **pas traduisible en LINQ** — EF Core ne le génère pas. À exécuter en SQL brut (`FromSql`) ou derrière une vue Postgres mappée en lecture seule. À trancher à l'implémentation ; la vue est probablement préférable, la même logique servant aussi la requête de livraison ci-dessous.

**Attention au `Outcome`** : cette requête renvoie le dernier relevé validé quel qu'il soit, y compris un `NotSurveyable`. C'est voulu — « démoli » ou « introuvable » est une information d'état légitime, et la masquer laisserait croire que la parcelle n'a jamais été visitée. Mais le consommateur doit alors gérer des `TypeOccupationId`/`EtatOccupationId` **nuls** : filtrer sur `Outcome = 'Surveyed'` si l'on veut strictement « ce qui occupe la parcelle ».

### Position de livraison (entrée relevée si validée, sinon coordonnées de l'adresse)

```sql
SELECT a."Id",
       COALESCE(
           sv."EntryPoint",
           ST_SetSRID(ST_MakePoint(a."Longitude"::float8, a."Latitude"::float8), 4326)
       ) AS delivery_point
FROM public."Adresses" a
LEFT JOIN LATERAL (
    SELECT s."EntryPoint"
    FROM public."Surveys" s
    WHERE s."AdresseId" = a."Id"
      AND s."Status" = 'Validated'
      AND s."EntryPoint" IS NOT NULL
    ORDER BY s."CapturedAtUtc" DESC
    LIMIT 1
) sv ON true;
```

Le cast depuis `numeric` est le prix du choix de ne pas toucher à `Adresses` : `ST_MakePoint` attend des `float8`. Il disparaîtra si `Adresse` gagne un jour une colonne `Location` géométrique.

### Peuplement d'une campagne (par blocs sélectionnés, à l'affectation)

```sql
INSERT INTO public."CampaignAssignments" ("Id","CampaignId","AdresseId","AgentId","Status")
SELECT gen_random_uuid(), @campaignId, a."Id", @agentId, 'ToDo'
FROM public."Adresses" a
WHERE a."BlocId" = ANY(@selectedBlocIds)
  AND NOT EXISTS (
        SELECT 1 FROM public."Surveys" s
        WHERE s."AdresseId" = a."Id"
          AND (s."Status" IN ('Submitted','Draft')
               OR (s."Status" = 'Validated' AND NOT @includeAlreadySurveyed))
  )
ON CONFLICT ("CampaignId","AdresseId") DO NOTHING;
```

Les relevés `Draft`/`Submitted` excluent toujours la parcelle : un relevé en cours ne doit jamais être doublé par une seconde affectation. Seuls les `Validated` sont réintégrables, sur décision du Superviseur (`@includeAlreadySurveyed`, faille `A2`).

### Vérification avant clôture de campagne (doit renvoyer 0)

```sql
SELECT count(*)
FROM public."CampaignAssignments" ca
WHERE ca."CampaignId" = @campaignId
  AND (ca."Status" = 'ToDo'
       OR EXISTS (SELECT 1
                  FROM public."Surveys" s
                  WHERE s."CampaignAssignmentId" = ca."Id"
                    AND s."Status" IN ('Draft','Submitted')));
```

La proposition faisait cette vérification par un `LEFT JOIN` sur `Releves` — correct tant qu'une affectation n'avait qu'un relevé, faux dès lors qu'elle peut en accumuler après rejet : la jointure produit une ligne par relevé et compte plusieurs fois la même affectation. Le `EXISTS` est insensible au nombre de relevés.

Le second terme est théoriquement redondant avec `Status = 'ToDo'` (une affectation ayant un relevé actif n'est pas `Done`), mais il rattrape toute dérive de l'invariant plutôt que de clôturer une campagne sur un état incohérent.

Les affectations `Abandoned` ne sont **pas** comptées : c'est précisément leur raison d'être (faille `C1`). Sans ce statut, une seule parcelle irréductible rendrait la campagne inclôturable à vie.

### Relevés suspects (faille `B2`)

```sql
SELECT s.*
FROM public."Surveys" s
WHERE s."Status" IN ('Submitted','Validated')
  AND (s."DistanceFromAddressM" > @suspiciousDistanceM
       OR s."IsMockLocation"
       OR s."CapturedAtUtc" > s."CreatedAtUtc" + interval '1 day'
       OR s."CapturedAtUtc" < s."CreatedAtUtc" - interval '7 days')
ORDER BY s."DistanceFromAddressM" DESC NULLS LAST;
```

Les bornes temporelles sont asymétriques à dessein : un relevé **antérieur** à son enregistrement est normal (saisie hors ligne synchronisée plus tard, jusqu'à plusieurs jours), un relevé **postérieur** ne l'est pas — c'est une horloge d'appareil avancée, volontairement ou non.

---

## Points ouverts

Ne restent ici que les questions **non tranchées**. Les failles traitées le 2026-08-09 sont intégrées au corps du document ; celles volontairement laissées de côté figurent dans la dette technique ci-dessous.

- **Seuil de suspicion GPS** (`Survey:SuspiciousDistanceM`) : ordre de grandeur discuté 50–200 m, sans arbitrage. Seul paramètre de `B2` encore ouvert ; configurable, donc modifiable sans migration.
- **Politique photo** : taille maximale, formats, compression mobile, durée de vie des URL pré-signées, rétention.
- **File d'opérations hors-ligne** : l'idempotence (`A4`) évite les doublons mais ne dit rien de l'ordre de rejeu ni du conflit avec une campagne clôturée entre-temps. À spécifier avec l'équipe mobile.
- **Évolutions du socle différées** : `MultiPolygon`, `Quartiers.Code`, `Adresse` en parcelle avec emprise. Bloquent partiellement `B2` — tant qu'`Adresse` est en `numeric`, le contrôle de distance impose un cast et se prive d'index spatial.
- **Import GIS** : format de livraison de l'expert (Shapefile ? GeoJSON ? dump SQL ?) et rattachement spatial (`ST_Contains`) non spécifiés. Lié à `A1`.
- **Contraintes topologiques** (`ST_IsValid`, non-chevauchement entre polygones frères, inclusion `Bloc ⊂ Quartier ⊂ City`) — non appliquées en base, héritées de [[recensement-geographie]].

### Rappel : pas de saisie « bureau »

Décision actée, plus un point ouvert : il n'existe aucune saisie de ce qui occupe une adresse en dehors du terrain. La disparition d'`Occupation` ne laisse pas de trou à combler — le relevé est réservé aux agents, et un Gestionnaire ne peut pas créer de `Survey`, même pré-validé. Toute reprise de données existantes passera par un import direct en base, hors API.

## Dette technique assumée

Quatre failles de la revue restent ouvertes en connaissance de cause — détail et conséquences dans [`docs/failles-recensement.md`](../failles-recensement.md).

| ID | Faille | Ce qu'on perd |
|---|---|---|
| **A1** | Les adresses doivent exister avant le terrain | L'exhaustivité. Le socle reste alimenté à la main par le Gestionnaire ; une adresse découverte sur le terrain ne peut être ni relevée ni signalée. **Aucun chiffre du système ne peut être présenté comme un décompte exhaustif.** |
| **C5** | Périmètre de campagne non stocké | La traçabilité de l'intention : impossible de distinguer « bloc non retenu » de « bloc retenu mais sans adresse connue » — d'autant plus probable que `A1` est en dette. |
| **D1** | `Street` raccordée à rien | La justification d'un module entier, maintenu sans usage produit tant que la question « une adresse djiboutienne comporte-t-elle une rue ? » n'est pas tranchée. |
| **D3** | Permissions `*.delete` absentes en base | La cohérence du catalogue vis-à-vis de la base. Sans effet tant qu'aucune UI ne liste les permissions. |

`A1` est la seule classée **bloquante** : elle est en dette parce qu'un contournement manuel existe, pas parce que son impact serait faible. À rouvrir dès la première campagne réelle si le volume de saisie se révèle intenable.

---

## État actuel

**Livré le 2026-08-09** sur la branche `feat/schema-recensement-releves`.

Fait :
- **5 tables neuves** (`Units`, `Campaigns`, `CampaignAssignments`, `Surveys`, `SurveyPhotos`) + suppression d'`Occupations`, en trois migrations (`AddCensusCampaignsAndSurveys`, `AdresseAsParcelAndQuartierCode`, `AddSurveyPhotos`), appliquées en local.
- **21 endpoints** sous `/api/units`, `/api/campaigns`, `/api/campaign-assignments`, `/api/surveys`, agrégés par `WebApi/Features/Recensement/RecensementEndpoints.cs`.
- **Stockage objet MinIO** ajouté au `docker-compose.yml` (bucket `das-survey-photos`, console sur :9001), section `PhotoStorage` dans les `appsettings`.
- **11 des 12 failles retenues résolues**, 1 partielle (`C3`) — voir [`docs/failles-recensement.md`](../failles-recensement.md).
- **Permissions** : `campaigns.view`, `surveys.view`, `units.*` ajoutées au catalogue et seedées ; `occupations.*` retirées. Insérées en SQL sur la base de dev déjà provisionnée (piège de dev habituel).
- **Index d'unicité `D2`** posés sur `Cities.Name`, `(CityId, Nom)` et `(QuartierId, Code)`, doublés d'un contrôle applicatif renvoyant `409`.
- **Tests de bout en bout : 73 assertions HTTP, toutes vertes.** Chaîne complète ville → quartier → bloc → adresse → campagne → affectation → relevé → validation → clôture ; idempotence du rejeu (200 vs 201) ; refus du second relevé actif (409) ; photo obligatoire (400) ; gel des unités (409) et scoping agent (403) ; état courant ; avancement et clôture. **La règle d'auto-validation (`B1`) est vérifiée dans son vrai cas** : un compte cumulant `AgentTerrain` et `Superviseur` reçoit `403 Surveys.SelfReview` sur son propre relevé alors qu'il détient `tasks.validate`, tandis qu'un tiers valide bien.

Quatre bugs trouvés par ces tests et corrigés : `CapturedAtUtc` arrivant du client avec `Kind=Local` faisait échouer l'écriture en `timestamptz` (500 sur toute création de relevé horodatée avec fuseau), `GET /api/surveys/current` renvoyait 400 quand `surveyedOnly` était omis, **`GET /api/surveys` était inaccessible au Superviseur** (gardé par `tasks.view_own`, que seul l'AgentTerrain détient — sa file de travail, l'objet même de `C3`, lui était fermée), et les URLs de lecture MinIO étaient signées en `https` alors que le service écoute en clair. Le premier point a nécessité un `RequireAnyPermission(...)` : un endpoint qui sert deux publics par des chemins différents ne peut pas exiger une permission unique.

Pas encore fait :
- **Endpoint de compteurs** (`C3`, piste 2).
- **Durcissement MinIO** : créer l'utilisateur dédié en écriture seule sur `surveys/` pour le mobile (les identifiants de dev sont aujourd'hui ceux du root), et définir taille max, formats et rétention.
- Les 4 failles en dette technique (`A1`, `C5`, `D1`, `D3`).
- Mise à jour de `docs/schema-recensement-gis.md` (diagramme ER, table `Occupations` encore décrite).

### Divergences base ↔ modèle rencontrées en cours de route

La table `Adresses` avait été modifiée directement en base, hors migration : `Boundary` (MultiPolygon) et `Location` (Point) à la place de `Latitude`/`Longitude`. **Le code a été aligné sur la base**, ce qui met en œuvre la refonte « Adresse en parcelle » listée plus haut comme différée — `Adresse.Location` est calculée via `InteriorPoint` (équivalent NTS de `ST_PointOnSurface`), et `AdresseResponse` expose désormais `boundaryWkt`/`locationWkt` au lieu de `latitude`/`longitude`. La génération serveur de `Numero` reste, elle, non implémentée.

`Quartier.Code` a été ajouté à l'entité côté domaine mais n'était ni renseigné à la création, ni présent en base : le champ a été câblé de bout en bout (`Create`, requests, validateurs, réponses) et la colonne ajoutée. **Pas d'index unique dessus** : les quartiers existants n'avaient pas de code, la contrainte aurait échoué — codes rétro-attribués (`Q01`…`Q06`), unicité à poser après reprise.

Ces deux changements sont couverts par la migration `AdresseAsParcelAndQuartierCode`, correcte pour une base vierge. Sur la base de dev, seule la colonne `Quartiers.Code` a été appliquée (le reste y était déjà) et la migration marquée comme appliquée.

### Ordre de livraison suivi

0. **Infrastructure photo** (`A3`) — service MinIO dans `docker-compose.yml`, bucket, endpoint d'URL pré-signée. **En préalable au lot 3** : sans lui, aucun relevé n'atteint `Submitted` et le workflow n'est pas testable de bout en bout.
1. **`Units`** — entité, configuration EF, CRUD, avec les règles de gel et de scoping (`B3`) et l'`Id` client (`A4`). Indépendante des trois autres, livrable seule.
2. **`Campaigns` + `CampaignAssignments`** — création de campagne, peuplement avec `IncludeAlreadySurveyed` (`A2`), affectation, réaffectation unitaire et en masse (`C2`), abandon motivé (`C1`), avancement (`C4`).
3. **`Surveys`** — création idempotente (`A4`), soumission avec photo ou motif `NotSurveyable` (`B4`), validation/rejet avec interdiction d'auto-validation (`B1`), distance et horodatage serveur (`B2`), files de travail (`C3`), requête d'état courant.
4. **Suppression d'`Occupations`** — après le lot 3, jamais avant : `Survey` doit être opérationnel pour que l'API ne perde aucune capacité entre les deux. Suivre l'inventaire ci-dessus.
5. **Permissions** — ajout au catalogue (`campaigns.*`, `surveys.*`, `units.*`), retrait d'`occupations.*`, seed, et insertion SQL sur la base de dev déjà provisionnée.
6. **Index d'unicité** (`D2`) — `City.Name`, `(CityId, Nom)` sur `Quartier`, `(QuartierId, Code)` sur `Bloc`, plus les contrôles applicatifs `409`. **Vérifier et dédoublonner la base avant**, la migration échouera sinon.

Une seule migration EF Core (`CreateTable` × 4, `DropTable` × 1, `CreateIndex` × 3) peut couvrir l'ensemble ; la découper n'a d'intérêt que si les lots sont livrés à des dates différentes — auquel cas le `DropTable` doit rester dans la dernière.
