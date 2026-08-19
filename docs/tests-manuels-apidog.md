# Tests manuels avec Apidog — module Recensement

## 1. Importer l'API

L'API doit tourner : `dotnet run --project src/DASApi.WebApi --launch-profile http` (port **5026**).

Dans Apidog Desktop, **New Project → Import Data → OpenAPI/Swagger**, puis au choix :

- **par URL** : `http://localhost:5026/openapi/v1.json` — à réimporter après chaque changement d'endpoint ;
- **par fichier** : `docs/openapi-v1.json` (export figé, régénérable avec `curl -s http://localhost:5026/openapi/v1.json -o docs/openapi-v1.json`).

La spec déclare le schéma **Bearer** : Apidog affiche un champ « Token » au niveau du projet
(*Settings → Auth*), il suffit d'y coller le `token` renvoyé par le login. Inutile de saisir
`Bearer ` devant, le préfixe est ajouté par Apidog.

## 2. Environnement

Créer un environnement avec ces variables — les valeurs sont produites par le script de seed
et changent à chaque base recréée :

| Variable | Rôle |
|---|---|
| `baseUrl` | `http://localhost:5026` |
| `token` | rempli après le login |
| `blocId`, `adresseId` | socle géographique de test |
| `campaignId`, `assignmentId` | campagne ouverte, affectation prête |
| `agent1Id`, `agent2Id` | pour tester la réaffectation |
| `typeOccupationId`, `etatOccupationId` | catalogues, obligatoires pour un relevé `Surveyed` |

## 3. Comptes

| Compte | Mot de passe | Rôle |
|---|---|---|
| `admin` | `ChangeMe123!` | Admin (bypass total) |
| `agent1`, `agent2` | `Test1234!` | AgentTerrain |
| `superviseur1` | `Test1234!` | Superviseur |
| `gestionnaire1` | `Test1234!` | Gestionnaire |

**Changer de compte change ce que l'API autorise** : c'est le principal intérêt des tests manuels
ici. Refaire un `POST /api/auth/login` et remplacer `token` à chaque bascule.

## 4. Parcours nominal

Dans l'ordre, en changeant de compte aux étapes indiquées :

| # | Compte | Requête | Attendu |
|---|---|---|---|
| 1 | — | `POST /api/auth/login` | `200` + `token` |
| 2 | superviseur1 | `POST /api/campaigns` | `201`, statut `Planned` |
| 3 | superviseur1 | `POST /api/campaigns/{id}/assignments` | `200`, `createdAssignments` > 0, campagne passée `InProgress` |
| 4 | agent1 | `GET /api/campaign-assignments` | ses affectations uniquement |
| 5 | agent1 | `POST /api/surveys` | `201`, statut `Draft` |
| 6 | agent1 | `POST /api/surveys/{id}/photos` | `200` (voir §6) |
| 7 | agent1 | `POST /api/surveys/{id}/submit` | `200`, statut `Submitted` |
| 8 | superviseur1 | `GET /api/surveys?status=Submitted` | sa file de travail |
| 9 | superviseur1 | `POST /api/surveys/{id}/validate` | `200`, affectation passée `Done` |
| 10 | superviseur1 | `GET /api/campaigns/{id}/progress` | `canBeClosed: true` |
| 11 | superviseur1 | `POST /api/campaigns/{id}/close` | `200`, statut `Closed` |

### Corps de `POST /api/surveys`

Deux pièges : **l'`id` est fourni par le client** (générer un GUID, Apidog le fait avec
`{{$string.uuid}}`), et `capturedAtUtc` doit être une date ISO 8601.

```json
{
  "id": "{{$string.uuid}}",
  "campaignAssignmentId": "{{assignmentId}}",
  "outcome": "Surveyed",
  "typeOccupationId": "{{typeOccupationId}}",
  "etatOccupationId": "{{etatOccupationId}}",
  "name": "Immeuble Al Amine",
  "floorCount": 3,
  "apartmentCount": 6,
  "shopCount": 1,
  "wheelchairAccessible": true,
  "entryPointWkt": "POINT(43.14 11.58)",
  "gpsCaptureWkt": "POINT(43.1401 11.5801)",
  "gpsAccuracyM": 8,
  "isMockLocation": false,
  "capturedAtUtc": "2026-08-09T10:30:00Z"
}
```

Renvoyer **exactement la même requête** doit répondre `200` (et non `201`) avec le même relevé :
c'est l'idempotence prévue pour le rejeu hors réseau.

Pour une parcelle non relevable, remplacer les champs de constat par :

```json
{ "outcome": "NotSurveyable", "notSurveyableReason": "Demolished" }
```

(`Demolished` / `Inaccessible` / `Refused` / `NotFound`) — ni photo ni type d'occupation exigés.

## 5. Cas d'erreur à vérifier

Ce sont eux qui valident les règles, pas le parcours nominal :

| Requête | Compte | Attendu |
|---|---|---|
| `POST /api/campaigns` | agent1 | `403` — l'agent ne pilote pas |
| `POST /api/surveys` sur l'affectation d'agent1 | agent2 | `403 Assignments.NotOwner` |
| `POST /api/surveys/{id}/submit` sans photo | agent1 | `400 Surveys.PhotoRequired` |
| 2ᵉ relevé actif sur la même affectation | agent1 | `409 Surveys.AlreadyExists` |
| `POST /api/surveys/{id}/validate` sur son propre relevé | compte cumulant Agent+Superviseur | `403 Surveys.SelfReview` |
| `POST /api/campaigns/{id}/close` avec du travail en cours | superviseur1 | `409 Campaigns.HasPendingWork` |
| `POST /api/cities` avec un nom existant | admin | `409 Cities.AlreadyExists` |
| `POST /api/units` sur une adresse non affectée | agent1 | `403 Units.NotAssigned` |
| `DELETE /api/units/{id}` | gestionnaire1 | `403` — suppression réservée à Admin |

## 6. Photos

Le backend **ne reçoit jamais le fichier** : le mobile le dépose dans MinIO puis transmet l'URL.
Pour simuler à la main, déposer d'abord un fichier via la console MinIO
(<http://localhost:9001>, `dasapi` / `dasapi-dev-secret`) dans le bucket `das-survey-photos`,
dossier `surveys/{surveyId}/`, puis :

```json
POST /api/surveys/{id}/photos
{ "photoUrl": "http://localhost:9000/das-survey-photos/surveys/{surveyId}/photo.jpg" }
```

Toute URL pointant ailleurs — autre bucket, dossier d'un autre relevé — doit être refusée en `400`.

`GET /api/surveys/{id}/photos` renvoie des URLs de lecture **signées et expirantes** (15 min) :
elles s'ouvrent dans le navigateur, la même URL privée de sa signature doit être refusée par MinIO.

## 7. Régénérer le jeu de données

Le script de seed est rejouable sans créer de doublon. Si la base est recréée, relancer l'API puis
le script pour obtenir de nouveaux identifiants à reporter dans l'environnement Apidog.
