# Adressage — composition des identifiants et introduction de la `Close`

> **Pourquoi ce fichier.** Jusqu'au 2026-08-23, l'adressage n'avait **aucune doc dédiée** : le
> concept était éclaté entre `schema-recensement-gis.md` (tables), `recensement-geographie.md`
> (hiérarchie) et `contrat-api-registry.md` §3.1/§3.7 (dérivations) — dont **§3.7 est périmée**
> (elle décrit `DJ-BLS-Q7-0042`, un format alphanumérique avec préfixe pays et segment commune,
> abandonné le 2026-08-18). La source de vérité réelle était les commentaires XML de trois
> classes C#. Ce fichier rassemble la règle, et documente l'ajout de la `Close`.

---

## 1. Les trois identifiants dérivés — ne jamais les confondre

| | Composition | Stockage |
|---|---|---|
| **`postcode`** | `City.Code` + `Quartier.AreaNumber` → `77007` | **jamais stocké**, recalculé à chaque lecture |
| **`addressCode`** | voir §2 → `77-007-3-7-42` | **figé en base**, une fois pour toutes |
| **`libelle`** | `« 42, bloc 2, Quartier 7 Djibouti »` | jamais stocké, recalculé |

**La distinction qui commande tout : `addressCode` se fige, les deux autres se recalculent.**
Raison (commentaire de `Adresse.AddressCode`) : ses composants sont modifiables (`SetCode`,
`SetNumber`, `SetAreaNumber`), donc un code recalculé changerait au renommage d'un quartier —
« ce qui en ferait un libellé, pas un identifiant ».

Le figeage a lieu à la **validation d'un relevé en `Definitive`**
(`ValidateSurveyHandler.FreezeAddressCodeAsync`), pas à la création de la parcelle. Une fois
posé, il n'est plus jamais réécrit.

> **`Close` entre dans `addressCode` mais PAS dans `postcode`.** Asymétrie assumée, confirmée
> par le responsable projet le 2026-08-23 : le code postal reste `code ville + code quartier`,
> point. Ne pas « harmoniser » les deux dérivations sous prétexte qu'elles partagent leurs deux
> premiers segments.

---

## 2. Le code d'adresse

### 2.1 Format actuel (2026-08-18) — 4 segments

```
77  -  007  -  7  -  42
│      │       │     └─ Adresse.Numero
│      │       └─────── Bloc.Number
│      └─────────────── Quartier.AreaNumber
└────────────────────── City.Code
```

Entièrement numérique. **Pas de segment commune** (seule Djibouti-ville en a, un segment
variable rendrait le code indécodable), **pas de préfixe pays** (constant, ne discrimine rien).

### 2.2 Format cible avec `Close` — 5 segments

```
77  -  007  -  3  -  7  -  42
│      │       │     │     └─ Adresse.Numero
│      │       │     └─────── Bloc.Number
│      │       └───────────── Close.Number      ← NOUVEAU
│      └───────────────────── Quartier.AreaNumber
└──────────────────────────── City.Code
```

### 2.3 La chaîne d'unicité — le point technique dur

Aucun segment n'est décoratif : **chaque numéro n'est unique que dans son parent**, et c'est
l'emboîtement qui rend la chaîne complète unique par construction. (Sans le segment bloc, les
165 adresses de la base de dev retombaient sur 67 codes distincts — cf. `AddressCodeGenerator`.)

| Contrainte | Avant | Après |
|---|---|---|
| quartier unique dans sa ville | `(CityId, AreaNumber)` | inchangé |
| **close unique dans son quartier** | — | **`(QuartierId, Close.Number)`** |
| **bloc unique dans sa close** | `(QuartierId, Bloc.Number)` | **`(CloseId, Bloc.Number)`** ⚠️ déplacée |
| **maison unique dans sa close** | `(BlocId, Numero)` | **`(CloseId, Numero)`** ⚠️ déplacée |

⚠️ **Deux contraintes changent de parent**, décision du 2026-08-23 :

- `Bloc.Number` : un bloc n° 7 pouvait exister une fois par quartier, il pourra exister une fois
  par close ;
- `Adresse.Numero` : **la maison n° 42 est désormais unique dans la CLOSE, plus dans le bloc.**
  Deux blocs d'une même close ne porteront jamais le même numéro de maison.

C'est le sens britannique du mot : sur *12 Oakwood Close*, le 12 est unique dans la close, pas
dans un sous-îlot. C'est aussi ce qui rend le **libellé** unique (§3.4).

**Le segment `Bloc.Number` du code devient donc redondant** — `ville-quartier-close-numéro`
suffirait à l'unicité. **Il est conservé quand même** (arbitrage explicite du 2026-08-23) : la
règle « aucun segment n'est décoratif » énoncée par `AddressCodeGenerator` ne vaut plus
strictement, c'est assumé. Ne pas « optimiser » le format en retirant le bloc sans nouvel
arbitrage.

### 2.4 Fenêtre de tir — c'est maintenant ou jamais

Relevé en base le 2026-08-23 :

| | |
|---|---|
| Adresses avec un `addressCode` figé | **0 / 2512** |
| Relevés (`Surveys`) en base | **0** |

