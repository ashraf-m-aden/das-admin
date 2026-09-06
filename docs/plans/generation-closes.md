# Génération des closes — état au 2026-09-06

> Écran de reprise : proposer les closes d'un quartier, les faire relire sur carte, puis les créer
> — closes, rattachement des blocs et **renumérotation des adresses** dans une seule transaction.
>
> Branche `feat/closes-generation`. Côté API : dépôt `dasApi`, branche `feat/registry-adresses`,
> plan de conception dans `docs/plans/adressage-close.md`.
>
> ⚠️ **L'algorithme de regroupement décrit en partie I est remis en cause.** Mesuré le
> 2026-09-06 : « bloc → rue la plus proche » produit 53 % de closes à un seul bloc et
> 723 perçages, parce qu'une close hérite de la longueur de sa rue. Voir la **partie II**,
> plus bas — diagnostic, stratégies comparées et pipeline retenu.

---

# Partie I — L'écran et le contrat

## 1. Où on en est

**Fait** — la couche de contrat, et rien d'autre côté front.

- `core/closes/models/closes.models.ts` : `QuartierCloseProgress`, `QuartierClosePlanParameters`,
  `ProposedClose`, `UnassignedBloc`, `QuartierClosePlan`, `ReviewedClose`,
  `ApplyQuartierClosesPayload`, `AppliedQuartierCloses`, plus les unions `ProposedCloseWarning` et
  `UnassignedBlocReason`.
- `closes-api.port.ts` : quatre méthodes.
- `closes-api.service.ts` : implémentation HTTP.
- `mock-closes-api.service.ts` : mock complet, qui rejoue les gardes du back dans le même ordre.

**Pas fait** — le store (`close-generation.{actions,reducer,effects,selectors,facade}.ts`), les
composants, les clés i18n `closes.generation.*`, la route.

**Côté API** — les quatre routes existent, compilent et ont été exercées contre la base réelle
depuis le conteneur. Aucune écriture n'a été faite.

```
GET  /api/quartiers/closes-progress
POST /api/quartiers/{id}/closes/preview             n'écrit rien
POST /api/quartiers/{id}/closes/numbering-preview   n'écrit rien
POST /api/quartiers/{id}/closes                     écrit tout, une transaction
```

---

## 2. La question à trancher avant d'écrire l'écran

**Une close doit porter au plus 99 adresses** (règle du 2026-09-04). Elle entre en conflit frontal
avec l'index unique `IX_Closes_QuartierId_StreetId`, qui interdit deux closes sur une même rue dans
un même quartier : une rue desservant plus de 99 adresses ne peut donc pas être découpée.

| | |
|---|---|
| Closes proposées sur toute la base | 531 |
| Sous le plafond | 475 |
| **Au-dessus** | **56**, pour **12 808 parcelles** |
| Closes après découpage à 99 | 638 |
| La plus grosse | **863 parcelles, dans un seul bloc** |

Tant que ce n'est pas tranché, **l'écran proposerait des closes qu'on ne voudra pas créer**. C'est
la décision `D-5` du plan de conception côté API, laissée ouverte.

En attendant, l'aperçu signale le dépassement par l'avertissement `ExceedsAddressCap`, distinct de
`LargeClose` : l'un conseille, l'autre constate un dépassement non corrigeable depuis l'écran.

---

## 3. Ce que les mesures imposent à l'écran

Chiffres relevés en base le 2026-09-04, sur 5 121 blocs et 87 quartiers.

**42 % des blocs n'ont aucune voirie urbaine à moins de 50 m.** 2 958 sont rattachables, 2 163 ne le
sont pas. Ce n'est pas un défaut d'appariement mais un trou du référentiel voirie, surtout à Balbala
et dans les extensions. `unassignedBlocs` n'est donc pas une liste d'erreurs : c'est la moitié du
résultat. **Le panneau qui les montre doit être ouvert par défaut**, et un compteur « n blocs
resteront sans close » doit se trouver à côté du bouton de confirmation. Sans ça, l'opérateur croira
que le quartier a été traité en entier.

