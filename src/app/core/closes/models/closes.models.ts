import { UUID } from '../../models/das.models';

/**
 * Portion d'une RUE à l'intérieur d'un quartier — c'est elle qui nomme l'adresse
 * (`12, rue de la Mosquée, Quartier 7 Djibouti`), pas le bloc. Rattache enfin `Street` à la
 * hiérarchie (dette `D1`) : une rue traverse plusieurs quartiers et ne peut donc pas porter de
 * `QuartierId` elle-même, alors qu'une close le peut.
 *
 * `number` est le 3ᵉ segment du code d'adresse (`77-007-3-42`, 4 segments — le bloc en est sorti
 * le 2026-08-23, `Bloc.Number` reste un identifiant de repérage terrain sans rôle dans le code).
 *
 * `label` est calculé côté BACK (repli `streetName` → `number` → `code`) : on le LIT, on ne le
 * recompose pas (même règle que `postcode`/`addressCode`, CLAUDE.md §9).
 *
 * Un bloc appartient à UNE SEULE close. Le rattachement ne se fait PAS ici : c'est
 * `POST/DELETE /api/closes/{id}/blocs` (trois gardes : même quartier, code figé, collision de
 * numéro) — jamais un champ de `PATCH /api/closes/{id}`.
 */
export interface Close {
  id: UUID;
  quartierId: UUID;
  quartierNom: string;
  quartierCode: string;
  streetId: UUID;
  streetCode: string;
  streetName: string | null;
  number: number;
  code: string;
  label: string;
  blocs: CloseBloc[];
  /** Compté sur `Adresse.CloseId`, pas sur les blocs — c'est cette colonne qui porte l'unicité du numéro. */
  adresseCount: number;
  boundaryWkt: string | null;
}

/** Bloc tel qu'il apparaît dans sa close — projection réduite, la fiche complète reste `GET /api/blocs/{id}`. */
export interface CloseBloc {
  id: UUID;
  code: string;
  name: string | null;
  number: number | null;
}

export interface CloseListQuery {
  quartierId: UUID | null;
  streetId?: UUID | null;
}

export interface CreateClosePayload {
  quartierId: UUID;
  streetId: UUID;
  number: number;
  code: string;
  boundaryWkt: string | null;
}

/** `quartierId` n'apparaît PAS ici : non modifiable après création (`Close.Update` ne le touche pas). */
export interface UpdateClosePayload {
  streetId: UUID;
  number: number;
  code: string;
  boundaryWkt: string | null;
}

export interface AttachBlocsPayload {
  blocIds: UUID[];
}

/** Rue telle que proposée au choix dans le formulaire de close — `GET /api/streets`, référentiel plat. */
export interface CloseStreetOption {
  id: UUID;
  code: string;
  /** `null` tant qu'aucune StreetSuggestion n'a été approuvée — on retombe sur `code` à l'affichage. */
  name: string | null;
  /** `TypeVoie` côté back (Rue, Avenue, Boulevard, Piste, Impasse, Route) — renvoyé tel quel. */
  type: string;
  /** Tracé de la rue. Toujours `null` à ce jour : aucune rue n'en a. */
  boundaryWkt: string | null;
}

/* =============================================================================
 * PLAN DE NUMÉROTATION — `POST /api/closes/{id}/blocs/preview`
 *
 * Rattacher plusieurs blocs à une close est refusé tant que leurs parcelles portent des numéros
 * qui collident : chaque bloc numérote à partir de 1. Le back ne renumérote pas tout seul — il
 * PROPOSE un ordre, le front le montre sur la carte, l'humain valide ou corrige, et c'est le plan
 * relu qui est appliqué. Jamais un recalcul après coup, qui écrirait autre chose que ce qui a été
 * vérifié.
 * ========================================================================== */

/**
 * `ParcelCloud` : l'ordre est déduit des parcelles seules — un axe est ajusté sur leur nuage.
 * C'est le seul régime possible tant qu'aucune rue n'a de tracé, donc **aujourd'hui, partout**.
 * C'est une estimation, et c'est précisément pourquoi le plan passe par la carte.
 */
export type CloseOrderingSource = 'ParcelCloud' | 'StreetLine';

/** Côté de l'axe. **Indicatif** : sans tracé de rue l'axe traverse les parcelles, ce n'est pas un trottoir — n'en tirer aucune parité. */
export type CloseSide = 'Left' | 'Right';

export interface PlannedAdresse {
  adresseId: UUID;
  blocId: UUID;
  blocCode: string;
  /** Vrai si la parcelle arrive avec un bloc en cours de rattachement — distingue ce qui bouge de ce qui était là. */
  entering: boolean;
  currentNumero: number;
  proposedNumero: number;
  /** Position le long de l'axe, en mètres depuis la première parcelle. C'est la clé de tri. */
  distanceMeters: number;
  side: CloseSide;
  /** Presque toujours `null`. Renseigné = numéro non modifiable, l'application du plan serait refusée. */
  addressCode: string | null;
  locationWkt: string;
  boundaryWkt: string;
}

