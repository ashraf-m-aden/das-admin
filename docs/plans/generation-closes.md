# Génération des closes — état au 2026-09-04

> Écran de reprise : proposer les closes d'un quartier, les faire relire sur carte, puis les créer
> — closes, rattachement des blocs et **renumérotation des adresses** dans une seule transaction.
>
> Branche `feat/closes-generation`. Côté API : dépôt `dasApi`, branche `feat/registry-adresses`,
> plan de conception dans `docs/plans/adressage-close.md`.

---

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

1. Trancher le plafond de 99 (`D-5`).
2. Store NgRx, puis les composants — tout est vérifiable en mode mock.
3. Exercer sur le Quartier 7, qui porte les deux seules closes existantes.
