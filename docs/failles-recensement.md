# Failles du module Recensement — revue du 2026-08-09

Revue critique du processus de recensement tel que défini par [`docs/plans/schema-recensement.md`](plans/schema-recensement.md) et le RBAC existant ([`docs/plans/auth.md`](plans/auth.md), [`docs/plans/recensement-geographie.md`](plans/recensement-geographie.md)).

**Usage** : document de travail, à reprendre faille par faille. Chaque entrée porte un identifiant stable (`A1`, `B3`…) pour être citée en discussion, en commit ou en issue. Les décisions prises ici sont répercutées dans la spec — ce fichier n'est pas la source de vérité de la conception, il en est la liste de contrôle.

> **Révision du 2026-08-23.** Trois changements depuis la revue d'origine : `A1` est
> **factuellement périmée** (le socle n'est pas vide, 28 474 parcelles cadastrales dorment en
> base — voir sa fiche), `A3` était marquée `Résolue` au récapitulatif alors que sa fiche dit
> `Partielle` (corrigé), et une **section `E`** est ajoutée pour l'introduction de la `Close`.
> La conception de l'adressage vit désormais dans [`docs/plans/adressage.md`](plans/adressage.md),
> qui fait autorité ; les entrées `E` n'en sont que la liste de contrôle.

**Statuts** :
- `Retenue` — piste choisie le 2026-08-09, à implémenter. Reportée dans la spec.
- `Dette technique` — faille reconnue, correction non planifiée dans ce lot. Reste ouverte, assumée en connaissance de cause.
- `Résolue` — implémentée et vérifiée.
- `Requalifiée` — le constat d'origine ne décrit plus la réalité ; la fiche est réécrite (2026-08-23).
- `À faire` — arbitrée, spécifiée, pas encore implémentée.

## Récapitulatif

| ID | Faille | Gravité | Statut | Décision |
|---|---|---|---|---|
| **A1** | Les adresses doivent exister avant le terrain — processus circulaire | Bloquante | **Requalifiée** | Le socle n'est pas saisi à la main : il est **importé du cadastre**, et 92 % reste à promouvoir |
| **A2** | La deuxième campagne sera vide | Bloquante | **Résolue** | Paramètre `includeAlreadySurveyed` au peuplement |
| **A3** | Photo obligatoire sans chaîne de téléversement | Bloquante | **Partielle** | Chaîne MinIO livrée ; taille max, formats, compression et rétention non définis |
| **A4** | Travail hors-ligne non traité | Bloquante | **Résolue** | `Id` client + POST idempotent (200 sur rejeu) |
| **B1** | Un agent peut valider ses propres relevés | Critique | **Résolue** | Refus dans le handler, vérifié sur un compte cumulant les rôles |
| **B2** | Anti-fraude collectée mais jamais exploitée | Critique | **Résolue** | Distance stockée + `CreatedAtUtc` + `GET /api/surveys/suspicious` |
| **B3** | Les `Units` échappent au cycle de validation | Critique | **Résolue** | Gel à la validation + écriture scopée à l'affectation |
| **B4** | Aucun moyen de déclarer « inaccessible » ou « n'existe pas » | Critique | **Résolue** | `Outcome=NotSurveyable` + `Abandoned` sur l'affectation |
| **C1** | Une campagne peut devenir impossible à clôturer | Majeure | **Résolue** | `Abandoned` motivé, ne bloque plus la clôture |
| **C2** | Pas de réaffectation d'une parcelle à un autre agent | Majeure | **Résolue** | Réaffectation unitaire + transfert en masse |
| **C3** | Aucune notification, tout est en *pull* | Majeure | **Partielle** | Filtres par statut livrés ; pas d'endpoint de compteurs dédié |
| **C4** | Aucun suivi d'avancement | Majeure | **Résolue** | `GET /api/campaigns/{id}/progress` |
| **C5** | Le périmètre visé par une campagne n'est pas stocké | Mineure | **Dette technique** | — |
| **D1** | `Street` n'est raccordée à rien et n'apparaît dans aucune adresse | Majeure | **Dette technique** | — |
| **D2** | Unicités manquantes sur les noms et codes | Mineure | **Résolue** | 3 index uniques + contrôle applicatif 409 |
| **D3** | Les permissions `*.delete` n'existent pas en base | Mineure | **Dette technique** | — |
| **E1** | Les composants du code d'adresse sont vides en base — aucun code calculable | Bloquante | **À faire** | Renseigner `City.Code`, `Quartier.AreaNumber`, `Bloc.Number` |
| **E2** | Le format du code d'adresse change, et la fenêtre se referme au 1er relevé validé | Bloquante | **À faire** | Passer à 5 segments **avant** toute validation `Definitive` |
| **E3** | `(CloseId, Numero)` n'est pas indexable — `Adresse` ne porte pas `CloseId` | Critique | **À faire** | Dénormaliser `Adresse.CloseId` |
| **E4** | `Bloc.QuartierId` → `Bloc.CloseId` casse les consommateurs existants | Majeure | **À faire** | Recenser et migrer joins, vue `blocs_tiles`, `GET /api/blocs?quartierId=` |