export interface CloseNumberingPlan {
  closeId: UUID;
  closeCode: string;
  orderingSource: CloseOrderingSource;
  /** Sens de parcours utilisé. Rejouer l'aperçu avec l'autre valeur si le plan commence par le mauvais bout. */
  reverse: boolean;
  parcelCount: number;
  /** Parcelles dont le numéro changerait. `0` sur une close déjà numérotée = numérotation stable. */
  changedCount: number;
  adresses: PlannedAdresse[];
}

/** Ce que le front RENVOIE après validation sur carte, dans `numbering` de `POST /blocs`. */
export interface AdresseNumbering {
  adresseId: UUID;
  numero: number;
}

/* =============================================================================
 * GÉNÉRATION DES CLOSES PAR QUARTIER
 *
 * Écran de reprise : proposer les closes d'un quartier, les faire relire sur carte, puis les
 * écrire — closes, rattachement des blocs et RENUMÉROTATION des adresses dans la même
 * transaction. Rien n'est écrit avant confirmation.
 *
 * La règle de génération découle du schéma : `IX_Closes_QuartierId_StreetId` est UNIQUE, donc
 * une close = les blocs d'un quartier bordant UNE rue, et il ne peut y en avoir qu'une par
 * couple (quartier, rue). Un groupe trop gros n'est PAS scindable.
 *
 * Mesuré sur la base le 2026-09-04, sur 5 121 blocs et 87 quartiers :
 *   - 2 958 blocs (58 %) ont une rue urbaine à moins de 50 m → 531 closes sur 71 quartiers ;
 *   - 2 163 blocs (42 %) n'en ont aucune. Ce n'est pas un défaut d'algorithme mais un trou du
 *     référentiel voirie : ces blocs DOIVENT rester visibles à l'écran, jamais être tus ;
 *   - 345 closes sur 531 produisent des numéros en double (15 745 adresses), parce que chaque
 *     bloc numérote ses parcelles à partir de 1. La renumérotation n'est donc pas un cas limite.
 * ========================================================================== */

/**
 * Ligne de la liste des quartiers — de quoi décider par où commencer.
 *
 * `blocsRemaining` est ce qui compte : c'est le travail restant. Trier dessus met le utile en
 * haut, alors que trier sur le total met en avant des quartiers déjà faits.
 */
export interface QuartierCloseProgress {
  quartierId: UUID;
  quartierNom: string;
  quartierCode: string;
  cityName: string;
  communeName: string | null;
  zoneName: string | null;
  blocsTotal: number;
  blocsWithClose: number;
  /** `blocsTotal - blocsWithClose`. Renvoyé par le back, pas recalculé ici. */
  blocsRemaining: number;
  /**
   * Sous-ensemble de `blocsRemaining` qu'aucun appariement ne pourra traiter : sans emprise, un
   * bloc ne peut être rapproché d'aucune rue. Distingué pour qu'un quartier bloqué là-dessus ne
   * se lise pas comme « pas encore commencé ».
   */
  blocsWithoutGeometry: number;
  closesCount: number;
}

/**
 * Réglages de la proposition. Tous ont un défaut côté back : le front peut poster `{}`.
 *
 * `excludeStreetCodePrefixes` n'est pas un détail : les 692 tronçons du réseau NATIONAL importés
 * le 2026-09-04 (`SIG-RT*`, `SIG-PI*`) sont des routes et des pistes de désert. Sans cette
 * exclusion, des blocs de Balbala se retrouvent rattachés à une piste à 500 m — l'appariement
 * brut donnait 240 m de distance moyenne, contre une trentaine sur la seule voirie urbaine.
 */
export interface QuartierClosePlanParameters {
  /** Au-delà, le bloc part dans `unassignedBlocs`. 50 m par défaut. */
  maxDistanceMeters: number;
  /** `TypeVoie` du back : Rue, Avenue, Boulevard, Piste, Impasse, Route. Vide = tous. */
  streetTypes: string[];
  /** 941 rues sur 1 344 n'ont pas de nom. Les exclure fige 70 % du réseau. */
  includeUnnamedStreets: boolean;
  excludeStreetCodePrefixes: string[];
  /**
   * Écart maximal entre deux blocs VOISINS d'une même close. Au-delà, le groupe est coupé.
   *
   * Sans ce seuil, l'appariement « bloc → rue la plus proche » réunit tous les blocs bordant une
   * avenue, aussi loin soient-ils : mesuré le 2026-09-05, jusqu'à 1 803 m entre deux blocs d'une
   * même close proposée. Défaut 100 m — 2 614 blocs sur 2 755 ont déjà un voisin à moins de 30 m,
   * le seuil ne coupe donc pas l'adjacence normale.
   */
  maxBlocGapMeters: number;
}

