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
| maison unique dans son bloc | `(BlocId, Numero)` | inchangé |

⚠️ La contrainte sur `Bloc.Number` **change de parent**. Un bloc n° 7 pouvait exister une seule
fois par quartier ; il pourra exister une fois **par close**.

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
- **Migration** : les 309 blocs existants doivent être rattachés à une close. `Bloc.CloseId` sera
  donc nullable en base et obligatoire à la saisie, **même schéma transitoire que `AreaNumber` et
  `Bloc.Number`**.
- **`/api/closes`** : CRUD + affectation des blocs.

### 3.4 Question ouverte — le libellé change-t-il aussi ?

Le `libelle` (`« 42, bloc 2, Quartier 7 Djibouti »`) est **distinct** du code d'adresse, et sa
forme vient d'une décision explicite du 2026-08-08 : *« une adresse doit s'exprimer avec
exactement quatre éléments : numéro de la maison, numéro ou nom du bloc, quartier, ville »*.

Insérer la close en ferait cinq. **À trancher séparément** : l'arbitrage du 2026-08-23 porte sur
le *code*, pas sur le libellé humain. Tant que rien n'est dit, le libellé reste à quatre éléments.

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
