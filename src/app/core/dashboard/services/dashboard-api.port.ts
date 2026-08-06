import { Observable } from 'rxjs';
import { DashboardSummary } from '../models/dashboard.models';

/**
 * Contrat du domaine Dashboard — même principe que AuthApiPort : store,
 * effects et composant ne dépendent que de ce token, jamais des implémentations.
 */
export abstract class DashboardApiPort {
  abstract getSummary(): Observable<DashboardSummary>;
}