/**
 * Valeurs telles que le back les sérialise (`JsonStringEnumConverter`) — à ne pas franciser :
 * ce sont des codes, on les teste tels quels et on traduit à l'affichage.
 *
 * `UnnamedStreet` — la close nommera mal, le renommage est à portée de clic.
 * `LargeClose` — beaucoup de blocs ; relecture difficile, mais la close reste créable.
 * `ExceedsAddressCap` — **plus de 99 parcelles**. Pas un conseil mais un dépassement de la règle
 *   métier du 2026-09-04, et il n'est PAS corrigeable depuis l'écran : l'index unique
 *   (quartier, rue) interdit de scinder une rue en plusieurs closes. 56 des 531 closes proposées
 *   sont dans ce cas, pour 12 808 parcelles.
 * `SingleBloc` — close à un seul bloc, souvent un artefact de proximité.
 */
export type ProposedCloseWarning =
  | 'UnnamedStreet'
  | 'LargeClose'
  | 'ExceedsAddressCap'
  | 'SingleBloc';

/** Idem : codes du back, jamais des phrases. */
export type UnassignedBlocReason =
  | 'NoStreetNearby'
  | 'BlocWithoutGeometry'
  | 'BlocAlreadyAttached'
  | 'StreetAlreadyHasClose'
  /**
   * Le bloc borde la bonne rue mais est DÉTACHÉ du groupe : plus de `maxBlocGapMeters` le
   * séparent du bloc le plus proche de la close. Les blocs d'une close doivent se toucher — une
   * close est une portion de rue, pas la rue entière. Il formerait une seconde close sur la même
   * rue, ce que l'index unique (quartier, rue) interdit.
   */
  | 'NotContiguous';

export interface ProposedCloseBloc {
  id: UUID;
  code: string;
  name: string | null;
  number: number | null;
  /** Distance à la rue retenue. Sert à repérer les rattachements douteux dans la liste. */
  distanceMeters: number;
  adresseCount: number;
}

export interface ProposedClose {
  /** Identifiant de la PROPOSITION (pas d'une close : elle n'existe pas encore). Corrèle aperçu → numérotation → application. */
  key: string;
  streetId: UUID;
  streetCode: string;
  streetName: string | null;
  streetType: string;
  /** Proposés par le back, qui reprend la numérotation existante du quartier. Modifiables. */
  number: number;
  code: string;
  blocs: ProposedCloseBloc[];
  /**
   * Compteur SEUL — le détail des adresses n'est pas ici. Une close porte 45 adresses en moyenne
   * et jusqu'à 863, chacune avec sa position et sa géométrie : un aperçu de quartier qui
   * embarquerait tous les plans pèserait plusieurs mégaoctets, pour un écran où l'on n'ouvre
   * qu'une close à la fois. Le plan détaillé se charge à l'ouverture, cf. `previewProposalNumbering`.
   */
  adresseCount: number;
  /** Vrai pour 345 closes sur 531 : le rattachement sera refusé sans `numbering`. */
  hasNumeroCollision: boolean;
  /** Union des blocs, pour l'aperçu carte. GeoJSON/WKT venu de l'API, pas une tuile Martin. */
  boundaryWkt: string | null;
  warnings: ProposedCloseWarning[];
}

export interface UnassignedBloc {
  blocId: UUID;
  blocCode: string;
  reason: UnassignedBlocReason;
  /** Renseignés sur `AucuneRueAProximite` : la rue existe, elle est juste trop loin. */
  nearestStreetId: UUID | null;
  distanceMeters: number | null;
  boundaryWkt: string | null;
}

export interface QuartierClosePlanSummary {
  blocsTotal: number;
  blocsAssigned: number;
  blocsUnassigned: number;
  closesProposed: number;
  /** Adresses qui seront renumérotées si le plan est appliqué tel quel. */
  adressesImpacted: number;
}

/** Ce que renvoie `POST /api/quartiers/{id}/closes/preview`. N'écrit rien. */
export interface QuartierClosePlan {
  quartierId: UUID;
  quartierNom: string;
  quartierCode: string;
  /** Paramètres EFFECTIVEMENT appliqués — le back peut avoir borné ce qu'on lui a envoyé. */
  parameters: QuartierClosePlanParameters;
  summary: QuartierClosePlanSummary;
  proposed: ProposedClose[];
  unassignedBlocs: UnassignedBloc[];
}

/**
 * Une close telle que l'opérateur l'a relue. Pas de `key` : le back ne référence aucune
 * proposition, il prend la close DÉCRITE. Entre l'aperçu et la confirmation, la rue a pu changer
 * et des blocs bouger — recalculer depuis une clé écrirait autre chose que ce qui a été validé.
 */
export interface ReviewedClose {
  streetId: UUID;
  number: number;
  code: string;
  blocIds: UUID[];
  /**
   * OBLIGATOIRE dès que `hasNumeroCollision` : le plan COMPLET de la close, pas seulement les
   * adresses dont le numéro change. Le back revérifie la couverture et l'unicité, et refuse un
   * plan partiel plutôt que de le compléter tout seul.
   */
  numbering: AdresseNumbering[] | null;
}

export interface ApplyQuartierClosesPayload {
  closes: ReviewedClose[];
}

/** Ce qui a réellement été écrit, à afficher tel quel — on ne rejoue pas le compte côté front. */
export interface AppliedQuartierCloses {
  closesCreated: number;
  blocsAttached: number;
  adressesRenumbered: number;
  closes: Close[];
}