**345 closes sur 531 collident sur les numéros**, soit 15 745 parcelles — chaque bloc numérote à
partir de 1. La renumérotation est donc la règle, pas l'exception. Une close en collision ne peut
pas être confirmée sans que son plan ait été ouvert et relu ; le bouton de confirmation reste
désactivé tant qu'il en reste une non revue.

**941 rues sur 1 344 n'ont pas de nom.** Le badge `UnnamedStreet` doit être visible sur la ligne,
avec le renommage à portée de clic — `renameStreet()` existe déjà au port.

**L'aperçu d'un quartier pèse déjà 243 Ko** (Quartier 7, 41 closes) *sans* le détail des
numérotations. Une close porte 45 parcelles en moyenne et jusqu'à 863, chacune avec sa position et
sa géométrie : c'est pour ça que le plan détaillé se charge à l'ouverture d'une close, sur sa propre
route, et pas dans l'aperçu.

### Les blocs d'une close se touchent (corrigé le 2026-09-05)

Le regroupement se faisait par la seule rue la plus proche, sans aucun contrôle de contiguïté :
une avenue traversant le quartier ramassait tous les blocs de son parcours. Mesuré avant
correction, sur les 375 closes à plus d'un bloc — étendue moyenne 305 m mais **maximum 1 803 m**,
54 closes au-delà de 500 m, 56 blocs à plus de 100 m de tout autre bloc de leur propre close.

Chaque groupe est maintenant découpé en composantes connexes (seuil `maxBlocGapMeters`, 100 m par
défaut) et seule la plus grosse est proposée. Les autres sortent en `NotContiguous` — un motif de
plus dans le panneau des non-rattachés, et le chiffrage du coût de la règle « une rue, une close
par quartier ».

Ce qui reste long l'est légitimement : « Avenue 37 », 27 blocs contigus sur 952 m, est une vraie
chaîne d'adjacence. La couper suppose de scinder la rue — donc de lever la même règle que le
plafond de 99.

---

## 4. Points de contrat à ne pas redécouvrir

**La numérotation décrit la close, elle ne la référence pas.** `previewProposedCloseNumbering`
envoie rue, numéro, code et blocs — pas la `key` de la proposition. Entre l'aperçu et l'ouverture
d'une close, l'opérateur a pu retirer un bloc, en déplacer un ou changer de rue : numéroter la
proposition d'origine numéroterait autre chose que ce qu'il regarde. `ProposedClose` garde sa `key`,
qui vient de l'aperçu ; `ReviewedClose` n'en a pas.

**Les codes d'enum sont ceux du back**, pas une traduction. `Program.cs` sérialise les enums en
chaînes : `NoStreetNearby`, `BlocWithoutGeometry`, `BlocAlreadyAttached`, `StreetAlreadyHasClose`,
`UnnamedStreet`, `LargeClose`, `ExceedsAddressCap`, `SingleBloc`. On teste le code, on traduit à
l'affichage.

**`numbering` est obligatoire dès que `hasNumeroCollision`**, et doit couvrir **toutes** les
parcelles de la close, pas seulement celles qui changent. Le back revérifie la couverture et
l'unicité, et refuse un plan partiel plutôt que de le compléter — vérifié : 400
`Closes.NumberingIncomplete`, « 56 parcelles sur 66 manquantes ».

**Le plan s'applique en entier ou pas du tout.** Un refus sur une close du plan n'écrit rien pour
tout le quartier. Une close rattachée ne se supprime plus (`ON DELETE RESTRICT` sur `Blocs.CloseId`
et `Adresses.CloseId`) : l'erreur appliquée se corrige bloc par bloc, à la main.

**Le mock reproduit les proportions, pas un cas idéal** : 6 blocs rattachables, 3 hors de portée,
collision sur les closes à plusieurs blocs. Un mock où tout tombe juste rendrait l'écran
invérifiable — on ne verrait jamais le panneau des non-rattachés ni le blocage sur collision.

---

## 5. Enjeu de calendrier

