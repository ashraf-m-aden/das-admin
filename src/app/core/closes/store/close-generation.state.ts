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

export const initialCloseGenerationState: CloseGenerationState = {
  progress: [],
  progressStatus: 'idle',
  quartierId: null,
  parameters: {},
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
