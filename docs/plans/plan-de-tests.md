# Plan de tests — mode réel

> Contexte : `useMockApi: false` depuis le 2026-08-19. Tout ce qui a été retravaillé cette
> session (Registry/Adresse, Hiérarchie, Blocs, Fieldops/Review/Verification, Addressing) a été
> vérifié **sur le papier** — DTOs comparés au code source réel — mais **jamais exécuté** contre
> un backend qui tourne. C'est le point faible actuel : ce plan couvre les trois angles
> (QA manuelle, tests unitaires, e2e), par ordre de priorité.

---

## 1. QA manuelle — à faire en premier, dès `dasApi` lancé

Rien ne remplace un premier passage humain contre le vrai backend. Checklist priorisée par ce
qui a été **modifié cette session** (risque le plus élevé) puis par ce qui était déjà stable.

### Préalable

- [ ] `dasApi` démarré (`dotnet run` depuis `src/DASApi.WebApi`, ou docker-compose) et accessible
      sur `http://localhost:5026`.
- [ ] Vérifier `GET http://localhost:5026/api/adresses/summary` répond (pas de 404/CORS) avant de
      lancer `ng serve`.
- [ ] Compte `Admin` du seed disponible (`Seed:AdminUsername`/`Seed:AdminPassword` en dev).

### 1.1 Module Adresse (ex-Registry) — priorité haute, tout réécrit cette session

- [ ] Connexion, arrivée sur `/adresse` (redirection par défaut).
- [ ] KPIs de synthèse s'affichent (`totalRecords`, `pendingReview`, `duplicatesFlagged` libellé
      **« À revoir »**, `publishedToday`).
- [ ] Liste paginée charge, changement de page/taille de page fonctionne.
- [ ] Filtre recherche, filtre statut, filtre équipe fonctionnent individuellement et combinés.
- [ ] Cascade hiérarchique (ville → commune → zone → quartier → bloc) filtre bien la liste **et**
      la carte en même temps.
- [ ] **Tester une ville sans commune (ex. Ali Sabieh)** : le select Quartier doit rester
      utilisable dès la ville choisie, sans passer par commune/zone (fix hiérarchie de cette
      session).
- [ ] Ouvrir le tiroir détail : composants, localisation, type de propriété (libellé brut, pas de
      `adresse.type.*`), bloc **Validation absent** (masqué), pas d'onglet historique.
- [ ] Sélection multiple + **Approuver** → vérifie qu'un `PATCH /bulk` part avec
      `stage: "Approved"` (PascalCase), pas `POST /approve`.
- [ ] Sélection multiple + **Publier** → `stage: "Published"`.
- [ ] Carte : tuiles Martin chargent, couleur par étape correcte, clic sur une adresse ouvre le
      bon tiroir.

### 1.2 Blocs — réécrit récemment (maille Number/BoundaryWkt)

