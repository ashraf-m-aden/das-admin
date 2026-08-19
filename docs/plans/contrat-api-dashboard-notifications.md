# Contrat API Dashboard & Notifications — proposition front

> Adressé par l'équipe front (`das-admin`) à l'équipe back (`dasApi`).
> Fait suite au recoupement de [`contrat-api-frontend.md`](contrat-api-frontend.md) (M2 —
> Notifications) et du guide [`guide-integration-frontend.md`](../guide-integration-frontend.md)
> §6, qui classent tous deux `dashboard-api` et `notifications-api` comme non implémentés côté
> back — le premier n'étant même pas un chantier identifié, le second listé « TODO, non conçu ».
>
> **Méthode** : comme pour le contrat Registry, on distingue ce qui est composable *dès
> aujourd'hui* à partir de routes déjà livrées, ce qui demande un ajout mineur (un agrégat de
> plus sur une route existante), et ce qui suppose une décision métier avant d'écrire une seule
> ligne de code. On ne redemande pas ce que le contrat Registry a déjà obtenu ou explicitement
> refusé (`history`, `duplicatesFlagged`, etc.) — on s'appuie dessus.

---

## Résumé exécutif

**Dashboard.** `GET /dashboard/summary` tel qu'imaginé côté front (7 blocs : KPIs, répartition
par étape, répartition par niveau hiérarchique, tendance d'enregistrement, activité récente,
points carte) ne peut pas être livré d'un bloc — 4 de ses 7 blocs supposent des données qui
n'existent nulle part dans le domaine (journal d'audit, module qualité, série temporelle,
agrégat par niveau hiérarchique). **On retire notre demande sur ces 4 blocs pour cette
itération** et on propose un **dashboard v1** composé uniquement de routes déjà livrées plus
**un seul ajout mineur** (répartition par étape sur `/api/adresses/summary`).

**Notifications.** Rien n'existe : pas d'entité, pas de Hub SignalR, et notre propre modèle
(`task_completed`, `block_submitted`…) a été conçu avant de connaître le domaine réel — il ne
correspond à aucun événement que `dasApi` peut effectivement émettre. **On propose un
remappage complet des événements déclencheurs** sur le vocabulaire réel du module Recensement
(`Survey`, `Campaign`, suggestions), à valider avant tout développement — c'est le blocage
principal, pas la mécanique CRUD/SignalR.

---

## 1. Dashboard

### 1.1 Ce que le front demandait initialement (`core/dashboard/models/dashboard.models.ts`)

```ts
interface DashboardSummary {
  kpis: DashboardKpis;              // 6 indicateurs, 2 avec delta vs période précédente
  workflow: WorkflowStageCount[];   // répartition par étape (registered..published)
  hierarchy: HierarchyLevelCount[]; // répartition par niveau (région/ville/commune/quartier/bloc/rue/parcelle)
  registrationsTrend: TrendPoint[]; // série temporelle
  verification: VerificationBreakdown; // verified/pending/unverified (donut)
  recentActivity: ActivityItem[];   // flux d'événements (6 natures)
  mapPoints: MapAddressPoint[];     // points géographiques individuels en JSON
}
```

### 1.2 Crosscheck champ par champ

