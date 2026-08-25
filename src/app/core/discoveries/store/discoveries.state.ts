import { UUID } from '../../models/das.models';
import { DiscoveryReport, DiscoveryStatus } from '../models/discoveries.models';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface DiscoveriesState {
  reports: DiscoveryReport[];
  /** `{ id, label }` seulement : l'écran n'a besoin que de peupler un select. */
  campaigns: { id: UUID; label: string }[];
  campaignId: UUID | null;
  /**
   * `Pending` par défaut, et c'est le point de l'écran : c'est la file de tri du Gestionnaire.
   * Ouvrir sur « tous » noierait les 3 signalements à traiter dans l'historique des traités.
   */
  status: DiscoveryStatus | null;
  selectedId: UUID | null;
  listStatus: LoadStatus;
  isReviewing: boolean;
  isExporting: boolean;
  /** Erreur d'écriture ou de chargement, mappée depuis le `code` métier (jamais depuis `message`). */
  errorMessageKey: string | null;
  /** Incrémenté à chaque décision RÉUSSIE — l'écran s'en sert pour refermer le formulaire de motif. */
  reviewTick: number;
}

export const initialDiscoveriesState: DiscoveriesState = {
  reports: [],
  campaigns: [],
  campaignId: null,
  status: 'Pending',
  selectedId: null,
  listStatus: 'idle',
  isReviewing: false,
  isExporting: false,
  errorMessageKey: null,
  reviewTick: 0,
};
