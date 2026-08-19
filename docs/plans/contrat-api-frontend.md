# Contrat d'API avec le front — écarts relevés et arbitrages

> Document interne. La version destinée à l'équipe front est
> [`docs/guide-integration-frontend.md`](../guide-integration-frontend.md) — elle décrit
> nos conventions et l'inventaire des routes, sans les arbitrages ni la dette listés ici.
> Les deux fichiers doivent être mis à jour ensemble.

---

## Contexte

Le 2026-08-12, le développeur front a fourni la liste des appels HTTP de ses services
Angular (`*-api.service.ts`). Cette liste est ce que le back-office **attend** de nous,
pas ce que nous exposons. Elle a été confrontée route par route à l'inventaire réel
(`src/DASApi.WebApi/Features/**/*Endpoints.cs`).

Le résultat n'est pas un simple décalage de nommage : trois modules entiers réclamés
n'existent nulle part dans le domaine, et deux écarts touchent le modèle métier
lui-même. D'où ce document — un désalignement de cette taille ne se règle pas en
renommant des routes.

---

## Résultat du recoupement

**7 routes alignées telles quelles.** `staff-api` (4) et `auth-api` (3). Sur `staff-api`,
même les payloads correspondent au caractère près (`fullName`/`username`/`password`/
`roleNames`, `roleNames`, `isActive`) — c'est la partie du front qui a été écrite contre
l'API réelle.

**8 routes existantes mais mal adressées.** Écart de verbe, de chemin ou de nom de champ,
sans enjeu de conception :

| Attendu par le front | Exposé par nous |
|---|---|
| `PATCH /blocs/{id}/suggestions/{sid}/approve` | `POST /api/blocs/suggestions/{sid}/approve` |
| `PATCH /blocs/{id}/suggestions/{sid}/reject {reason}` | `POST /api/blocs/suggestions/{sid}/reject {rejectionReason}` |
| `PATCH /streets/{id}/suggestions/{sid}/approve` | `POST /api/streets/suggestions/{sid}/approve` |
| `PATCH /streets/{id}/suggestions/{sid}/reject {reason}` | `POST /api/streets/suggestions/{sid}/reject {rejectionReason}` |

Le front fait porter le `blocId`/`streetId` par l'URL de la suggestion ; chez nous une
suggestion est identifiée seule, son bloc est dans sa charge utile. Notre forme est la
bonne (le `sid` est déjà unique, le `blocId` dans l'URL est redondant et ouvre la porte à
une incohérence entre les deux segments). Le verbe `POST` est également volontaire :
approuver n'est pas une modification partielle de la suggestion, c'est une transition
d'état qui écrit *aussi* sur le bloc. **Décision : on ne change rien côté back, le front
s'aligne.**

**~30 routes sans contrepartie**, dont trois modules complets — détaillés ci-dessous.

---

## Les deux écarts qui touchent le modèle

### E1 — Une parcelle sans numéro n'est pas représentable

Le front attend `GET /addressing/properties-to-number` et
`PATCH /addressing/properties/{id}/house-number`, donc un état « parcelle digitalisée mais
pas encore numérotée ».

Or `Adresse.Numero` est un `int` non nullable et `Adresse.Create(blocId, numero, boundary)`
l'exige à la construction (`src/DASApi.Domain/Geographie/Adresse.cs`). Il n'existe aucun
moyen d'enregistrer une parcelle en attente de numéro.

C'est cohérent avec la décision du 2026-08-08 (une adresse = numéro + bloc + quartier +
ville) : le numéro *est* constitutif de l'adresse. Mais si la numérotation est un acte de
back-office postérieur à la digitalisation — ce que le front suppose —, alors
`Adresse` mélange deux choses : la **parcelle** (géométrie, stable, existe dès la
digitalisation) et l'**adresse** (le numéro attribué). Deux options :

- **(a)** Rendre `Numero` nullable, `Adresse` devient « parcelle éventuellement adressée ».
  Impact : toutes les projections (`AdresseResponse.Libelle` calcule déjà un libellé
  composé), la contrainte d'unicité `(BlocId, Numero)`, et la génération de feuille de
  route qui suppose des adresses complètes.
- **(b)** Refuser : la numérotation reste faite à la création, le front n'a pas d'écran
  « à numéroter ».

**Non tranché — arbitrage responsable projet.** Voir la question Q2 au front.

### E2 — L'affectation d'un bloc est scopée campagne, pas absolue