| Bloc / champ | Source envisageable aujourd'hui | Statut |
|---|---|---|
| `kpis.totalProperties` | `GET /api/adresses/summary.totalRecords` | ✅ disponible tel quel |
| `kpis.verifiedAddresses` / `pendingVerification` (+ `%`) | dérivable de `workflowStage`, mais aucun agrégat exposé — `POST /search` est plafonné à 200/page, inutilisable pour un total | ⚠️ ajout mineur demandé (§1.4) |
| `kpis.activeFieldTeams` / `teamsInField` | `GET /api/campaigns/{id}/progress`, via `GET /api/campaigns?status=InProgress` | ⚠️ composable, scopé à **une** campagne (il n'y en a qu'une `InProgress` à la fois — ça tombe bien) |
| `kpis.newPostcodes` (+ delta) | `postcode` est **dérivé**, jamais stocké ni horodaté (contrat Registry §3.1) — aucune notion de « nouveau » | ❌ retiré de la demande |
| `kpis.dataQualityAlerts` | aucun module Qualité des données côté back (0 fichier `.cs` correspondant) | ❌ retiré de la demande |
| `workflow[]` (répartition par étape) | même agrégat que `verifiedAddresses`/`pendingVerification` | ⚠️ ajout mineur demandé (§1.4) |
| `hierarchy[]` (répartition par niveau admin) | aucun agrégat de comptage par ville/commune/zone/quartier | ❌ retiré de la demande |
| `registrationsTrend[]` | suppose un historique temporel sur `Adresse` — **`CreatedAtUtc` n'existe pas encore** (déjà demandé au contrat Registry §2, non lié au dashboard) | ❌ retiré de la demande, redevient pertinent si/quand `CreatedAtUtc` est livré |
| `verification` (donut verified/pending/unverified) | sous-ensemble direct de `workflow[]` | ⚠️ dérivable côté front une fois `workflow[]` disponible, aucun endpoint dédié nécessaire |
| `recentActivity[]` | aucun journal d'audit — déjà listé « identifié, non planifié » côté back (`contrat-api-registry.md` §3.4, §8) | ❌ retiré de la demande |
| `mapPoints[]` | supposait une géométrie individuelle en JSON — **incohérent avec notre propre architecture** : `geom` est toujours `null` sur l'API JSON, la carte vient des tuiles Martin (`adresses_tiles`), comme `registry-list`/`blocks-map` le font déjà | 🗑️ **retiré définitivement** — ce n'est plus une demande, c'est une erreur de conception initiale de notre côté, corrigée en interne (le dashboard réutilisera la couche tuile existante, aucune route à ajouter) |

### 1.3 Ce qui reste, et sous quelle forme

