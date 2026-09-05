import { UUID } from '../../models/das.models';
import {
  CloseNumberingPlan, CloseStreetOption, ProposedClose, QuartierClosePlan,
  QuartierClosePlanParameters, QuartierCloseProgress,
} from '../models/closes.models';
import { LoadStatus } from './closes.state';

/**
 * Modification apportée par l'opérateur à UNE proposition. Ne remplace pas la proposition : se
 * superpose à elle, pour qu'un nouvel aperçu ne fasse pas perdre le travail de relecture… et pour
 * qu'on puisse toujours montrer l'écart entre ce que la machine proposait et ce qu'on garde.
 */
export interface ProposedCloseEdit {
  streetId?: UUID;
  number?: number;
  code?: string;
  /** Liste complète après retrait/ajout, jamais un delta : plus simple à relire, plus dur à casser. */
  blocIds?: UUID[];
}

export interface CloseGenerationState {
  /** Liste d'entrée : où en est chaque quartier. Chargée une fois. */
  progress: QuartierCloseProgress[];
  progressStatus: LoadStatus;

  quartierId: UUID | null;

  /** Réglages DEMANDÉS. Ceux réellement appliqués sont dans `plan.parameters`, et peuvent différer. */
  parameters: Partial<QuartierClosePlanParameters>;

  plan: QuartierClosePlan | null;
  isPreviewing: boolean;

  /** Corrections par clé de proposition. */
  edits: Record<string, ProposedCloseEdit>;
  /** Propositions écartées : on ne les créera pas. Distinct d'une proposition vidée de ses blocs. */
  discardedKeys: string[];

  /** Référentiel plat des rues, pour le changement de rue et le renommage en ligne. */
  streets: CloseStreetOption[];

  /* -- Plan de numérotation de la proposition ouverte -------------------------------------- */

  /** Clé de la proposition dont on regarde le plan. `null` = aucun plan ouvert. */
  numberingKey: string | null;
  numbering: CloseNumberingPlan | null;
  /** Corrections manuelles de numéros : `adresseId → numéro`. */
  numberingEdits: Record<UUID, number>;
  numberingReverse: boolean;
  isNumbering: boolean;

  /**
   * Propositions dont le plan de numérotation a été OUVERT et relu.
   *
   * 345 closes sur 531 réunissent des parcelles aux numéros en double : les confirmer sans avoir
   * regardé leur plan reviendrait à écrire des numéros que personne n'a vus, alors qu'ils finiront
   * figés dans un code d'adresse. C'est cette liste qui conditionnera la confirmation.
   */
  reviewedKeys: string[];

  /** Erreur métier, mappée depuis le `code` (jamais depuis le `message`). */
  errorMessageKey: string | null;
}

/**
 * Réglages envoyés par défaut. **Explicites, et non `{}`.**
 *
 * L'écran ne postait que `maxDistanceMeters` : le back appliquait ses propres valeurs pour le
 * reste, sans que rien à l'écran ne dise lesquelles. C'est la même leçon que `validationType`
 * sur les relevés — un champ absent laisse le serveur choisir, et le choix ne se voit pas.
 *
 * `excludeStreetCodePrefixes` est le correctif des propositions « dispersées » constatées sur
 * Quartier 7 le 2026-09-05 : `SIG-RT*` sont les routes nationales et `SIG-PI*` les pistes de
 * désert versées le 2026-09-04. Sans exclusion, **693 blocs sur 5 121** s'y rattachaient, et une
 * piste traversant un quartier ramassait des blocs sur des kilomètres. Mesuré : les groupes
 * s'étalant sur plus d'un kilomètre passent de 18 à 8, le pire cas de 2 345 m à 1 803 m.
 */
export const PARAMETRES_PAR_DEFAUT: Partial<QuartierClosePlanParameters> = {
  maxDistanceMeters: 50,
  maxBlocGapMeters: 100,
  excludeStreetCodePrefixes: ['SIG-RT1-', 'SIG-RT2-', 'SIG-PI1-', 'SIG-PI2-'],
};

export const initialCloseGenerationState: CloseGenerationState = {
  progress: [],
  progressStatus: 'idle',
  quartierId: null,
  parameters: PARAMETRES_PAR_DEFAUT,
  plan: null,
  isPreviewing: false,
  edits: {},
  discardedKeys: [],
  streets: [],
  numberingKey: null,
  numbering: null,
  numberingEdits: {},
  numberingReverse: false,
  isNumbering: false,
  reviewedKeys: [],
  errorMessageKey: null,
};

/** La proposition telle qu'elle est APRÈS relecture — c'est elle qu'on affiche et qu'on enverra. */
export function applyEdit(proposal: ProposedClose, edit: ProposedCloseEdit | undefined): ProposedClose {
  if (!edit) return proposal;
  const blocs = edit.blocIds
    ? proposal.blocs.filter((b) => edit.blocIds!.includes(b.id))
    : proposal.blocs;
  return {
    ...proposal,
    streetId: edit.streetId ?? proposal.streetId,
    number: edit.number ?? proposal.number,
    code: edit.code ?? proposal.code,
    blocs,
    // Recalculés localement : le back ne les recalcule qu'au prochain aperçu, et l'écran doit
    // refléter le retrait d'un bloc tout de suite.
    adresseCount: blocs.reduce((n, b) => n + b.adresseCount, 0),
  };
}