**État au 2026-08-09 : 10 résolues, 2 partielles, 4 en dette technique.**
**Ajouté le 2026-08-23 : 1 requalifiée (`A1`), 4 à faire (`E1`–`E4`).**

Les statuts `Résolue` sont vérifiés par les tests de bout en bout (73 assertions HTTP, toutes vertes) décrits dans [`docs/plans/schema-recensement.md`](plans/schema-recensement.md). Les deux `Partielle` sont `A3` (politique de rétention des photos) et `C3` (endpoint de compteurs).

---

# A. Bloquantes

## A1 — Les adresses doivent exister avant le terrain

**Gravité** : bloquante · **Statut** : Requalifiée (2026-08-23)

> ⚠️ **La décision de 2026-08-09 reposait sur un constat faux.** Elle affirmait que le socle est
> « alimenté à la main par le Gestionnaire » et qu'« aucune campagne ne peut couvrir plus de
> parcelles que le Gestionnaire n'en a créées une par une ». **C'est démenti par la base.**

**Constat (révisé).** Une `Adresse` doit toujours exister avant qu'un agent y soit affecté — ça,
c'est inchangé. Mais elle n'est **pas** saisie à la main : le cadastre est **déjà importé** en
PostGIS et exposé par Martin. Relevé le 2026-08-23 :

| | Cadastre (PostGIS brut) | Référentiel (EF) | Promu |
|---|---|---|---|
| Parcelles → `Adresses` | `das_parcelles` : **28 474** | **2 512** | 8,8 % |
| Îlots → `Blocs` | `das_ilots` : **3 700** | **309** | 8,4 % |
| Quartiers | **69** | **6** | — |

Ce chiffre global est trompeur : **le référentiel ne couvre qu'un seul quartier, et il le couvre
presque entièrement.** Quartier 7 : 309/309 îlots (**100 %**), 2 502/2 547 parcelles (**98,2 %**,
vérifié par `ST_Equals` entre `Adresses.Boundary` et `das_parcelles.geom`). Les 5 autres quartiers
du référentiel sont des **coquilles vides** — 0 bloc, 0 adresse.

**Le vrai sujet n'est donc pas la saisie, c'est le rapprochement cadastre → référentiel.**
Périmètre pilote traité à fond, 68 quartiers pas encore entrés.

**Dette réelle qui subsiste :**
- **Aucune traçabilité parcelle → adresse.** `Adresses` n'a pas de colonne pointant vers
  `das_parcelles`. Le lien n'est retrouvable que par comparaison géométrique (`ST_Equals`), ce qui
  interdit de répondre à « cette parcelle est-elle déjà promue ? » à coût raisonnable. **C'est ce
  qu'il faut corriger en priorité**, pas la saisie manuelle.
- **`AdresseSuggestion` reste absente.** Un agent qui trouve une construction hors cadastre ne
  peut toujours pas la signaler. Le pattern existe deux fois (`BlocSuggestion`, `StreetSuggestion`).
- Les 10 adresses (sur 2 512) sans parcelle cadastrale correspondante sont soit saisies à la main,
  soit retouchées depuis — indistinguables faute de traçabilité.

**Ce qui n'est PAS un sujet backend** : faire entrer les 68 autres quartiers, c'est rejouer le
script PostGIS qui a produit Quartier 7. Travail d'outillage, pas de code applicatif.

---

## A2 — La deuxième campagne sera vide

**Gravité** : bloquante · **Statut** : Résolue

**Constat.** La requête de peuplement exclut toute adresse ayant un relevé en `Validated`, `Submitted` ou `Draft` — sans borne de date ni de campagne. Une parcelle validée n'est plus jamais sélectionnable.

**Décision (2026-08-09) — piste 3.** Le peuplement prend un paramètre explicite **« inclure les parcelles déjà relevées »**, décidé par le Superviseur au lancement de la campagne.

- Par défaut (`false`) : comportement actuel, on ne repasse pas sur ce qui est validé — le cas d'un recensement initial qui progresse par lots.
- À `true` : les parcelles déjà validées sont réintégrées — le cas d'une mise à jour périodique ou d'un contrôle qualité.

Dans les deux cas, les relevés **actifs** (`Draft`/`Submitted`) restent exclus : une parcelle en cours de traitement ne doit jamais être affectée deux fois.

