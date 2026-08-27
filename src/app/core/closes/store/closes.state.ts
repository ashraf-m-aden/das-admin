import { UUID } from '../../models/das.models';
import { Block } from '../../models/das.models';
import { Close, CloseNumberingPlan, CloseStreetOption } from '../models/closes.models';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ClosesState {
  closes: Close[];
  /** Blocs candidats du quartier courant — source du sélecteur et du coloriage carte. */
  blocs: Block[];
  /** Référentiel plat, chargé une fois — une close exige une rue. */
  streets: CloseStreetOption[];
  quartierId: UUID | null;
  listStatus: LoadStatus;
  /**
   * Plan de numérotation en cours de validation. `null` hors de ce parcours.
   * Il vit dans le store et non dans l'écran parce qu'il est le résultat d'un appel serveur
   * qu'on ne veut pas refaire à chaque re-rendu — et parce que c'est LUI qu'on renvoie.
   */
  plan: CloseNumberingPlan | null;
  /** Corrections manuelles de l'opérateur : `adresseId → numéro`. Se superpose au plan proposé. */
  planEdits: Record<UUID, number>;
  /** Blocs que le plan couvre, mémorisés pour l'application — le plan seul ne les porte pas. */
  planBlocIds: UUID[];
  isPreviewing: boolean;
  isSaving: boolean;
  /** Erreur d'écriture, mappée depuis le `code` métier (jamais depuis `message`). */
  saveErrorMessageKey: string | null;
  /**
   * Incrémenté à chaque écriture RÉUSSIE. L'écran s'en sert pour refermer son formulaire
   * seulement quand la sauvegarde a abouti — sur un 409 il reste ouvert avec la saisie intacte.
   */
  saveTick: number;
}

export const initialClosesState: ClosesState = {
  closes: [],
  blocs: [],
  streets: [],
  quartierId: null,
  listStatus: 'idle',
  plan: null,
  planEdits: {},
  planBlocIds: [],
  isPreviewing: false,
  isSaving: false,
  saveErrorMessageKey: null,
  saveTick: 0,
};
