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