Le choix n'a pas à être tranché au niveau du produit : le paramètre laisse le métier décider campagne par campagne, sans figer « one-shot » ou « récurrent » dans le code.

---

## A3 — Photo obligatoire sans chaîne de téléversement

**Gravité** : bloquante · **Statut** : Partielle

**Constat.** La spec impose une photo pour soumettre un relevé, mais `PhotoUrl` n'est qu'une colonne texte : ni endpoint d'upload, ni stockage, ni rétention.

**Décision (2026-08-09), révisée.** La piste retenue au départ — le backend délivre une URL
de téléversement pré-signée — a été remplacée par l'architecture réellement voulue : **le mobile
possède ses propres identifiants MinIO et téléverse lui-même**, via un service d'arrière-plan qui
part dès que le réseau revient. Il transmet ensuite l'URL au backend. Le backend n'écrit jamais
dans le stockage ; il ne fait que valider l'URL et **signer des URLs de lecture** pour la partie web.

Conséquences sur le schéma :
- **`Survey.PhotoUrl` (colonne unique) est remplacée par la table `SurveyPhotos`** : un relevé
  peut porter plusieurs photos, toutes déposées dans le dossier `surveys/{surveyId}/`.
- On stocke la **clé d'objet**, pas l'URL complète : l'URL de lecture est signée à la demande et
  expire, la conserver n'aurait aucun sens, et l'hôte du stockage peut changer sans reprise.
- Index unique `(SurveyId, ObjectKey)` : le service d'envoi différé peut rejouer sans créer de doublon.
- La règle de soumission devient « **au moins une** photo » pour un relevé `Surveyed`.

**Validation de l'URL reçue.** Le backend refuse toute URL qui ne pointe pas sur le bucket
configuré **et** sur le dossier de *ce* relevé. Sans ce contrôle, un relevé pourrait référencer
n'importe quelle image du web, ou la photo d'un autre relevé.

**Point de sécurité à traiter côté infrastructure.** Des identifiants MinIO embarqués dans
l'application mobile sont extractibles par décompilation. Il faut un utilisateur MinIO dédié,
**restreint en écriture seule au préfixe `surveys/`**, sans droit de lecture ni de suppression —
sinon quiconque extrait la clé peut lire ou écraser les photos de tous les relevés. Le backend,
lui, n'a besoin que d'identifiants de **lecture**.

**Implémenté et vérifié le 2026-08-09** (17 assertions) : refus d'une URL hors bucket, du dossier
d'un autre relevé, et d'un autre bucket ; dépôt réel de deux fichiers dans MinIO puis rattachement ;
idempotence du rejeu ; téléchargement effectif via l'URL signée ; **refus de l'accès non signé**
(bucket bien privé) ; soumission débloquée une fois les photos présentes.

**Reste à définir** : taille maximale, formats acceptés, compression côté mobile, politique de
rétention. `PhotoStorage:ReadUrlExpiryMinutes` vaut 15 minutes par défaut.

---

## A4 — Travail hors-ligne non traité

**Gravité** : bloquante · **Statut** : Résolue

**Constat.** Le mode nominal de l'agent est le terrain sans réseau, alors que la spec suppose partout un appel API synchrone.

**Décision (2026-08-09) — piste 1.** **`Survey.Id` est généré par l'appareil**, et la création est **idempotente** : un `POST` portant un `Id` déjà connu renvoie `200` avec la ressource existante au lieu de créer un doublon ou d'échouer en `409`.

Ce que ça implique :
- Le handler de création n'appelle plus `Guid.NewGuid()` — l'`Id` vient de la requête et doit être validé (format, non vide).
- Le rejeu d'une requête après coupure devient sûr : l'appareil peut renvoyer sans risque tant qu'il n'a pas reçu de réponse.
- **Même principe à appliquer aux `Units`**, saisies dans les mêmes conditions de terrain. Sans ça, une synchronisation rejouée duplique les unités d'un immeuble.
- **Non couvert par cette piste, et donc encore ouvert** : l'ordre de rejeu d'une file d'opérations, et la résolution de conflit si la campagne a été clôturée ou l'affectation réattribuée pendant la déconnexion. L'idempotence évite les doublons, elle ne dit pas quoi faire d'un relevé devenu orphelin. À spécifier avec l'équipe mobile.

---

# B. Failles de contrôle

## B1 — Un agent peut valider ses propres relevés

**Gravité** : critique · **Statut** : Résolue

**Constat.** Les rôles étant multiples par utilisateur, un même compte peut porter `AgentTerrain` et `Superviseur` et s'auto-valider. Le bypass Admin de `PermissionAuthorizationHandler` produit le même effet pour un Admin.

**Décision (2026-08-09) — piste 1.** **Contrôle dans le handler** : `tasks.validate`, `tasks.reject` et `tasks.request_correction` sont refusés si `Survey.AgentId` est l'utilisateur courant, **quel que soit son rôle**.