`AddressCodeGenerator` rend `null` tant qu'une parcelle n'a pas de close. Aujourd'hui,
**`ValidateSurveyHandler` ne fige donc aucun code d'adresse** — une seule adresse sur 24 558 en porte
un. Le risque est neutralisé, mais par un blocage : tant que la reprise n'est pas faite, une
validation définitive ne produit aucun code.

Cet écran ne fait pas gagner du temps, il **débloque la validation**. Et il doit passer avant la
première campagne de validation : chaque code figé retire des adresses du champ de la
renumérotation.

---

## 6. Suite

1. ~~Trancher le plafond de 99 (`D-5`).~~ **Tranché le 2026-09-06** : le plafond peut être
   dépassé au besoin. Il concerne 55 closes pour 15 935 adresses et reste inapplicable tant que
   l'unicité `(quartier, rue)` interdit de scinder une rue.
2. ~~Store NgRx, puis les composants.~~ **Faits** — `close-generation.{actions,reducer,effects,
   selectors,facade}.ts`, `closes-generation.component`, `close-proposal-row`,
   `close-numbering-panel`, clés i18n `closes.generation.*`, route.
3. Exercer sur le Quartier 7, qui porte les deux seules closes existantes.
4. **Trancher le changement d'unité de regroupement** (partie II, §11). C'est le point bloquant :
   en l'état l'écran propose des closes dispersées, quelle que soit la qualité de l'interface.

---

# Partie II — Le regroupement géométrique (mesures du 2026-09-06)

> La partie I décrit l'écran et le contrat. Celle-ci ne traite que de **l'algorithme de
> regroupement** : quels blocs vont ensemble dans une close.
>
> Elle remet en cause « bloc → rue la plus proche ». Les chiffres de la partie I datent d'avant
> l'import de Balbala (`Streets` : 1 344 → 4 284) et ne sont plus à jour.
>
> Toutes les mesures viennent de la base de production, périmètre **7 115 blocs, 4 283 rues
> géométriques, 87 quartiers, 4 villes**. Rapport lisible :
> https://claude.ai/code/artifact/d81a9667-bc59-4791-ba45-afb4b93e9fb4

## 7. Le constat

Close `PK-04`, quartier PK12, sur la rue `OSM-W101529382`.

| | |
|---|---|
| Longueur de la rue | **2 907 m**, un seul morceau, type « Rue », sans nom |
| Blocs de la close | 39 (34 dans PK12, 5 dans CITE HODAN) |
| Étalement | **2 956 m** entre les deux blocs les plus éloignés |
| Solidité (aire ⁄ enveloppe convexe) | 0,212 |

Cette rue échappe à tous les garde-fous en place : elle n'est ni multi-morceaux, ni préfixée
comme un axe national. Et le cas est général — **1 484 rues sur 4 283 dépassent 300 m**, le
neuvième décile est à 3 864 m, le maximum à 214 km.

---

## 8. La cause : la close hérite de sa rue

`IX_Closes_QuartierId_StreetId` est **unique**. Une close est donc, par construction, *toute* la
façade d'une rue à l'intérieur d'un quartier. Elle hérite mécaniquement de la géométrie de cette
rue : une rue de 2,9 km produit une close de 2,9 km.

Deux défauts du référentiel voirie amplifiaient l'effet. Tous deux sont des séquelles de nos
propres imports, pas de la donnée source.

- **La liste d'exclusion ne couvrait que les préfixes `SIG-`.** Les axes importés depuis OSM
  portent `OSM-ROUTE-*` et `OSM-PISTE-*`, la voirie SIG un `SIG-VE-*`. Passaient donc au travers :
  `OSM-ROUTE-NATIONALE-1` (**214 km**), `OSM-ROUTE-NATIONALE-9` (120 km), `SIG-VE-00001` (98 km).
- **221 rues sont faites de morceaux disjoints**, jusqu'à **240 fragments** pour une seule —
  conséquence d'un regroupement par nom avec `ST_Collect` : deux rues homonymes dans deux quartiers
  différents devenaient une seule entité.

### ⚠️ `maxBlocGapMeters` ne corrige pas cela

C'est le piège principal, et il a coûté deux itérations. Vérifié sur `PK-04` : après coupure de
contiguïté à 25 m, le plus gros sous-groupe conserve **26 blocs étalés sur 1 436 m**.

