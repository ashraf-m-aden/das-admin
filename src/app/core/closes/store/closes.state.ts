import { UUID } from '../../models/das.models';
import { Block } from '../../models/das.models';
import { Close } from '../models/closes.models';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ClosesState {
  closes: Close[];
  /** Blocs candidats du quartier courant — source du sélecteur et du coloriage carte. */
  blocs: Block[];
  quartierId: UUID | null;
  listStatus: LoadStatus;
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
  quartierId: null,
  listStatus: 'idle',
  isSaving: false,
  saveErrorMessageKey: null,
  saveTick: 0,
};