Le front attend `PATCH /blocks/{id}/assign {userId}` : un bloc a un titulaire, point.

Chez nous le titulaire n'existe **que** dans une campagne (`CampaignBloc`), et c'est un
pilier du modèle — voir [`module-recensement.md`](module-recensement.md) : le responsable
d'une parcelle se déduit par `Adresse → Bloc → CampaignBloc`, et la production d'un agent
(`Survey.AgentId`) ne suit jamais une réaffectation. Un « titulaire du bloc » hors
campagne casserait cette séparation charge/production.

**Décision : on ne dénature pas le modèle.** La route reste
`PATCH /api/campaigns/{campaignId}/blocs/{blocId}/agent {agentId}`. Le front doit résoudre
la campagne courante avant d'affecter.

Réserve à surveiller : si le back-office fait systématiquement « affecter dans la campagne
active », le coût est un `GET /api/campaigns?status=InProgress` avant chaque affectation.
Un raccourci `/api/campaigns/current` serait alors justifié — **TODO** si le besoin se
confirme, pas avant.

---

## Les trois modules absents

Aucune entité de domaine, aucune table, aucune trace dans les plans existants.

### M1 — Clients / abonnements / jetons d'API (11 routes)

`clients`, `subscription-plans`, `zones`, `clients/{id}/zone-access`,
`clients/{id}/api-token`. C'est un modèle de **commercialisation de la donnée
d'adressage** : des clients tiers, un plan d'abonnement, un périmètre géographique concédé
(`zone-access`) et un jeton d'accès machine.

Rien de tout cela n'a jamais été discuté. Ce n'est pas un oubli d'implémentation, c'est un
pan fonctionnel entier — nouvelles entités, nouveau modèle d'authentification (jeton
machine à côté du JWT utilisateur), nouvelle notion de `Zone` qui ne correspond ni à
`City`, ni à `Quartier`, ni à `Bloc`.

**Mise à jour du 2026-08-12** : une entité `Zone` existe désormais, mais pour une tout autre
raison — le retour de la `Commune` dans la hiérarchie géographique (voir
[`recensement-geographie.md`](recensement-geographie.md)), une zone étant une partie d'une
commune. `GET /api/zones` répond donc, mais rien ne dit que c'est le même objet que le
périmètre concédé à un client de `zone-access`. **À vérifier avec le front avant de figer le
nom** : si ce sont deux notions distinctes, l'une des deux devra être renommée. La question
Q3 (le module est-il dans le périmètre ?) reste par ailleurs entière.

**Bloquant : à confirmer comme étant dans le périmètre du projet avant toute conception.**

### M2 — Notifications (3 routes)

`GET /notifications`, `PATCH /{id}/read`, `PATCH /read-all`. Pas d'entité `Notification`.
Chantier autonome et de taille raisonnable, mais il faut d'abord savoir *ce qui* notifie :
suggestion à examiner, relevé soumis, campagne clôturée, relevé en souffrance
(`GET /api/surveys/stalled` est déjà le signal correspondant). **TODO**, non conçu.

### M3 — Registre (7 routes)

> **Repris et remplacé le 2026-08-18** par
> [`contrat-api-registry.md`](contrat-api-registry.md) : le front a fourni le contrat
> détaillé de ces 7 routes (désormais sur `/api/adresses`, plus `/registry`). L'analyse
> champ par champ est là-bas ; ce qui suit reste valable comme première lecture.

`/summary`, `/filters`, `POST /search` (paginé), `/{id}`, `POST /approve` (masse),
`PATCH /bulk`, `POST /{id}/flag`.

Le « registre » est vraisemblablement la vue consolidée des adresses. Nous n'avons que
`GET /api/adresses?blocId=` (filtre unique, **non paginé**, renvoie tout) et
`GET /api/adresses/{id}`.

Ce module révèle une lacune transverse réelle : **aucun de nos endpoints de liste n'est
paginé**. Acceptable sur `cities` ou `campaigns`, intenable sur les adresses à l'échelle
de Djibouti. La recherche par `POST` avec corps de requête est aussi la bonne forme dès
que les critères se multiplient. **TODO prioritaire indépendamment du front.**

Les actions de masse (`approve`, `bulk`) et le `flag` supposent en plus un cycle de
validation *sur l'adresse elle-même*, distinct de celui du relevé — à ne pas confondre
avec `Survey`. À clarifier avant conception.

---

