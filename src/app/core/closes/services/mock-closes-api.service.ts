import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ClosesApiPort } from './closes-api.port';
import { UUID } from '../../models/das.models';
import { Close, CloseListQuery, SaveClosePayload } from '../models/closes.models';

const LATENCY_MS = 320;
/** Même quartier que `MockBlocksApiService`, pour que les deux mocks parlent des mêmes blocs. */
const QUARTIER_7 = 'deadd2cc-fefc-403b-af2a-b7fcb9b6769f';

@Injectable({ providedIn: 'root' })
export class MockClosesApiService extends ClosesApiPort {
  private closes: Close[] = [
    { id: 'close-0001', name: 'Cité du Corail', number: 1, quartierId: QUARTIER_7, blocIds: ['bloc-0001', 'bloc-0002'] },
    { id: 'close-0002', name: 'Lotissement Nord', number: 2, quartierId: QUARTIER_7, blocIds: ['bloc-0003'] },
  ];

  private nextId = 3;

  override list(query: CloseListQuery): Observable<Close[]> {
    const search = query.search.trim().toLowerCase();
    const items = this.closes.filter((c) => {
      if (query.quartierId && c.quartierId !== query.quartierId) return false;
      if (search && !c.name.toLowerCase().includes(search) && String(c.number) !== search) return false;
      return true;
    });
    return of(items).pipe(delay(LATENCY_MS));
  }

  override getById(id: UUID): Observable<Close> {
    const c = this.closes.find((x) => x.id === id);
    if (!c) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));
    return of(c).pipe(delay(LATENCY_MS));
  }

  override create(payload: SaveClosePayload): Observable<Close> {
    const conflict = this.numberConflict(payload, null);
    if (conflict) return conflict;
    const taken = this.blocsAlreadyTaken(payload.blocIds, null);
    if (taken) return taken;

    const created: Close = { id: `close-${String(this.nextId++).padStart(4, '0')}`, ...payload };
    this.closes = [...this.closes, created];
    return of(created).pipe(delay(LATENCY_MS));
  }

  override update(id: UUID, payload: SaveClosePayload): Observable<Close> {
    if (!this.closes.some((c) => c.id === id)) {
      return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));
    }
    const conflict = this.numberConflict(payload, id);
    if (conflict) return conflict;
    const taken = this.blocsAlreadyTaken(payload.blocIds, id);
    if (taken) return taken;

    const updated: Close = { id, ...payload };
    this.closes = this.closes.map((c) => (c.id === id ? updated : c));
    return of(updated).pipe(delay(LATENCY_MS));
  }

  override remove(id: UUID): Observable<void> {
    this.closes = this.closes.filter((c) => c.id !== id);
    return of(void 0).pipe(delay(LATENCY_MS));
  }

  /** `(QuartierId, Number)` unique — le numéro entre dans le code d'adresse (cf. adressage.md §2.3). */
  private numberConflict(payload: SaveClosePayload, selfId: UUID | null): Observable<never> | null {
    const dup = this.closes.some((c) => c.quartierId === payload.quartierId && c.number === payload.number && c.id !== selfId);
    return dup
      ? throwError(() => ({ code: 'Closes.NumberAlreadyUsed', message: 'Une close porte déjà ce numéro dans ce quartier.' }))
      : null;
  }

  /** Un bloc n'appartient qu'à UNE close — le mock doit refuser le vol de bloc, sinon la règle ne se teste jamais. */
  private blocsAlreadyTaken(blocIds: UUID[], selfId: UUID | null): Observable<never> | null {
    const taken = this.closes.some((c) => c.id !== selfId && c.blocIds.some((b) => blocIds.includes(b)));
    return taken
      ? throwError(() => ({ code: 'Closes.BlocAlreadyAssigned', message: 'Un des blocs appartient déjà à une autre close.' }))
      : null;
  }
}