- [ ] Liste des blocs charge (`GET /api/blocs`), recherche texte fonctionne (filtre client).
- [ ] Fiche bloc : carte en tuiles (pas d'overlay GeoJSON), renommage direct fonctionne pour un
      bloc avec `number` renseigné.
- [ ] **Bloc avec `number: null`** (antérieur au 2026-08-18) : le formulaire de nom est remplacé
      par le message `blocks.missingNumberHint`, pas de tentative de `PATCH`.
- [ ] Lien « Voir les adresses » depuis la fiche bloc → arrive sur `/adresse?blocId=...` filtré.

### 1.3 Recensement terrain (fieldops) — jamais exécuté en réel

- [ ] Liste des campagnes charge (`GET /api/campaigns`).
- [ ] Détail d'une campagne + `GET /{id}/progress` : charge et production s'affichent
      **séparément**, pas additionnées.
- [ ] Affectation d'un bloc à un agent (`POST /api/campaigns/{id}/blocs`) sur une campagne
      `Planned` ou `InProgress`.
- [ ] Réaffectation (`PATCH .../blocs/{blocId}/agent`) : vérifier que l'ancien titulaire ne perd
      pas le crédit de sa production déjà enregistrée.
- [ ] Transfert en masse (`POST /api/campaign-blocs/transfer`) entre deux agents.

### 1.4 File de validation unifiée (`/verification`) — jamais exécutée en réel

- [ ] Les trois types apparaissent dans la même file : relevés soumis, suggestions bloc,
      suggestions rue.
- [ ] Filtre par type fonctionne.
- [ ] **Valider** un relevé → `POST /api/surveys/{id}/validate`.
- [ ] **Rejeter** avec motif → `POST /api/surveys/{id}/reject` avec `rejectionReason`.
- [ ] **Renvoyer en correction** → `POST /api/surveys/{id}/request-correction` (le 3ᵉ bouton, à
      ne pas oublier).
- [ ] Approuver/rejeter une suggestion de nom de bloc/rue → l'item disparaît de la file, la
      donnée est bien répercutée si tu recharges `/adresse` (nom du bloc à jour).
- [ ] Photos d'un relevé s'affichent (`GET /api/surveys/{id}/photos`).

### 1.5 Addressing — nommage direct (rework de cette session)

- [ ] `/addressing/block-naming` : la liste **exclut** les blocs qui ont une suggestion en
      attente (ceux-là ne doivent apparaître que dans `/verification`).
- [ ] Nommer un bloc directement (`PATCH /api/blocs/{id}`), sans passer par une suggestion.
- [ ] Bloc sans `number` : même garde-fou qu'en 1.2.
- [ ] Idem pour `/addressing/street-naming`.
- [ ] Vérifier qu'il n'y a **plus** de bouton approuver/rejeter sur ces deux écrans (retiré cette
      session — doublon avec `/verification`).

### 1.6 Auth (peu touché, mais base de tout le reste)

- [ ] Login réel, JWT reçu, refresh token stocké.
- [ ] Rafraîchissement de session après expiration du JWT court.
- [ ] Deux onglets ouverts simultanément → les refresh concurrents ne se marchent pas dessus
      (sérialisation).
- [ ] Logout révoque le refresh token.

### Ce qu'on sait déjà cassé ou bloqué — ne pas perdre de temps dessus

- Dashboard, Notifications : aucune route back, contrat envoyé, en attente.
- `/addressing/property-numbering` : bloqué par le modèle (`Adresse.Numero` obligatoire),
  confirmé non implémentable côté back en l'état.
- Clients, Data Quality, Reports, Integrations, Audit, Postcodes (CRUD) : mock uniquement, aucune
  route réelle à tester.

---

## 2. Tests unitaires Angular (`ng test`, Karma/Jasmine)

**État actuel : quasi nul.** 3 fichiers `.spec.ts`, tous des stubs `should create` générés par
défaut (`app.spec.ts`, `dashboard.component.spec.ts`, `adresse-map-component.spec.ts`). Aucune
couverture réelle sur la logique métier.

### Priorité 1 — logique pure, zéro dépendance Angular (le meilleur rapport valeur/effort)

Ces fonctions sont des pièges silencieux si elles régressent — un test unitaire les fige à jamais.

| Fichier à tester | Ce qu'il faut verrouiller |
|---|---|
| `core/hierarchy/store/hierarchy.facade.ts` | `reloadQuartiers()` : cityId seul envoyé si commune/zone en « tous » ; communeId/zoneId ajoutés seulement si choisis ; jamais de requête sans cityId |
| `core/adresse/store/adresse.reducer.ts` | `setFilters` réinitialise `page` à 1 et vide `selectedIds` ; `mutationSuccess` vide la sélection |
| `core/blocks/store/blocks.reducer.ts` | `updateBlockSuccess` remplace l'item dans `items[]` **et** dans `selected` si c'est le même bloc |
| `core/review/store/review.effects.ts` | `loadQueue$` fusionne bien les 3 sources (surveys + blocSuggestions + streetSuggestions) en un seul tableau `ReviewItem[]` avec le bon `submissionType` par item |
| `core/adresse/services/adresse-api.service.ts` (ex `registry-api.service.ts`) | `bulkUpdate` n'envoie jamais `stage` en minuscules ; `list()` reste un `POST`, jamais un `GET` |
| `core/addressing/services/addressing-api.service.ts` | `listBlocksToName` exclut bien les blocs présents dans `suggestions` (le cœur du fix anti-doublon de cette session) |

### Priorité 2 — composants avec logique de garde-fou

| Fichier | Comportement à verrouiller |
|---|---|
| `features/blocks/block-detail/block-detail.component.ts` | `saveName()` ne dispatch rien si `b.number === null` |
| `features/addressing/block-naming/block-naming.component.ts` | `submitDirectName()` : même garde-fou |
| `features/adresse/adresse-list/adresse-list.component.ts` | `tileFilters()` : le niveau hiérarchique le plus profond non-null gagne (bloc > quartier > zone > commune > ville) |

### Priorité 3 — regression guard sur les DTOs (le plus proche du bug réel qu'on a trouvé)

Un test qui **échouerait** si quelqu'un renomme un champ front sans vérifier le back : un
fixture JSON figé (copié depuis une vraie réponse `dasApi`, capturée une fois en réel) que chaque
service désérialise et mappe. Concrètement :

```ts
// adresse-api.service.spec.ts — squelette proposé
const REAL_SUMMARY_FIXTURE = { totalRecords: 165, pendingReview: 8, duplicatesFlagged: 3, publishedToday: 2 };
it('mappe la réponse réelle de /api/adresses/summary sans perte de champ', () => {
  httpMock.expectOne('.../adresses/summary').flush(REAL_SUMMARY_FIXTURE);
  // assert sur summary$
});
```

Ce n'est pas un test e2e (pas de vrai réseau) mais ça capture la **forme exacte** du contrat au
moment où on l'a vérifiée — si le back change un nom de champ, le test casse au lieu de 404 en
silence en prod.

**Proposition** : je commence par la Priorité 1 (6 fichiers, logique pure, rapide à écrire et à
lire) si tu valides. Je ne pars pas sur la Priorité 2/3 sans confirmation — ça commence à
demander du `TestBed`/mocking plus lourd.

---

## 3. Tests e2e

**État actuel : aucun outillage.** Ni Playwright ni Cypress dans le repo.

### Recommandation d'outillage

**Playwright**, pas Cypress — meilleure intégration Angular actuelle (Angular CLI a un
schematic `ng add @playwright/test` maintenu), support multi-navigateur natif, et plus rapide en
CI. Installation : `npm init playwright@latest` ou `ng add @playwright/test`.

### Parcours critiques à couvrir (une fois l'outillage en place)

Priorisés par ce qui casse silencieusement si ça régresse — pas par facilité d'écriture :

1. **Login → liste adresses → filtre hiérarchique → tiroir détail.** Le parcours qui traverse le
   plus de couches (auth, store, HTTP réel, carte).
2. **Sélection multiple → Approuver → vérifier le changement d'étape dans la liste.** Couvre le
   piège de casse `stage` PascalCase — un test e2e est le seul filet qui verrait vraiment un 400
   si quelqu'un repasse `stage` en minuscules par erreur.
3. **File de validation : valider un relevé → il disparaît de la file.** Couvre la composition
   des 3 sources dans `/verification`.
4. **Cascade hiérarchique sur une ville sans commune (Ali Sabieh)** → le select Quartier reste
   utilisable. C'est exactement le bug qu'on a corrigé cette session ; un e2e dessus empêche la
   régression silencieuse.
5. **Bloc sans `number`** → impossible de le renommer, message affiché. Même logique côté
   `block-detail` et `block-naming` — un seul test peut couvrir les deux si on factorise un
   helper Playwright.

**Ce que je ne recommande pas en e2e** : les écrans encore 100% mock (Clients, Data Quality,
Reports…) — un e2e dessus ne teste que le mock lui-même, aucune valeur ajoutée tant qu'il n'y a
pas de vrai backend derrière.

---

## Ordre proposé

1. **QA manuelle §1** dès que `dasApi` tourne — c'est ce qui va révéler le plus de vrais bugs le
   plus vite, zéro code à écrire.
2. **Unitaires Priorité 1** en parallèle ou juste après — fige la logique déjà vérifiée pour
   qu'elle ne régresse pas silencieusement.
3. **Installation Playwright + parcours 1 et 4** en dernier — c'est l'investissement le plus
   lourd (outillage + CI), à ne lancer qu'une fois le mode réel confirmé stable par la QA
   manuelle.