**Le format n'est donc figé nulle part.** Changer la composition du code coûte zéro aujourd'hui.
Dès la première validation `Definitive`, chaque code posé l'est définitivement et un changement
de format créerait deux générations d'identifiants incompatibles dans la même table.

De la même façon, la contrainte `Bloc.Number` peut changer de parent sans reprise : **0 / 309
blocs** ont un `Number` aujourd'hui, il n'y a aucun doublon potentiel à dédoublonner.

---

## 3. La `Close`

### 3.1 Définition

Un **regroupement de blocs à l'intérieur d'un quartier**. Nouveau niveau de la hiérarchie :

```
City → [Commune] → [Zone] → Quartier → Close → Bloc → Adresse
```

Arbitrages du responsable projet (2026-08-23) :

- un bloc appartient à **une seule** close → c'est un niveau de hiérarchie, pas une étiquette ;
- une close appartient à **un seul** quartier → elle s'insère proprement dans la hiérarchie
  stricte, sans chevauchement ;
- la close **entre dans le code d'adresse** (§2.2) ;
- sa géométrie est **l'union de ses blocs, calculée à la volée** — pas de contour propre stocké,
  donc pas de risque de divergence entre le contour et son contenu.

Ce n'est **pas** le retour de `Lot` (supprimé le 2026-08-08) : `Lot` subdivisait un bloc,
`Close` regroupe des blocs. Sens inverse.

### 3.2 Champs

```ts
interface Close {
  id: UUID;
  name: string;
  /** 1..N, unique dans le quartier — 3ᵉ segment du code d'adresse. C'est LE champ structurant. */
  number: number;
  quartierId: UUID;
  /** Contenu. La géométrie de la close est l'union de ces blocs, jamais stockée. */
  blocIds: UUID[];
}
```

**Pas de champ `code`**, délibérément. `Quartier.Code` (`Q7`) et `Bloc.Code` (`Q7-A`) sont
historiques : ils précèdent le passage du code d'adresse en tout-numérique et ne participent plus
à la chaîne d'identification (ils ne servent qu'au repli d'affichage du libellé). Ajouter un
`Close.Code` créerait un champ sans consommateur. Si un mnémonique devient nécessaire, il se
dérivera du nom, comme le fait `QuartierCodeGenerator`.

### 3.3 Impact backend (à faire côté `dasApi`, hors de ce dépôt)

- **Entité `Close`** + table, avec index unique `(QuartierId, Number)`.
- **`Bloc.QuartierId` → `Bloc.CloseId`.** Le quartier d'un bloc devient joignable *via* sa close.
  Touche : `AdresseQueries.Rows` (le join `Bloc → Quartier` passe par `Close`),
  `FreezeAddressCodeAsync` (même join), `GET /api/blocs?quartierId=`, et la vue `blocs_tiles`
  qui expose `QuartierId` en colonne directe.
- **Index unique `(QuartierId, Bloc.Number)` → `(CloseId, Bloc.Number)`.**
- **`AddressCodeGenerator.Generate()`** prend un paramètre de plus. Il retourne déjà `null` dès
  qu'un composant manque — comportement à conserver pour `closeNumber`.
- **Libellé** : `AdresseQueries.ToResponse` compose `« {Numero}, bloc {blocLibelle}, … »` →
  devient `« {Numero}, close {closeLibelle}, … »`. Le repli actuel (`BlocName` → `BlocNumber` →
  `BlocCode`) se reporte sur la close, qui n'a que `name` et `number` (pas de `code`, §3.2).
- **`/api/closes`** : CRUD + affectation des blocs.

#### ⚠️ L'index `(CloseId, Numero)` n'est pas posable directement

`Adresse` porte `BlocId`, pas `CloseId`. Or **un index unique PostgreSQL ne traverse pas une
jointure** : on ne peut pas indexer `(Bloc.CloseId, Adresse.Numero)` depuis la table `Adresses`.
Trois sorties, à trancher côté back :

| | Ce que ça donne | Coût |
|---|---|---|
| **Dénormaliser `Adresse.CloseId`** | index unique natif, garantie réelle en base | à maintenir cohérent avec `Bloc.CloseId` si un bloc change de close |
| Trigger / contrainte d'exclusion | pas de colonne en trop | logique cachée en base, plus dur à déboguer |
| Contrôle applicatif seul | rien à migrer | **aucune garantie** contre les écritures concurrentes ou un import SQL direct |

**Recommandation : la dénormalisation.** C'est déjà le pattern du projet — `adresses_tiles`
aplatit `cityId/communeId/zoneId/quartierId/blocId`, et CLAUDE.md §4 impose que les filtres de
liste soient résolus « via les mêmes FK aplaties ». Le contrôle applicatif seul est à écarter :
`D2` (`failles-recensement.md`) a déjà tranché ce type d'arbitrage en défense en profondeur —
index en base **plus** contrôle applicatif pour un 409 lisible.

#### ⚠️ Ordre de migration — il y a une dépendance circulaire

On ne peut pas renuméroter avant de savoir quelle close contient quels blocs. L'ordre est donc
contraint :