Une file de blocs distants de 20 m chacun est parfaitement « contiguë » et court pourtant sur des
kilomètres. **La contiguïté n'est pas la compacité** : aucun seuil d'écart entre voisins n'exprime
une contrainte de diamètre.

Pour référence, l'écart au bloc voisin le plus proche, sur les 7 115 blocs :

```
p10  0,0 m     847 blocs jointifs (< 0,5 m)
med  4,2 m   3 235 blocs a 0,5 - 5 m
p90 16,6 m   1 749 blocs a 5 - 12 m       1 284 blocs a plus de 12 m
```

Le réglage d'origine, 100 m, enjambait six fois l'écart courant.

---

## 9. ⚠️ Un piège de mesure, à écarter avant toute comparaison

La **solidité** — aire des blocs rapportée à celle de leur enveloppe convexe — semble la métrique
naturelle. Elle est **biaisée par la taille** : une close d'un seul bloc obtient toujours 1,000,
puisque son enveloppe est le bloc lui-même.

Comparer sur ce seul critère des stratégies qui ne produisent pas des closes de même taille mène
donc à **retenir la plus fragmentée**. C'est exactement ce qui s'est produit : le découpage aux
intersections affichait 0,979 de solidité médiane, la meilleure de toutes — en fabriquant des
closes minuscules.

Les métriques retenues, insensibles à la taille :

| Métrique | Définition |
|---|---|
| **Étalement par bloc** | mètres entre les deux blocs les plus éloignés, divisés par le nombre de blocs |
| **Bloc isolé** | bloc n'ayant aucun voisin de la même close à moins de 30 m |
| **Perçage** | close dont l'enveloppe convexe recouvre plus de **10 %** d'une autre close du même quartier |

Le seuil de 10 % est délibéré : à 1 m² d'intersection, le contrôle crie sur des échardes
topologiques et cesse d'être lu.

---

## 10. Les trois stratégies mesurées

| | Rue la plus proche (actuel) | K-means seul | **Voie large + K-means + fusion** |
|---|---:|---:|---:|
| Closes proposées | 2 048 | 1 221 | **1 324** |
| Blocs par close (médiane) | 1 | 6 | **5** |
| Blocs de la plus grosse close | 653 | — | **18** |
| Closes à un seul bloc | 1 093 · 53 % | 91 · 7 % | **7 · 0,5 %** |
| Étalement par bloc | 41 m | 27 m | **28 m** |
| Étalement médian | 88 m | 158 m | 149 m |
| Perçages (> 10 %) | 723 | **187** | 339 |
| Closes non percées | 69 % | **85 %** | 78 % |

L'étalement médian de K-means est plus élevé que l'actuel, et c'est attendu : ses closes
contiennent six fois plus de blocs. Rapporté au bloc, il est nettement meilleur.

La troisième colonne est la seule à satisfaire les deux exigences métier ajoutées le
2026-09-06 : **aucune close ne franchit une voie large**, et **aucune close ne se réduit à un
bloc** hormis les sept quartiers qui n'en contiennent qu'un. Elle paie ce gain par un peu plus de
perçages — la fusion des blocs orphelins rapproche des cellules que la géométrie seule aurait
laissées distinctes.

---

## 11. Le pipeline retenu

### Étape 1 — la voie large est une frontière infranchissable

Deux blocs dont le segment de liaison traverse un **boulevard, une avenue ou une route urbaine**
ne peuvent pas appartenir à la même close.

Le réseau large urbain compte **225 voies** : 123 boulevards (208 km), 68 avenues (45 km),
34 routes urbaines. Sur **28 045** liens de voisinage (blocs du même quartier à moins de 40 m),
**6 376 sont coupés**. Les composantes connexes restantes sont les îles du tissu.

C'est ce qui encode la séparation par voies claires **sans exiger que le réseau referme des
boucles** — condition que cette donnée ne remplit pas, cf. §6.

### Étape 2 — partitionner chaque île

