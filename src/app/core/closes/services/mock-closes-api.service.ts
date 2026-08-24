import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ClosesApiPort } from './closes-api.port';
import { UUID } from '../../models/das.models';
import { Close, CloseBloc, CloseListQuery, CloseStreetOption, CreateClosePayload, UpdateClosePayload } from '../models/closes.models';

const LATENCY_MS = 320;
/** Mêmes ids que `MockBlocksApiService`/`HierarchyMockService`, pour que les mocks se parlent. */
const QUARTIER_7 = 'deadd2cc-fefc-403b-af2a-b7fcb9b6769f';
const QUARTIER_NOM = 'Quartier 7';
const QUARTIER_CODE = 'Q7';

interface MockClose {
  id: string; quartierId: string; streetId: string; streetCode: string; streetName: string | null;
  number: number; code: string; blocIds: string[];
}

const MOCK_BLOCS: Record<string, CloseBloc> = {
  'bloc-0001': { id: 'bloc-0001', code: 'Q7-B01', name: 'Avenue Nasser', number: 1 },
  'bloc-0002': { id: 'bloc-0002', code: 'Q7-B02', name: null, number: 2 },
  'bloc-0003': { id: 'bloc-0003', code: 'Q7-B03', name: null, number: null },
};

function label(c: MockClose): string {
  return c.streetName ?? String(c.number) ?? c.code;
}

@Injectable({ providedIn: 'root' })
export class MockClosesApiService extends ClosesApiPort {
  private closes: MockClose[] = [
    { id: 'close-0001', quartierId: QUARTIER_7, streetId: 'street-0003', streetCode: 'STR-0003', streetName: 'Impasse du Puits', number: 1, code: 'CL-01', blocIds: ['bloc-0001'] },
    { id: 'close-0002', quartierId: QUARTIER_7, streetId: 'street-0001', streetCode: 'STR-0001', streetName: null, number: 2, code: 'CL-02', blocIds: [] },
  ];

  private nextId = 3;

  private toClose(c: MockClose): Close {
    return {
      id: c.id, quartierId: c.quartierId, quartierNom: QUARTIER_NOM, quartierCode: QUARTIER_CODE,
      streetId: c.streetId, streetCode: c.streetCode, streetName: c.streetName,
      number: c.number, code: c.code, label: label(c),
      blocs: c.blocIds.map((id) => MOCK_BLOCS[id]).filter((b): b is CloseBloc => !!b),
      adresseCount: 0, boundaryWkt: null,
    };
  }

  /** Mêmes ids que `MockAddressingApiService.streets`. */
  private streets: CloseStreetOption[] = [
    { id: 'street-0001', code: 'STR-0001', name: null },
    { id: 'street-0002', code: 'STR-0002', name: null },
    { id: 'street-0003', code: 'STR-0003', name: 'Impasse du Puits' },
  ];

  override listStreets(): Observable<CloseStreetOption[]> {
    return of(this.streets).pipe(delay(LATENCY_MS));
  }

  override list(query: CloseListQuery): Observable<Close[]> {
    const items = this.closes
      .filter((c) => !query.quartierId || c.quartierId === query.quartierId)
      .filter((c) => !query.streetId || c.streetId === query.streetId);
    return of(items.map((c) => this.toClose(c))).pipe(delay(LATENCY_MS));
  }

  override getById(id: UUID): Observable<Close> {
    const c = this.closes.find((x) => x.id === id);
    if (!c) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));
    return of(this.toClose(c)).pipe(delay(LATENCY_MS));
  }

  override create(payload: CreateClosePayload): Observable<Close> {
    const conflict = this.numberConflict(payload.quartierId, payload.number, null);
    if (conflict) return conflict;
    const created: MockClose = {
      id: `close-${String(this.nextId++).padStart(4, '0')}`,
      quartierId: payload.quartierId, streetId: payload.streetId,
      streetCode: this.streets.find((r) => r.id === payload.streetId)?.code ?? 'STR-????',
      streetName: this.streets.find((r) => r.id === payload.streetId)?.name ?? null,
      number: payload.number, code: payload.code, blocIds: [],
    };
    this.closes = [...this.closes, created];
    return of(this.toClose(created)).pipe(delay(LATENCY_MS));
  }

  override update(id: UUID, payload: UpdateClosePayload): Observable<Close> {
    const existing = this.closes.find((c) => c.id === id);
    if (!existing) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));
    const conflict = this.numberConflict(existing.quartierId, payload.number, id);
    if (conflict) return conflict;
    const street = this.streets.find((r) => r.id === payload.streetId);
    const updated: MockClose = {
      ...existing, streetId: payload.streetId,
      streetCode: street?.code ?? existing.streetCode, streetName: street?.name ?? null,
      number: payload.number, code: payload.code,
    };
    this.closes = this.closes.map((c) => (c.id === id ? updated : c));
    return of(this.toClose(updated)).pipe(delay(LATENCY_MS));
  }

  override remove(id: UUID): Observable<void> {
    this.closes = this.closes.filter((c) => c.id !== id);
    return of(void 0).pipe(delay(LATENCY_MS));
  }

  override attachBlocs(id: UUID, blocIds: UUID[]): Observable<Close> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));

    const takenElsewhere = blocIds.find((b) => this.closes.some((c) => c.id !== id && c.blocIds.includes(b)));
    if (takenElsewhere) {
      return throwError(() => ({ code: 'Closes.BlocAlreadyAssigned', message: 'Un des blocs appartient déjà à une autre close.' })).pipe(delay(LATENCY_MS));
    }

    close.blocIds = [...new Set([...close.blocIds, ...blocIds])];
    return of(this.toClose(close)).pipe(delay(LATENCY_MS));
  }

  override detachBloc(id: UUID, blocId: UUID): Observable<Close> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));
    close.blocIds = close.blocIds.filter((b) => b !== blocId);
    return of(this.toClose(close)).pipe(delay(LATENCY_MS));
  }

  /** `(QuartierId, Number)` unique — le numéro forme le 3ᵉ segment du code d'adresse. */
  private numberConflict(quartierId: string, number: number, selfId: UUID | null): Observable<never> | null {
    const dup = this.closes.some((c) => c.quartierId === quartierId && c.number === number && c.id !== selfId);
    return dup
      ? throwError(() => ({ code: 'Closes.NumberAlreadyUsed', message: 'Une close porte déjà ce numéro dans ce quartier.' }))
      : null;
  }
}