1. créer les closes et y rattacher les **309 blocs** (`Bloc.CloseId` nullable en base, obligatoire
   à la saisie — **même schéma transitoire que `AreaNumber` et `Bloc.Number`**) ;
2. renuméroter les **2512 adresses**, unicité par close ;
3. renseigner `Quartier.AreaNumber` (0/6), `Bloc.Number` (0/309), `City.Code` (1/2) ;
4. **seulement ensuite**, laisser des codes se figer.

Les étapes 1 → 3 doivent toutes être finies **avant la première validation `Definitive`** : après
elle, chaque code figé l'est pour toujours (§2.4). Aujourd'hui il y a **0 relevé en base**, donc
la fenêtre est grande ouverte — mais elle se referme au premier relevé validé.

### 3.4 Le libellé — la close remplace le bloc (tranché le 2026-08-23)

```
avant :  « 42, bloc 2, Quartier 7 Djibouti »
après :  « 42, close 2, Quartier 7 Djibouti »
```

**Le bloc disparaît du libellé, remplacé par la close.** La règle des « exactement quatre
éléments » du 2026-08-08 est donc préservée : numéro, *close*, quartier, ville.

**Asymétrie assumée** : le bloc **reste** dans le code d'adresse (§2.2) mais **sort** du libellé.
Le code identifie, le libellé se lit.

#### Pourquoi la renumérotation de §2.3 n'est pas optionnelle

Sans elle, ce libellé serait **ambigu**. Relevé en base le 2026-08-23 :

| | |
|---|---|
| Adresses | 2512 |
| **Numéros distincts** | **39** |
| Occurrences du numéro `1` | **308** |
| Occurrences du numéro `2` | 273 |

Chaque bloc est numéroté à partir de 1 : dans Quartier 7 il y a **308 « maison 1 »**, une par
bloc. Avec l'ancienne unicité `(BlocId, Numero)`, toute close de 2 blocs ou plus aurait contenu
deux « maison 1 » — et `« 1, close 2, Quartier 7 Djibouti »` aurait désigné deux adresses
différentes.

C'est précisément le risque que le back refuse déjà sur le code postal (*« un code postal absent
se rattrape ; un code postal faux se propage jusqu'au courrier »*). Le passage de l'unicité à
`(CloseId, Numero)` est ce qui referme le trou.

⚠️ **Et comme `addressCode` est `null` sur les 2512 adresses, le libellé est aujourd'hui la seule
chose que l'utilisateur voit à l'écran.** Un doublon y serait immédiatement visible.

### 3.5 Collision de nommage à purger — préalable

« Close » est aujourd'hui la **traduction anglaise de « Bloc »** dans `en.json` (5 clés
résiduelles : `blockNaming`, `block_submitted`, `block_stalled`, `blockAssigned`, `blockNamed`).
`nav.blocks` est déjà revenu à `"Blocks"`, la correction est engagée mais incomplète.

**À finir avant d'introduire l'entité**, sinon l'UI anglaise dira « Close naming » en parlant d'un
bloc pendant qu'un écran « Closes » existe à côté.

---

## 4. Périmètre front (ce dépôt)

Le back n'a **aucune** entité ni route `Close`. L'écran est donc **entièrement mock**, et devient
le premier module à naître directement en `status: 'mock'` dans `core/config/backend-readiness.ts` :
badge « Mock » dès le premier jour, bascule en une ligne quand le back arrive.

### 4.1 Écran `/closes`

- **Liste** des closes (nom, numéro, quartier, nombre de blocs).
- **Création / édition** : nom, numéro, quartier, puis sélection des blocs **de deux façons
  synchronisées** :
  - clic direct sur un bloc de la carte ;
  - sélection dans la liste latérale, qui met en évidence le bloc sur la carte.
- Les blocs sélectionnés sont coloriés sur la carte — c'est ce qui rend visible « l'union des
  blocs » sans jamais la calculer géométriquement (§3.1).

### 4.2 Le terrain est déjà prêt — rien à inventer

- `blocs_tiles` est une source déclarée avec **`promoteId: "Id"`** → l'id de feature au clic
  **est** l'id du bloc, aucune résolution à faire.
- `das-map` expose déjà `tileLayers` / `tileFeatureStates` / `tileFilters` / `featureSelect`.
- `map-style.json` : `blocs-fill` lit déjà `feature-state.colorOverride` en priorité sur la
  coloration de base → le highlight de sélection ne demande aucune modification du style.
- **Précédent à suivre** : `campaign-detail.component` fait déjà exactement ça (colorier des
  blocs par agent via `feature-state`).

C'est aussi l'usage prévu par CLAUDE.md §4 : *« feature-state est réservé aux overrides live et
à la sélection »* — la coloration de base reste bakée dans le style.

### 4.3 Limite du mock

`blocs_tiles` n'a pas de colonne `CloseId` (l'entité n'existe pas). Le rattachement bloc → close
vit donc **uniquement dans le mock front**, et le filtrage carte se fait sur `QuartierId`, déjà
exposé par la tuile. Rien à changer côté Martin tant que le back n'a pas livré.
