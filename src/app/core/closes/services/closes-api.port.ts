import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import {
  AdresseNumbering, Close, CloseListQuery, CloseNumberingPlan, CloseStreetOption,
  CreateClosePayload, UpdateClosePayload,
} from '../models/closes.models';

export abstract class ClosesApiPort {
  abstract list(query: CloseListQuery): Observable<Close[]>;
  /** `GET /api/streets` — une close exige une rue, c'est elle qui nomme l'adresse. */
  abstract listStreets(): Observable<CloseStreetOption[]>;

  /**
   * `PATCH /api/streets/{id}` — nomme une rue sans quitter l'écran des closes.
   * Prend l'option complète et non le seul id : le PATCH est un REMPLACEMENT, il faut renvoyer
   * `code` et `type` inchangés sous peine de les écraser.
   */
  abstract renameStreet(street: CloseStreetOption, name: string): Observable<CloseStreetOption>;
  abstract getById(id: UUID): Observable<Close>;
  abstract create(payload: CreateClosePayload): Observable<Close>;
  abstract update(id: UUID, payload: UpdateClosePayload): Observable<Close>;
  abstract remove(id: UUID): Observable<void>;
  /**
   * `POST /api/closes/{id}/blocs/preview` — **n'écrit rien**. Propose un numéro par parcelle de la
   * close résultante, avec sa position et sa géométrie, pour validation sur carte.
   * `blocIds` peut être vide : on obtient alors une proposition pour la close telle qu'elle est.
   */
  abstract previewAttachBlocs(id: UUID, blocIds: UUID[], reverse: boolean): Observable<CloseNumberingPlan>;

  /**
   * `POST /api/closes/{id}/blocs`. Sans `numbering`, refusé (409 `Closes.DuplicateAdresseNumero`)
   * dès que la réunion des blocs produirait des numéros en double — ce qui est le cas courant.
   * Avec `numbering`, rattachement et renumérotation se font dans la MÊME transaction.
   */
  abstract attachBlocs(id: UUID, blocIds: UUID[], numbering?: AdresseNumbering[]): Observable<Close>;
  /** `DELETE /api/closes/{id}/blocs/{blocId}` — un bloc à la fois. */
  abstract detachBloc(id: UUID, blocId: UUID): Observable<Close>;
}