## Ce que nous exposons et que le front n'utilise pas

Tout le module recensement terrain est absent de sa liste : `/api/campaigns` (9 routes),
`/api/campaign-assignments`, `/api/campaign-blocs/transfer`, `/api/surveys` (13 routes),
`/api/units`, `/api/cities`, `/api/quartiers`, le CRUD `/api/adresses`,
`/api/types-occupation`, `/api/etats-occupation`.

Deux lectures possibles : soit l'application agent est un client distinct (mobile), soit
ce back-office ne couvre pas encore ce périmètre. À clarifier — la réponse change
l'ordre de priorité de tout le reste. Voir Q1.

Cas particulier, `review-api` : le front attend une **file de validation unifiée**
(`GET /review/queue`, puis `POST /review/{submissionType}/{id}/approve|reject`). Toute la
logique existe côté back, mais éclatée en trois files (`/api/surveys?status=Submitted`,
`/api/blocs/suggestions?status=Pending`, `/api/streets/suggestions?status=Pending`) avec
trois routes d'approbation distinctes.

Une façade d'agrégation est légitime ici — c'est une vraie tâche métier du superviseur
(« vider ma file »), pas une commodité de client. **TODO**, en gardant les trois routes
sous-jacentes : la façade agrège, elle ne remplace pas. Attention aussi à
`POST /api/surveys/{id}/request-correction`, troisième issue que le modèle à deux boutons
du front ne prévoit pas — elle ne doit pas disparaître dans la façade.

---

## État actuel

Fait :
- Recoupement complet des 44 appels front contre l'inventaire réel des routes.
- [`docs/guide-integration-frontend.md`](../guide-integration-frontend.md) rédigé et
  destiné à l'équipe front : conventions transverses (auth, erreurs, enums, WKT) et
  inventaire exhaustif des routes disponibles.

Décidé :
- Les 8 écarts de forme sur les suggestions ne sont **pas** corrigés côté back (E-forme).
- L'affectation de bloc reste scopée campagne (E2).

Survenu depuis (2026-08-12, sans lien avec le front) : retour de la `Commune` et introduction
de la `Zone` dans la hiérarchie géographique. Sans effet sur les 44 appels recensés — le front
n'utilise aucune route `/api/quartiers` — et deux ressources s'ajoutent à l'inventaire du
guide (`/api/communes`, `/api/zones`). Le libellé d'adresse est inchangé.

**Mise à jour du 2026-08-18** — le guide front a été réécrit en conséquence, sa section 0
listant les ruptures de contrat :
- **`POST`/`PATCH /api/quartiers` reprennent `cityId` (obligatoire) et rendent `communeId`
  facultatif**, ce qui **annule** la formulation du 2026-08-12 ci-dessus : la déduction
  ville←commune rendait Ali Sabieh inexprimable, seule Djibouti-ville ayant des communes.
- `City.Code` obligatoire à la saisie, `Quartier.AreaNumber` obligatoire et unique par ville,
  `postcode` dérivé en lecture, `addressCode` figé à la validation `Definitive`.
- Le sentinelle `AreaNumber = 0` est devenu `NULL` — le guide demande au front de changer son
  test.
- **Q4 (« région ») est tranchée** : `region` = `City`, `cityId` fait foi. Elle sort des
  questions ouvertes ; une 4ᵉ question la remplace, sur `street` au niveau de l'adresse (voir
  [`contrat-api-registry.md`](contrat-api-registry.md) §3.2).
- Deux descriptions OpenAPI périmées corrigées au passage (`CreateQuartier` annonçait encore
  `communeId` obligatoire et la ville déduite ; `DeleteQuartier` citait les `occupations`,
  table supprimée le 2026-08-09).

Non tranché, par ordre de blocage :
1. **Q1** — Le back-office couvre-t-il le module recensement terrain, ou est-ce un client
   séparé ? Conditionne l'ordre de tout le reste.
2. **Q2 / E1** — Une parcelle peut-elle exister sans numéro ? Conditionne un changement de
   modèle sur `Adresse`.
3. **Q3 / M1** — Le module clients/abonnements/jetons est-il dans le périmètre ?
4. **`street` au niveau de l'adresse** (Registry §3.2) — décision de modélisation.

TODO indépendants de ces réponses :
- Pagination sur les endpoints de liste, à commencer par `/api/adresses` (M3).
- Façade de file de validation unifiée (`review`).
- Module notifications (M2).