Sur 7 blocs demandés initialement, **3 survivent en v1** : KPIs partiels (2 sur 6 sans ajout,
2 de plus avec l'ajout §1.4), avancement des équipes terrain (composé, aucune route neuve), et
le donut de vérification (dérivé de `workflow[]`, aucune route neuve). `newPostcodes`,
`dataQualityAlerts`, `hierarchy[]`, `registrationsTrend[]`, `recentActivity[]` et `mapPoints[]`
sortent du périmètre v1 — ils ne reviendront que si/quand les modules dont ils dépendent
(audit, qualité, historique de création) existent, et ce n'est **pas ce document** qui les
demande.

### 1.4 Le seul ajout back demandé : répartition par étape sur `/api/adresses/summary`

Étendre la réponse existante d'un tableau, sans casser les 4 champs déjà livrés :

```json
{
  "totalRecords": 165, "pendingReview": 8, "duplicatesFlagged": 3, "publishedToday": 2,
  "workflowBreakdown": [
    { "stage": "registered", "count": 40 },
    { "stage": "surveyed",   "count": 30 },
    { "stage": "verified",   "count": 25 },
    { "stage": "approved",   "count": 50 },
    { "stage": "published",  "count": 20 }
  ]
}
```

C'est le **même agrégat** que celui qui produit déjà `totalRecords`/`pendingReview` — un
`GROUP BY workflowStage` de plus sur une requête qui existe, pas une nouvelle route ni un
nouveau module. `verified`/`pending`/`unverified` (le donut) et `verifiedPct`/`pendingPct` se
calculent côté front à partir de ce tableau, sans rien demander de plus.

### 1.5 DTO front v1 (remplace `DashboardSummary`)

```ts
interface DashboardSummaryV1 {
  totalRecords: number;
  workflowBreakdown: { stage: AddressWorkflowStage; count: number }[];
  activeCampaign: { code: string; name: string; deadline: string;
                     charge: { total: number; done: number };
                     production: { total: number; byStatus: Record<string, number> } } | null;
}
```

`activeCampaign` vient de `GET /api/campaigns?status=InProgress` (0 ou 1 résultat) puis
`GET /api/campaigns/{id}/progress` — deux appels déjà livrés, `null` si aucune campagne en
cours (état normal entre deux campagnes, pas une erreur).

### 1.6 Question pour le back

Le `GROUP BY workflowStage` de §1.4 peut-il être ajouté à la requête existante de
`GET /api/adresses/summary` sans regression sur les 4 champs actuels, et sous quel délai ?
C'est la seule chose qui bloque le dashboard v1.

---

## 2. Notifications

### 2.1 Ce que le front avait construit à l'aveugle (`core/notifications/models/notifications.models.ts`)

```ts
type NotificationType = 'task_completed' | 'block_submitted' | 'property_approved'
                       | 'property_needs_redo' | 'redo_resolved';
```

Conçu avant le recoupement avec le domaine réel — **aucune de ces 5 valeurs ne correspond à un
événement que `dasApi` peut émettre aujourd'hui** : il n'y a pas de `Task` générique, `Bloc` ne
se « soumet » pas (c'est le `Survey` qui suit un cycle), et `property_*` suppose un vocabulaire
Registry alors que la donnée vit sur `Survey`. On jette ce modèle et on repart du domaine.

### 2.2 Proposition de remappage sur les événements réels

D'après le guide (§6, entrée `notifications-api`), le back avait déjà identifié des candidats :
suggestion à examiner, relevé soumis, campagne clôturée, relevé en souffrance
(signal déjà disponible via `GET /api/surveys/stalled`). On les reprend et on les complète avec
le cycle de validation à trois issues (§4.4 du guide) :

| Type proposé | Émis quand | Destinataire |
|---|---|---|
| `survey_submitted` | `POST /api/surveys/{id}/submit` | Superviseur(s) — file de validation |
| `survey_validated` | `POST /api/surveys/{id}/validate` | `Survey.AgentId` |
| `survey_rejected` | `POST /api/surveys/{id}/reject` | `Survey.AgentId` |
| `survey_correction_requested` | `POST /api/surveys/{id}/request-correction` | `Survey.AgentId` |
| `survey_stalled` | signal déjà calculé par `GET /api/surveys/stalled` — à transformer en événement poussé plutôt que laissé en lecture seule | Superviseur(s) |
| `bloc_suggestion_submitted` | soumission d'une suggestion de nom de bloc | Gestionnaire |
| `street_suggestion_submitted` | soumission d'une suggestion de nom de rue | Gestionnaire |
| `campaign_closed` | bascule automatique `InProgress → Closed` (`CampaignAutoCloser`) | Superviseur(s) + Gestionnaire |

**Ce tableau est une proposition, pas une demande figée** — c'est exactement le point que le
guide demandait de trancher avant tout code (« il faut d'abord définir ce qui déclenche une
notification »). Si le back a une autre lecture du besoin métier, c'est ce tableau qu'il faut
corriger, pas les routes du §2.4.

### 2.3 DTO `Notification` proposé

```json
{
  "id": "uuid",
  "type": "survey_submitted | survey_validated | survey_rejected | survey_correction_requested | survey_stalled | bloc_suggestion_submitted | street_suggestion_submitted | campaign_closed",
  "recipientUserId": "uuid",
  "relatedEntityType": "survey | campaign | bloc_suggestion | street_suggestion",
  "relatedEntityId": "uuid",
  "messageParams": { "agentFullName": "Ali Hassan", "campaignCode": "C2026-1" },
  "readAt": "2026-08-19T10:00:00Z | null",
  "createdAtUtc": "2026-08-19T09:58:00Z"
}
```

Le front compose le libellé final à partir d'une clé i18n dérivée de `type` + `messageParams`
(déjà le pattern retenu pour `ActivityItem`/`titleKey`) — **pas de texte figé côté back**, pour
rester traduisible fr/en sans redéploiement des deux côtés à chaque changement de formulation.

### 2.4 Routes proposées

| Verbe | Route | Effet |
|---|---|---|
| GET | `/api/notifications` `?unreadOnly=` | Notifications du user authentifié, plus récentes d'abord |
| PATCH | `/api/notifications/{id}/read` | Marque une notification lue → `204` |
| PATCH | `/api/notifications/read-all` | Marque tout lu → `204` |

Aligné sur la convention `204` déjà actée pour les actions de masse (contrat Registry §4.4).
Si le volume par utilisateur dépasse quelques dizaines, `GET /api/notifications` devra suivre
la même enveloppe de pagination que `/api/adresses/search` (§1 du contrat Registry) — à
trancher selon le volume réel une fois `survey_submitted`/`survey_stalled` en production (un
superviseur peut recevoir des dizaines de `survey_submitted` par jour, cf. §2.6).

### 2.5 Push temps réel — Hub SignalR proposé

```
/notificationsHub   (authentifié JWT, un groupe SignalR par userId)
  → méthode client : ReceiveNotification(notification: Notification)
```

Le front s'y connecte après login/restauration de session et se déconnecte au logout (déjà
câblé côté front, `notifications-hub.service.ts` — il ne manque que le Hub côté back). Le
groupe par `userId` (pas de broadcast global) garantit qu'un `AgentTerrain` ne reçoit jamais
les notifications d'un autre agent.

### 2.6 Questions ouvertes pour le back

1. **Le remappage §2.2 correspond-il au besoin métier réel**, ou le back a-t-il une autre
   priorité (ex. `survey_stalled` avant `survey_submitted`) ?
2. **Persistance obligatoire, ou push volatile acceptable en v1 ?** Si la table `Notification`
   est un chantier trop lourd pour une première itération, un Hub SignalR sans historique
   (pas de `GET /api/notifications`, pas de `readAt`) couvrirait déjà le cas d'usage principal
   (alerte en direct) — à confirmer si c'est un compromis acceptable pour aller plus vite.
3. **Volume attendu de `survey_submitted`** : un superviseur qui supervise plusieurs blocs actifs
   peut recevoir une notification par relevé soumis, potentiellement des dizaines par jour.
   Notification unitaire ou digest périodique ? Conditionne la réponse à la question de
   pagination du §2.4.
4. **`survey_stalled`** est aujourd'hui un signal **lu à la demande** (`GET /api/surveys/stalled`,
   pas un événement). Le transformer en notification poussée suppose une tâche de fond
   (détection périodique), alors que le reste du catalogue (§2.2) se déclenche naturellement au
   fil des appels existants (`submit`/`validate`/`reject`/`request-correction`). À confirmer si
   c'est dans le périmètre v1 ou reporté.

