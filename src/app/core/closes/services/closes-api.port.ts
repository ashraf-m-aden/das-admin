import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { Close, CloseListQuery, CloseStreetOption, CreateClosePayload, UpdateClosePayload } from '../models/closes.models';

export abstract class ClosesApiPort {
  abstract list(query: CloseListQuery): Observable<Close[]>;
  /** `GET /api/streets` — une close exige une rue, c'est elle qui nomme l'adresse. */
  abstract listStreets(): Observable<CloseStreetOption[]>;
  abstract getById(id: UUID): Observable<Close>;
  abstract create(payload: CreateClosePayload): Observable<Close>;
  abstract update(id: UUID, payload: UpdateClosePayload): Observable<Close>;
  abstract remove(id: UUID): Observable<void>;
  /** `POST /api/closes/{id}/blocs` — idempotent, un ou plusieurs blocs à la fois. */
  abstract attachBlocs(id: UUID, blocIds: UUID[]): Observable<Close>;
  /** `DELETE /api/closes/{id}/blocs/{blocId}` — un bloc à la fois. */
  abstract detachBloc(id: UUID, blocId: UUID): Observable<Close>;
}