`ST_ClusterKMeans` avec `k = ⌈blocs ⁄ 6⌉`, appliqué **à l'intérieur** de chaque île. Les frontières
internes ne sont pas des voies, mais aucune close ne franchit une voie large.

C'est l'étape qui supprime les monstres : la plus grosse close passe de **653 à 18 blocs**.

### Étape 3 — fusionner ce qui reste sous deux blocs

D'abord par lien de voisinage, **sans jamais refranchir une voie large**. Puis, pour les blocs sans
aucun voisin à 40 m, vers la close la plus proche du même quartier.

> ⚠️ **La cible doit être strictement plus grosse** (ou de clé inférieure à taille égale). Sans
> cette règle, deux orphelins voisins se désignent mutuellement et s'échangent indéfiniment : la
> boucle sort sur son garde-fou de tours et laisse 151 closes à un bloc.

Les closes à un bloc passent de 1 760 à **7** — et ces 7 sont exactement les 7 quartiers qui ne
contiennent qu'un seul bloc. Cas irréductible : une close ne peut pas déborder de son quartier.

### Étapes 4 et 5 — nommer

Découper le réseau urbain en tronçons (coupe à chaque intersection, plafond 250 m), puis attribuer
gloutonnement une rue à chaque cellule, du plus gros groupe au plus petit, chacun prenant la rue
libre la plus proche. L'unicité `(quartier, rue)` est ainsi respectée **sans être modifiée**.

| Réservoir de rues | Cellules nommées | Ont leur rue la plus proche | Distance méd. / p95 |
|---|---:|---:|---:|
| Rues actuelles (4 283) | 875 · 72 % | 65 % | 0 m / 36 m |
| Rues découpées (14 864) | **932 · 76 %** | **93 %** | 0 m / 21 m |

Le gain du découpage est **modeste** : 4 points de nommage. C'est ce qui le rend optionnel, cf. §7.

---

## 12. Quatre pistes explorées et écartées

Elles figurent ici parce que chacune paraissait décisive avant d'être mesurée.

### Polygoniser le réseau — écartée, testée à trois niveaux

Une maille bornée par des rues ne peut pas en chevaucher une autre : la propriété recherchée,
gratuitement. Mais à chacun des trois niveaux essayés, **une seule maille contient des blocs** :

| Niveau de réseau | Voies | Mailles produites | Mailles contenant des blocs | Blocs hors maille |
|---|---:|---:|---:|---:|
| Voies larges | 395 | 459 | **1** | 4 876 / 7 115 |
| + rues nommées | 646 | 696 | **1** | 2 905 / 7 115 |
| + toutes les rues | 3 610 | 3 210 | **1** | 2 246 / 7 115 |

Les mailles ne sont pourtant pas des échardes : sur les 459 du réseau large, 410 font entre 100 m²
et 1 ha. Elles se forment **entre les deux chaussées des boulevards dédoublés** dans OSM, pas
autour des îlots bâtis. Le réseau ne referme aucune boucle sur le tissu.

> ⚠️ Un premier essai avait conclu à « zéro interpénétration, par construction ». C'était un
> **artefact** : avec une seule maille utile, chaque quartier formait un unique groupe, et il n'y
> avait donc rien à chevaucher.

### Regrouper par adjacence (DBSCAN) — écartée

Donne soit de la poussière, soit un monstre. Le tissu de Balbala est un tapis continu qu'aucun
seuil ne découpe proprement.

| Écart | Îlots | Médiane | Maximum | Îlots à 1 bloc |
|---:|---:|---:|---:|---:|
| 15 m | 1 297 | 1 | 802 | 884 |
| 25 m | 650 | 1 | 1 061 | 355 |
| 40 m | 362 | 2 | 1 066 | 169 |

### Plafonner la longueur des rues — insuffisante seule

Raccourcit les closes sans les empêcher de s'enchevêtrer : **1 863 paires en interpénétration
contre 1 906** avant. Utile en complément, inutile seule.

### Couper les rues à chaque intersection — trop fine seule

Produit **14 864 tronçons pour 5 179 blocs appariés** — plus de rues que de blocs, donc
mécaniquement des closes à un bloc (53 %). Sur `PK-04`, 24 closes de 3 blocs au plus. Reste
nécessaire, mais comme **réservoir de noms**, pas comme unité de regroupement.