---

## 3. Conventions à respecter (rappel, déjà actées côté Registry)

- Enums en chaînes, jamais en nombres (`"type": "survey_submitted"`).
- `id` en UUID, dates en ISO 8601 UTC (suffixe `Z`).
- Permissions explicites par route (`.RequirePermission`) plutôt qu'un simple JWT — proposition :
  `notifications.view` pour `GET`, aucune permission dédiée pour `PATCH .../read*` (un user ne
  modifie que les siennes, scope = soi-même, pas un rôle).
- Si liste paginée : l'enveloppe `{ items, total, page, pageSize }` déjà adoptée comme
  convention transverse (contrat Registry §2), pas un format ad hoc pour cette route.

---

## 4. Ordre de priorité proposé

1. **Dashboard v1** — aucune nouvelle entité, un seul `GROUP BY` de plus sur une requête
   existante (§1.4) + composition de deux routes déjà livrées (§1.5). Le plus rapide à livrer.
2. **Notifications** — bloqué tant que §2.2 et les questions du §2.6 ne sont pas tranchées côté
   métier. La mécanique (routes REST + Hub SignalR) est standard une fois le catalogue
   d'événements figé ; ce n'est pas là que se trouve la difficulté.

**Hors périmètre de ce document, à ne pas redemander séparément** : `newPostcodes`,
`dataQualityAlerts`, `hierarchy[]`, `registrationsTrend[]`, `recentActivity[]` — chacun dépend
d'un module qui n'existe pas encore côté back (qualité de données, journal d'audit, historique
de création sur `Adresse`) et sort du cadre « dashboard » pour devenir un chantier à part
entière le jour où ce module sera priorisé.
