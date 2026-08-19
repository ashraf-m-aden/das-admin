# Failles du module Recensement — revue du 2026-08-09

Revue critique du processus de recensement tel que défini par [`docs/plans/schema-recensement.md`](plans/schema-recensement.md) et le RBAC existant ([`docs/plans/auth.md`](plans/auth.md), [`docs/plans/recensement-geographie.md`](plans/recensement-geographie.md)).

**Usage** : document de travail, à reprendre faille par faille. Chaque entrée porte un identifiant stable (`A1`, `B3`…) pour être citée en discussion, en commit ou en issue. Les décisions prises ici sont répercutées dans la spec — ce fichier n'est pas la source de vérité de la conception, il en est la liste de contrôle.

**Statuts** :
- `Retenue` — piste choisie le 2026-08-09, à implémenter. Reportée dans la spec.
- `Dette technique` — faille reconnue, correction non planifiée dans ce lot. Reste ouverte, assumée en connaissance de cause.
- `Résolue` — implémentée et vérifiée.

## Récapitulatif

| ID | Faille | Gravité | Statut | Décision |
|---|---|---|---|---|
| **A1** | Les adresses doivent exister avant le terrain — processus circulaire | Bloquante | **Dette technique** | Socle alimenté à la main par le Gestionnaire |
| **A2** | La deuxième campagne sera vide | Bloquante | **Résolue** | Paramètre `includeAlreadySurveyed` au peuplement |
| **A3** | Photo obligatoire sans chaîne de téléversement | Bloquante | **Résolue** | MinIO + dépôt direct par le mobile, URLs de lecture signées par l'API |
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

**État au 2026-08-09 après implémentation : 11 résolues, 1 partielle, 4 en dette technique.**

Les statuts `Résolue` sont vérifiés par les tests de bout en bout (73 assertions HTTP, toutes vertes) décrits dans [`docs/plans/schema-recensement.md`](plans/schema-recensement.md). La `Partielle` restante est `C3`, qui attend un endpoint de compteurs.

---

# A. Bloquantes

## A1 — Les adresses doivent exister avant le terrain

**Gravité** : bloquante · **Statut** : Dette technique

**Constat.** Une `Adresse` doit exister en base **avant** qu'un agent puisse y être affecté : `CampaignAssignment.AdresseId` est une FK vers une ligne existante, et le peuplement sélectionne des adresses déjà enregistrées. Or c'est le terrain qui découvre les parcelles. Le seul moyen actuel de créer une adresse est la saisie manuelle par le Gestionnaire (`POST /api/adresses`).

**Aggravant.** Un agent qui trouve une construction non répertoriée **n'a aucun moyen de la signaler** — il n'existe pas d'`AdresseSuggestion`, alors que le pattern est déjà en place deux fois dans le repo (`BlocSuggestion`, `StreetSuggestion`).

**Décision (2026-08-09).** Aucune des trois pistes n'est retenue pour ce lot. Le socle reste **alimenté à la main par le Gestionnaire**, comme aujourd'hui.

**Conséquences assumées** — à garder en tête, ce sont les plus lourdes de tout ce document :
- Le volume de saisie manuelle conditionne le démarrage. Aucune campagne ne peut couvrir plus de parcelles que le Gestionnaire n'en a créées une par une.
- Une construction découverte sur le terrain et absente du socle est **définitivement perdue** pour la campagne en cours : l'agent la voit, ne peut ni la relever ni la signaler, et rien ne garde trace du manque.
- Le recensement mesure donc la complétude du socle, pas celle du terrain. Tant que `A1` est en dette, aucun chiffre issu du système ne peut être présenté comme un décompte exhaustif des adresses de la ville.

**À rouvrir en priorité** dès que l'import GIS revient au programme, ou dès la première campagne réelle si le volume de saisie se révèle intenable. La piste `AdresseSuggestion` reste la moins coûteuse (1 entité + 1 table + 4 slices, sur un pattern éprouvé).

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

# Synthèse de la dette technique

Quatre failles restent ouvertes et assumées. Leur point commun : aucune n'empêche le code de fonctionner, toutes dégradent ce que le système peut **prouver** ou **maintenir**.

| ID | Ce qu'on perd | Quand ça deviendra bloquant |
|---|---|---|
| **A1** | L'exhaustivité. Le système mesure la complétude du socle, pas celle du terrain — et une adresse découverte sur place est perdue. | Dès la première campagne réelle, si le volume de saisie manuelle est intenable. |
| **C5** | La traçabilité de l'intention : on ne saura pas distinguer « bloc non retenu » de « bloc sans adresse connue ». | Dès qu'un peuplement partiel devra être expliqué. |
| **D1** | La justification d'un module entier — le référentiel de rues n'a aucun usage produit. | À l'arbitrage métier sur la composition d'une adresse. |
| **D3** | La cohérence du catalogue de permissions vis-à-vis de la base. | À la première UI d'administration des rôles. |

`A1` est la seule des quatre classée **bloquante** : elle est en dette parce qu'un contournement manuel existe, pas parce que son impact serait faible.