### Coupe graduée seule — insuffisante

Descendre d'un cran de voie là où le groupe reste trop gros : 2 597 groupes, dont **1 760 (68 %) à
un seul bloc**. Il fallait l'étape de fusion.

---

## 13. ⚠️ Ce que cela écrit, et ce que cela ne touche pas

Question posée le 2026-09-06 : *« cela veut dire que tu vas modifier les valeurs des blocs et des
rues ? »* Non. Le pipeline de génération écrit **trois choses**, et rien d'autre.

| Table | Colonne | Ce qui change |
|---|---|---|
| `Closes` | lignes créées | ~1 324 closes |
| `Blocs` | **`CloseId` seule** | le rattachement |
| `Adresses` | `CloseId`, `Numero` | rattachement + renumérotation |

`Blocs.Boundary`, `Blocs.Code`, `Blocs.Name`, `Blocs.Number`, `Blocs.QuartierId` : **intacts**.
Toutes les colonnes de `Streets` : **intactes**.

Le terrain est vierge, ce qui limite le risque :

```
2 closes existantes
5 blocs rattaches sur 7 115
21 adresses rattachees sur 36 163
1 adresse au code figé (AddressCode non nul)
0 adresse publiee ou approuvee
```

### La seule opération qui toucherait vraiment aux rues

`scripts/sig/streets-decouper-troncons.sql` **réécrit la géométrie de 3 499 rues** et en crée
11 365. C'est la partie **non réversible sans sauvegarde**, et elle n'est **pas appliquée**.

Son rôle a changé au fil de l'analyse : il ne sert plus à former les closes — c'est la voie large
qui les sépare — mais seulement à fournir des noms distincts. Le gain est de 4 points (§5).

**Le nouveau regroupement peut donc être mis en service sans jamais toucher aux rues.** On perd
4 points de nommage, et 346 cellules au lieu de 289 restent sans rue attribuée. À traiter comme un
lot séparé, une fois le regroupement validé.

---

## 14. État des livrables

**Appliqué**

- `scripts/sig/reseau-osm-vers-streets.sql` — 2 940 voies de Balbala versées dans `Streets`
  (2026-09-06). Ajout seul, aucune ligne existante modifiée. `Streets` : 1 344 → 4 284. Les blocs
  de Djibouti ayant une rue à moins de 50 m passent de 2 958 à 5 101 sur 5 121.
- `core/closes/store/close-generation.state.ts` — liste d'exclusion complétée (`SIG-VE-`,
  `OSM-ROUTE-`, `OSM-PISTE-`), `maxBlocGapMeters` ramené de 100 à 25 m.

**Écrit, testé à blanc, non appliqué**

- `scripts/sig/streets-decouper-troncons.sql` — découpage du réseau urbain en tronçons.
- `scripts/sig/streets-eclater-morceaux.sql` — **remplacé** par le précédent, qui couvre son cas.
  Conservé pour la trace du raisonnement, à ne pas exécuter.

**À décider — côté back**

- Le changement d'unité de regroupement (§5) touche `POST /api/quartiers/{id}/closes/preview`.
  Hors du dépôt front. Le pipeline a été validé en SQL sur la base de production ; les requêtes
  sont transposables telles quelles.
- `QuartierClosePlanParameters` gagnerait un **plafond de longueur de rue** : 13 axes interurbains
  nommés `OSM-<NOM>` ne sont pas excluables par préfixe sans emporter des rues urbaines légitimes
  — `OSM-148704475` porte la close `Q7-02`.
- Une **contrainte d'acceptation sur le perçage** : refuser une proposition dont l'enveloppe
  convexe recouvre plus de 10 % des blocs d'une autre, et rendre le bloc contesté.
- La règle des **99 adresses** concerne 55 closes pour 15 935 adresses. Elle reste inapplicable
  tant que l'unicité `(quartier, rue)` interdit de scinder une rue. Décision du 2026-09-06 :
  le plafond peut être dépassé si nécessaire.
