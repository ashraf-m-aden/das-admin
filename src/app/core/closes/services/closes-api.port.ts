import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { Close, CloseListQuery, SaveClosePayload } from '../models/closes.models';

/**
 * Aucune route `/api/closes` n'existe côté back à ce jour — le module est déclaré `mock` dans
 * `backend-readiness.ts` et le port ne sert pour l'instant qu'au mock. Il est écrit d'avance
 * pour que la bascule ne demande qu'un service HTTP et une ligne de registre.
 */
export abstract class ClosesApiPort {
  abstract list(query: CloseListQuery): Observable<Close[]>;
  abstract getById(id: UUID): Observable<Close>;
  abstract create(payload: SaveClosePayload): Observable<Close>;
  abstract update(id: UUID, payload: SaveClosePayload): Observable<Close>;
  abstract remove(id: UUID): Observable<void>;
}