Point d'attention à l'implémentation : le contrôle doit être **dans le handler**, pas dans une policy d'autorisation, précisément pour qu'il s'applique aussi à l'Admin — le bypass de rôle court-circuite les policies mais pas le code du cas d'usage. C'est la seule règle du système qu'un Admin ne peut pas contourner, et c'est intentionnel.

Le cumul de rôles reste autorisé (piste 2 écartée) : une petite équipe peut légitimement avoir la même personne agent sur un quartier et superviseur sur un autre. Ce qui est interdit, c'est de valider **son propre** relevé, pas d'occuper les deux fonctions.

---

## B2 — Anti-fraude collectée mais jamais exploitée

**Gravité** : critique · **Statut** : Résolue

**Constat.** `IsMockLocation`, `GpsAccuracyM` et l'écart `GpsCapture` ↔ `EntryPoint` sont stockés sans seuil, sans calcul et sans endpoint. `CapturedAtUtc` vient du client, donc falsifiable.

**Décision (2026-08-09) — pistes 1, 2 et 3 cumulées.**

1. **Distance calculée et stockée.** `Survey.DistanceFromAddressM` est calculée à la création (écart entre `GpsCapture` et la position de l'adresse) et persistée. Stockée plutôt que recalculée à la lecture, parce que l'`Adresse` est en `numeric` et non en géométrie (`B2` aggravant 2) : recalculer à chaque requête interdirait tout filtrage efficace. Nulle si l'appareil n'a fourni aucune position.
2. **`CreatedAtUtc` serveur** en plus de `CapturedAtUtc` client. Un écart important entre les deux est un signal en soi.
3. **File de contrôle** — endpoint listant les relevés suspects pour le Superviseur, plutôt qu'un examen un par un.

**Seuil de suspicion** : configurable (`Survey:SuspiciousDistanceM`), pas codé en dur — il devra être calibré sur le terrain réel. **Valeur à confirmer** : l'ordre de grandeur discuté est 50 à 200 m, sans arbitrage à ce jour. C'est le seul point de `B2` qui reste ouvert.

**Piste 4 (blocage dur) écartée** : refuser la soumission au-delà d'un seuil produirait des faux positifs bloquants en zone dense où le GPS dérive. Les signaux restent des signaux, la décision reste humaine.

---

## B3 — Les `Units` échappent au cycle de validation

**Gravité** : critique · **Statut** : Résolue

**Constat.** `Unit` est rattachée à l'`Adresse` et non au `Survey` — les unités sont donc modifiables librement, y compris après validation du relevé, et par n'importe quel agent sur n'importe quelle adresse.

**Décision (2026-08-09) — pistes 1 et 2 cumulées.**

1. **Gel à la validation.** Les `Units` d'une adresse ayant un relevé `Validated` ne sont plus modifiables, sauf dans le cadre d'une nouvelle campagne où l'adresse est réaffectée.
2. **Écriture scopée.** Un agent ne peut créer ou modifier des unités que sur une adresse qui lui est **affectée dans une campagne en cours**. Même contrôle que pour le relevé lui-même.

Le modèle reste inchangé (les unités restent rattachées à l'adresse, pas au relevé) : on ne perd pas leur stabilité entre campagnes, on encadre seulement qui peut les toucher et quand. Le contrôle de complétude immeuble (`ApartmentCount` vs nombre de `Units`) retrouve sa valeur, puisque les deux sont figés au même moment.

---

## B4 — Aucun moyen de déclarer « inaccessible » ou « n'existe pas »

**Gravité** : critique · **Statut** : Résolue

**Constat.** Face à un terrain vague, une maison démolie ou un portail fermé, l'agent n'a que `Draft`/`Submitted` : soit il invente un relevé, soit il laisse son affectation bloquée.

**Décision (2026-08-09) — pistes 1 et 2 cumulées.** Ce sont **deux sorties distinctes**, pas deux façons de faire la même chose :

| | `Outcome = NotSurveyable` (piste 1) | `Status = Abandoned` (piste 2) |
|---|---|---|
| Qui décide | L'agent, sur place | Le Superviseur |
| Porté par | Le relevé (`Survey`) | L'affectation (`CampaignAssignment`) |
| Signification | **L'agent y est allé** et ne peut pas relever | **Personne n'ira** — décision d'organisation |
| Cas typiques | Démoli, inaccessible, refus des occupants, introuvable | Agent parti, zone hors périmètre, arbitrage de fin de campagne |
| Validation | Oui, comme un relevé normal | Non, décision unilatérale du Superviseur |
| Trace produite | Un relevé motivé, exploitable | Aucune donnée sur la parcelle |

Conséquences sur le schéma :
- `Survey` gagne un champ **`Outcome`** (`Surveyed` / `NotSurveyable`), distinct de `Status` — le cycle de validation s'applique aux deux, ce n'est pas un statut de plus.
- **`NotSurveyableReason` obligatoire** quand `Outcome = NotSurveyable` (démoli / inaccessible / refus / introuvable).
- Un relevé `NotSurveyable` **n'exige ni photo ni champs de constat** : on ne décrit pas un bâtiment qu'on n'a pas pu observer. `TypeOccupationId` et `EtatOccupationId` deviennent donc **nullables**, requis uniquement si `Outcome = Surveyed`.
- La photo reste exigée pour tout relevé `Surveyed` (`A3`).

**Piste 3 écartée** (un `EtatOccupation` « Inaccessible ») : elle aurait forcé un relevé complet avec photo pour une parcelle non observée, et mélangé l'état du bâti avec l'échec de la visite.

---

# C. Failles opérationnelles

## C1 — Une campagne peut devenir impossible à clôturer

**Gravité** : majeure · **Statut** : Résolue

**Constat.** Un rejet renvoie l'affectation en `ToDo`, et la clôture exige qu'aucune affectation ne soit en `ToDo`. Une parcelle irréductible bloque la campagne indéfiniment.

**Décision (2026-08-09) — piste 1**, cohérente avec la piste 2 de `B4` : **statut `Abandoned` sur l'affectation**, avec motif obligatoire, décidé par le Superviseur (`tasks.assign`).

- `AssignmentStatus` devient `ToDo` / `Done` / `Abandoned`.
- `Abandoned` est **terminal** et ne bloque pas la clôture. La règle devient : plus aucune affectation en `ToDo`, et aucun relevé en `Draft`/`Submitted`.
- L'affectation conserve `AbandonReason`, `AbandonedByUserId` et `AbandonedAtUtc` — une campagne clôturée doit pouvoir expliquer chaque parcelle non traitée.

**Pistes 2 et 3 écartées** : la clôture forcée en masse effacerait la raison de chaque abandon, et le report sur la campagne suivante ferait traîner indéfiniment des parcelles que personne n'a décidé de traiter.

---

## C2 — Pas de réaffectation d'une parcelle à un autre agent

**Gravité** : majeure · **Statut** : Résolue

**Constat.** Rien ne permet de changer `CampaignAssignment.AgentId`. Un agent absent ou désactivé fige ses parcelles, et la FK `RESTRICT` empêche même de supprimer son compte.

**Décision (2026-08-09) — piste 3, les deux mécanismes.**

1. **Réaffectation unitaire** — `PATCH /api/campaign-assignments/{id}/agent`, pour un ajustement ponctuel.
2. **Réaffectation en masse** — transfert de toutes les affectations `ToDo` d'un agent vers un autre, pour un départ ou une absence. C'est le cas d'usage courant.

Les deux réservés au Superviseur (`tasks.assign`). Réaffectation possible uniquement sur des affectations en `ToDo` : une affectation `Done` ou `Abandoned` est terminée, et un relevé en cours appartient à son auteur.

---

## C3 — Aucune notification, tout est en *pull*

**Gravité** : majeure · **Statut** : Partielle

**Constat.** L'agent ignore qu'un relevé lui a été rejeté, le Superviseur ignore qu'il a des soumissions en attente.

**Décision (2026-08-09) — pistes 1 et 2.**

1. **Endpoints « à traiter »** — filtre par statut sur la liste des relevés : `Submitted` pour le Superviseur, ses propres `Rejected` et `Draft` pour l'agent.
2. **Compteurs** exposés sur un endpoint dédié, pour alimenter une pastille d'interface sans rapatrier les listes.

**Piste 3 (push mobile) écartée du périmètre backend immédiat** — à reprendre avec l'application mobile. Conséquence assumée : le délai de réaction dépend de la fréquence à laquelle chacun consulte l'application.

**Implémenté au 2026-08-09 (partiel).** Piste 1 livrée : `GET /api/surveys?status=Submitted` pour le Superviseur, et le même endpoint scopé automatiquement à ses propres relevés pour l'agent (`status=Rejected` notamment). **Piste 2 non livrée** : pas d'endpoint de compteurs dédié. `GET /api/campaigns/{id}/progress` fournit les décomptes, mais par campagne et non par utilisateur — une pastille d'interface devrait aujourd'hui rapatrier les listes.

---

## C4 — Aucun suivi d'avancement

**Gravité** : majeure · **Statut** : Résolue

**Constat.** Aucun endpoint ne donne l'avancement d'une campagne, alors que c'est le premier écran qu'un Superviseur réclamera — et que la décision de clôturer se prend dessus.

**Décision (2026-08-09) — piste 1.** `GET /api/campaigns/{id}/progress` : agrégats par statut d'affectation, par statut de relevé et par agent.

La piste 2 (vue Postgres) n'est pas écartée sur le fond — elle reste l'option d'implémentation si les agrégats s'avèrent coûteux, en cohérence avec la vue déjà envisagée pour la requête « état courant ». C'est un détail de mise en œuvre, pas une décision de conception.

---

## C5 — Le périmètre visé par une campagne n'est pas stocké

**Gravité** : mineure · **Statut** : Dette technique

**Constat.** Les blocs sélectionnés au lancement ne sont qu'un paramètre de la requête de peuplement. Rien n'en garde trace.

**Décision (2026-08-09).** Non traité dans ce lot.

**Conséquence assumée.** On saura quelles adresses ont été affectées, jamais lesquelles auraient dû l'être. Impossible de répondre à « le bloc B12 était-il dans le périmètre, et pourquoi n'a-t-il produit aucune affectation ? ». Cette question se posera d'autant plus que `A1` est en dette : un bloc dont les adresses n'ont pas été saisies produira un peuplement vide, silencieusement, sans qu'on puisse distinguer « bloc non retenu » de « bloc retenu mais sans adresse connue ».

---

# D. Dette de modèle

## D1 — `Street` n'est raccordée à rien

**Gravité** : majeure · **Statut** : Dette technique

**Constat.** `Street` n'a aucune FK vers la hiérarchie, et le libellé d'adresse (`"{Numéro} {Bloc}, {Quartier}, {Ville}"`) ne comporte pas de rue. Aucune `Adresse` ni aucun `Survey` ne référence de rue.

**Décision (2026-08-09).** Non tranché dans ce lot.

**Conséquence assumée.** On continue de maintenir un référentiel de rues complet — CRUD, workflow de suggestion, permissions, tests — qui n'apparaît nulle part dans le produit final. Pour un système dont la finalité est la livraison, c'est un coût de maintenance sans contrepartie tant que la question métier n'est pas tranchée : **une adresse djiboutienne comporte-t-elle un nom de rue, oui ou non ?** Tant qu'elle reste ouverte, ni les agents ni les gestionnaires ne savent quoi faire de ce référentiel.

---

## D2 — Unicités manquantes sur les noms et codes

**Gravité** : mineure · **Statut** : Résolue

**Constat.** Aucune unicité sur `City.Name`, `(CityId, Quartier.Nom)` ni `(QuartierId, Bloc.Code)`. Deux blocs `B12` dans le même quartier rendent ambigu le libellé d'adresse — le produit final du système.

**Décision (2026-08-09) — pistes 1 et 2 cumulées.** Défense en profondeur :

1. **Index uniques en base** — `City.Name`, `(CityId, Nom)` sur `Quartier`, `(QuartierId, Code)` sur `Bloc`. Garantie réelle, y compris contre les écritures concurrentes et les imports directs.
2. **Contrôle applicatif** renvoyant un `409` explicite, comme cela avait été fait pour les arrondissements — sans quoi l'utilisateur reçoit une erreur de base de données brute au lieu d'un message compréhensible.

**Deux points d'attention à l'implémentation :**
- **Vérifier et dédoublonner la base avant de poser les index**, sinon la migration échoue. Le risque est réel : rien n'a empêché les doublons jusqu'ici.
- C'est la **seule décision de cette revue qui modifie des tables existantes**, alors que le lot avait été cadré en ajout pur. La modification se limite à des index — aucune colonne, aucun type touché — ce qui reste compatible avec la contrainte posée. À signaler dans la migration.

---

## D3 — Les permissions `*.delete` n'existent pas en base

**Gravité** : mineure · **Statut** : Dette technique

**Constat.** `DbInitializer.SeedPermissionsAsync` dérive les permissions à insérer des **assignations** aux rôles. Les `*.delete`, réservées à Admin via le bypass et donc assignées à personne, ne sont jamais insérées dans la table `Permissions`.

**Décision (2026-08-09).** Non traité dans ce lot.

**Conséquence assumée.** Aucune aujourd'hui : Admin passe par le bypass, les autres rôles reçoivent bien un `403`. Deviendra visible dès qu'une interface d'administration listera les permissions depuis la base — les suppressions y seront absentes, ce qui donnera l'impression qu'elles n'existent pas. La correction est mécanique (seeder depuis `PermissionNames` plutôt que depuis les assignations) et sans arbitrage métier : à faire dès qu'on retouche `DbInitializer`.

---

---

# E. Adressage — introduction de la `Close` (revue du 2026-08-23)

> Cette section groupe par **sujet** et non par gravité, contrairement à `A`–`D` : les quatre
> entrées découlent du même changement et se lisent ensemble.
> Conception complète : [`docs/plans/adressage.md`](plans/adressage.md).

**Le changement.** Nouveau niveau de hiérarchie —
`City → [Commune] → [Zone] → Quartier → Close → Bloc → Adresse`. Une close regroupe des blocs dans
un quartier. Arbitrages du responsable projet : un bloc appartient à **une seule** close, une close
à **un seul** quartier, la close **entre dans le code d'adresse**, sa géométrie est l'union de ses
blocs calculée à la volée.

**Ce que ça déplace :**

| | Avant | Après |
|---|---|---|
| Code d'adresse | `77-007-7-42` (4 segments) | `77-007-3-7-42` (5 segments) |
| Bloc unique dans | `(QuartierId, Bloc.Number)` | `(CloseId, Bloc.Number)` |
| Maison unique dans | `(BlocId, Numero)` | **`(CloseId, Numero)`** |
| Libellé | `« 42, bloc 2, Quartier 7 Djibouti »` | `« 42, close 2, Quartier 7 Djibouti »` |

Le segment `Bloc.Number` du code **devient redondant** (`ville-quartier-close-numéro` suffirait à
l'unicité). **Il est conservé sciemment** — ne pas « optimiser » le format sans nouvel arbitrage.

---

## E1 — Les composants du code d'adresse sont vides en base

**Gravité** : bloquante · **Statut** : À faire

**Constat.** `AddressCodeGenerator.Generate()` renvoie `null` dès qu'un composant manque. Relevé
le 2026-08-23 :

| Segment | Colonne | Renseigné |
|---|---|---|
| Ville | `City.Code` | **1 / 2** (Djibouti = 77 ; Ali Sabieh `NULL`) |
| Quartier | `Quartier.AreaNumber` | **0 / 6** |
| Bloc | `Bloc.Number` | **0 / 309** |
| Maison | `Adresse.Numero` | 2512 / 2512 ✅ |

→ **0 adresse sur 2512 a un `addressCode`**, et c'est structurellement impossible aujourd'hui :
deux segments sur quatre sont vides partout. Même chose pour le **code postal**, qui a besoin de
`City.Code` + `AreaNumber` — donc aucun code postal calculable non plus.

**Effet de bord déjà visible** : le renommage d'un bloc est refusé tant que `Bloc.Number` est
`NULL` (garde applicative). Avec 0/309, **l'écran de nommage des blocs est verrouillé en prod**.

**À faire.** Renseigner les trois colonnes. Le script `scripts/2026-08-18-registry-prod-donnees.sql`
le prévoit déjà et rappelle pourquoi ce n'est **pas** automatisable : *« le numéro de quartier est
celui du plan d'adressage, pas un rang arbitraire […] Un numéro inventé aujourd'hui devient un code
d'adresse faux et définitif demain. »* Passer par `PATCH /api/quartiers/{id}` et
`PATCH /api/cities/{id}` plutôt que par SQL : l'unicité y est contrôlée et le 409 lisible.
Côté front, l'écran **Codes postaux** couvre déjà ville + quartier ; **il n'existe aucun écran pour
`Bloc.Number`** — 309 valeurs à saisir par API ou SQL.

---

## E2 — Le format du code change, et la fenêtre se referme au premier relevé validé

**Gravité** : bloquante · **Statut** : À faire

**Constat.** `AddressCode` est **figé** en base à la validation `Definitive` d'un relevé
(`ValidateSurveyHandler.FreezeAddressCodeAsync`) et n'est **jamais réécrit** — c'est délibéré :
ses composants sont modifiables, un code recalculé serait un libellé, pas un identifiant.

Passer de 4 à 5 segments après le premier figeage créerait donc **deux générations
d'identifiants incompatibles dans la même table**, sans moyen de rattraper la première.

**Fenêtre actuelle :**

| | |
|---|---|
| Adresses avec un code figé | **0 / 2512** |
| Relevés (`Surveys`) en base | **0** |
| Campagnes | 2 |

**Rien n'est figé nulle part.** Le changement de format coûte donc **zéro aujourd'hui**, et devient
irréversible dès le premier relevé validé en `Definitive`. Même remarque pour la contrainte
`Bloc.Number` qui change de parent : 0/309 renseignés, donc aucun doublon à dédoublonner.

**À faire.** Livrer `E1`, `E3`, `E4` et la renumérotation **avant** d'ouvrir la validation des
relevés. C'est une contrainte de séquencement, pas de charge.

---

## E3 — `(CloseId, Numero)` n'est pas indexable en l'état

**Gravité** : critique · **Statut** : À faire

**Constat.** La maison devient unique **dans sa close**. Or `Adresse` porte `BlocId`, pas
`CloseId`, et **un index unique PostgreSQL ne traverse pas une jointure** : on ne peut pas indexer
`(Bloc.CloseId, Adresse.Numero)` depuis `Adresses`.

**Pourquoi ça compte.** Sans garantie en base, deux écritures concurrentes ou un import SQL direct
peuvent créer deux « maison 42 » dans la même close. Le libellé devient alors ambigu — et comme
`addressCode` est `null` partout (`E1`), **le libellé est la seule chose que l'utilisateur voit**.

L'ampleur est réelle, pas théorique : **2512 adresses pour 39 numéros distincts**, le numéro `1`
apparaissant **308 fois** (une par bloc). Toute close de 2 blocs ou plus est concernée.

| Piste | Ce que ça donne | Coût |
|---|---|---|
| **Dénormaliser `Adresse.CloseId`** | index unique natif, garantie réelle | à maintenir si un bloc change de close |
| Trigger / contrainte d'exclusion | pas de colonne en trop | logique cachée en base |
| Contrôle applicatif seul | rien à migrer | **aucune garantie** concurrentielle |

**Recommandation : la dénormalisation**, avec contrôle applicatif par-dessus pour un 409 lisible —
exactement la défense en profondeur déjà retenue en `D2`. C'est aussi le pattern du projet : la vue
`adresses_tiles` aplatit déjà `cityId/communeId/zoneId/quartierId/blocId`.

---

## E4 — `Bloc.QuartierId` → `Bloc.CloseId` casse les consommateurs

**Gravité** : majeure · **Statut** : À faire

**Constat.** Le quartier d'un bloc devient joignable *via* sa close. Tout ce qui lit
`Bloc.QuartierId` directement casse :

- `AdresseQueries.Rows` — le join `Bloc → Quartier` passe par `Close` ;
- `FreezeAddressCodeAsync` — même join, plus le nouveau segment `Close.Number` ;
- `GET /api/blocs?quartierId=` — le filtre traverse maintenant une table de plus ;
- la vue **`blocs_tiles`**, qui expose `QuartierId` en colonne directe (consommée par les tuiles
  Martin et par le filtrage carte du front) ;
- `AddressCodeGenerator.Generate()` — un paramètre de plus ; conserver le retour `null` si un
  composant manque.

**Ordre de migration — il y a une dépendance circulaire.** On ne peut pas renuméroter avant de
savoir quelle close contient quels blocs :

1. créer les closes, y rattacher les **309 blocs** (`Bloc.CloseId` nullable en base, obligatoire à
   la saisie — même schéma transitoire que `AreaNumber` et `Bloc.Number`) ;
2. renuméroter les **2512 adresses**, unicité par close — **automatique côté backend**, séquentiel
   par close, l'ajustement manuel restant possible via `PATCH /api/adresses/{id}` ;
3. renseigner les composants de `E1` ;
4. **seulement ensuite**, ouvrir la validation des relevés (`E2`).

**Reste à livrer** : entité `Close` + table, index unique `(QuartierId, Number)`, et
`/api/closes` (CRUD + affectation des blocs). Le front a déjà l'écran, en mock, prêt à basculer.

---
# Synthèse de la dette technique

## Ouverte et assumée (revue 2026-08-09)

| ID | Ce qu'on perd | Quand ça deviendra bloquant |
|---|---|---|
| **A1** | *(requalifiée)* La traçabilité parcelle → adresse : impossible de dire si une parcelle du cadastre est déjà promue autrement qu'en comparant les géométries. Et une construction hors cadastre reste non signalable (`AdresseSuggestion` absente). | Dès la reprise d'un 2ᵉ quartier — sans traçabilité, on ne saura pas quoi promouvoir. |
| **C5** | La traçabilité de l'intention : on ne distinguera pas « bloc non retenu » de « bloc sans adresse connue ». | Dès qu'un peuplement partiel devra être expliqué. |
| **D1** | La justification d'un module entier — le référentiel de rues n'a aucun usage produit. | À l'arbitrage métier sur la composition d'une adresse. |
| **D3** | La cohérence du catalogue de permissions vis-à-vis de la base. | À la première UI d'administration des rôles. |

## À livrer (revue 2026-08-23) — séquencement contraint

`E4` → `E3` → `E1` → puis seulement ouvrir la validation des relevés (`E2`).

**Le point à retenir : la fenêtre est ouverte mais elle se referme toute seule.** Il y a
aujourd'hui **0 code d'adresse figé** et **0 relevé** en base. Changer le format du code, déplacer
les contraintes d'unicité et renuméroter ne coûtent donc **rien**. Au premier relevé validé en
`Definitive`, chaque code posé l'est pour toujours et le coût devient une reprise de données
impossible à faire proprement.

Les deux `Partielle` restantes ne sont pas dans ce séquencement : `A3` attend une politique de
rétention des photos, `C3` un endpoint de compteurs par utilisateur.
