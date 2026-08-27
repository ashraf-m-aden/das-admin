import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ClosesApiPort } from './closes-api.port';
import { UUID } from '../../models/das.models';
import {
  AdresseNumbering, Close, CloseBloc, CloseListQuery, CloseNumberingPlan, CloseStreetOption,
  CreateClosePayload, PlannedAdresse, UpdateClosePayload,
} from '../models/closes.models';

const LATENCY_MS = 320;
/** Mêmes ids que `MockBlocksApiService`/`HierarchyMockService`, pour que les mocks se parlent. */
const QUARTIER_7 = 'deadd2cc-fefc-403b-af2a-b7fcb9b6769f';
const QUARTIER_NOM = 'Quartier 7';
const QUARTIER_CODE = 'Q7';

interface MockClose {
  id: string; quartierId: string; streetId: string; streetCode: string; streetName: string | null;
  number: number; code: string; blocIds: string[];
}

/** Ordre stable, utilisé pour espacer les parcelles mock le long de l'axe. */
const MOCK_BLOC_ORDER = ['bloc-0001', 'bloc-0002', 'bloc-0003'];

const MOCK_BLOCS: Record<string, CloseBloc> = {
  'bloc-0001': { id: 'bloc-0001', code: 'Q7-B01', name: 'Avenue Nasser', number: 1 },
  'bloc-0002': { id: 'bloc-0002', code: 'Q7-B02', name: null, number: 2 },
  'bloc-0003': { id: 'bloc-0003', code: 'Q7-B03', name: null, number: null },
};

function label(c: MockClose): string {
  return c.streetName ?? String(c.number) ?? c.code;
}

/**
 * Erreur métier à la forme du mock : `{ code, message }` renvoyé **nu**, sans enveloppe `.error`
 * — c'est ce que produit `throwError`, contrairement à une `HttpErrorResponse`. Les deux formes
 * sont lues par `core/http/error-code.ts`.
 */
const fail = (code: string, message: string): Observable<never> => throwError(() => ({ code, message }));

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
    if (!c) return fail('Closes.NotFound', 'Close introuvable.');
    return of(this.toClose(c)).pipe(delay(LATENCY_MS));
  }

  override create(payload: CreateClosePayload): Observable<Close> {
    const conflict = this.placementConflict(payload.quartierId, payload, null);
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
    if (!existing) return fail('Closes.NotFound', 'Close introuvable.');
    const conflict = this.placementConflict(existing.quartierId, payload, id);
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

  /** Le back refuse (409) tant que des blocs y sont rattachés — `DeleteCloseHandler`. */
  override remove(id: UUID): Observable<void> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return fail('Closes.NotFound', 'Close introuvable.');
    if (close.blocIds.length > 0) {
      return fail('Closes.HasBlocs', 'Des blocs sont encore rattachés à cette close.').pipe(delay(LATENCY_MS));
    }
    this.closes = this.closes.filter((c) => c.id !== id);
    return of(void 0).pipe(delay(LATENCY_MS));
  }

  /**
   * Reproduit les gardes réelles d'`AttachBlocsHandler`, dans son ordre.
   *
   * Un bloc déjà rattaché **ailleurs** n'est PAS un refus : c'est un déplacement, que le back
   * accepte (il ne le bloque que sur un code d'adresse figé, cas absent du mock puisque rien
   * n'y est figé). Ce qu'il refuse, et qui est la règle plus que l'exception aujourd'hui, c'est
   * de faire cohabiter deux blocs sous une même close : chacun numérotant ses parcelles à partir
   * de 1, leurs numéros de maison collident. C'est ce refus-là qu'un opérateur rencontrera, donc
   * c'est celui qu'il faut pouvoir tester sans back.
   */
  /**
   * Chaque bloc mock numérote ses parcelles à partir de 1 — comme en base réelle. C'est ce qui
   * rend la collision reproductible en mock, sans quoi le parcours preview → validation →
   * application ne serait jamais exerçable hors backend.
   */
  private parcelsOf(blocId: string): Array<{ adresseId: string; numero: number; lng: number; lat: number }> {
    const seed = MOCK_BLOC_ORDER.indexOf(blocId);
    return Array.from({ length: 4 }, (_, i) => ({
      adresseId: `${blocId}-adr-${i + 1}`,
      numero: i + 1,
      lng: 43.140 + seed * 0.006 + i * 0.0012,
      lat: 11.586 + seed * 0.0008,
    }));
  }

  override previewAttachBlocs(id: UUID, blocIds: UUID[], reverse: boolean): Observable<CloseNumberingPlan> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));

    const resulting = [...new Set([...close.blocIds, ...blocIds])];
    const rows = resulting.flatMap((b) =>
      this.parcelsOf(b).map((p) => ({ ...p, blocId: b, entering: !close.blocIds.includes(b) })));

    // Tri le long d'un axe est-ouest — approximation du régime ParcelCloud du back.
    rows.sort((a, b) => (reverse ? b.lng - a.lng : a.lng - b.lng));
    const first = rows[0];

    const adresses: PlannedAdresse[] = rows.map((r, i) => ({
      adresseId: r.adresseId,
      blocId: r.blocId,
      blocCode: MOCK_BLOCS[r.blocId]?.code ?? r.blocId,
      entering: r.entering,
      currentNumero: r.numero,
      proposedNumero: i + 1,
      distanceMeters: first ? Math.round(Math.abs(r.lng - first.lng) * 111_320) : 0,
      side: i % 2 === 0 ? 'Left' : 'Right',
      addressCode: null,
      locationWkt: `POINT(${r.lng} ${r.lat})`,
      boundaryWkt: `MULTIPOLYGON(((${r.lng} ${r.lat}, ${r.lng + 0.0008} ${r.lat}, ${r.lng + 0.0008} ${r.lat + 0.0006}, ${r.lng} ${r.lat + 0.0006}, ${r.lng} ${r.lat})))`,
    }));

    return of({
      closeId: close.id,
      closeCode: close.code,
      orderingSource: 'ParcelCloud' as const,
      reverse,
      parcelCount: adresses.length,
      changedCount: adresses.filter((a) => a.currentNumero !== a.proposedNumero).length,
      adresses,
    }).pipe(delay(LATENCY_MS));
  }

  override attachBlocs(id: UUID, blocIds: UUID[], numbering?: AdresseNumbering[]): Observable<Close> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return throwError(() => ({ code: 'Closes.NotFound', message: 'Close introuvable.' }));

    const takenElsewhere = blocIds.find((b) => this.closes.some((c) => c.id !== id && c.blocIds.includes(b)));
    if (takenElsewhere) {
      return throwError(() => ({ code: 'Closes.BlocAlreadyAssigned', message: 'Un des blocs appartient déjà à une autre close.' })).pipe(delay(LATENCY_MS));
    }

    // LA garde qui compte : sans plan, réunir deux blocs fait collider leurs numéros — chaque
    // bloc partant de 1. Le back refuse pour la même raison, et c'est ce refus qui envoie
    // l'opérateur vers l'aperçu.
    const resulting = [...new Set([...close.blocIds, ...blocIds])];
    if (!numbering?.length && resulting.length > 1) {
      return throwError(() => ({
        code: 'Closes.DuplicateAdresseNumero',
        message: 'Deux parcelles porteraient le même numéro dans cette close.',
      })).pipe(delay(LATENCY_MS));
    }

    if (numbering?.length) {
      const nums = numbering.map((n) => n.numero);
      if (new Set(nums).size !== nums.length) {
        return throwError(() => ({ code: 'Closes.NumberingDuplicate', message: 'Deux parcelles portent le même numéro dans le plan.' })).pipe(delay(LATENCY_MS));
      }
      const expected = resulting.flatMap((b) => this.parcelsOf(b).map((p) => p.adresseId));
      if (numbering.length !== expected.length) {
        return throwError(() => ({ code: 'Closes.NumberingIncomplete', message: 'Le plan ne couvre pas toutes les parcelles de la close.' })).pipe(delay(LATENCY_MS));
      }
    }

    close.blocIds = resulting;
    return of(this.toClose(close)).pipe(delay(LATENCY_MS));
  }

  override detachBloc(id: UUID, blocId: UUID): Observable<Close> {
    const close = this.closes.find((c) => c.id === id);
    if (!close) return fail('Closes.NotFound', 'Close introuvable.');
    if (!close.blocIds.includes(blocId)) {
      return fail('Closes.BlocNotAttached', "Ce bloc n'est pas rattaché à cette close.").pipe(delay(LATENCY_MS));
    }
    const updated: MockClose = { ...close, blocIds: close.blocIds.filter((b) => b !== blocId) };
    this.closes = this.closes.map((c) => (c.id === id ? updated : c));
    return of(this.toClose(updated)).pipe(delay(LATENCY_MS));
  }

  /**
   * Les trois unicités « dans le quartier » de `ClosePlacement` : la rue, le numéro (3ᵉ segment
   * du code d'adresse) et le code. Testées dans le même ordre que le back, pour que le message
   * affiché soit le même qu'en réel quand deux conflits coexistent.
   */
  private placementConflict(
    quartierId: string,
    payload: { streetId: string; number: number; code: string },
    selfId: UUID | null,
  ): Observable<never> | null {
    const siblings = this.closes.filter((c) => c.quartierId === quartierId && c.id !== selfId);
    if (siblings.some((c) => c.streetId === payload.streetId)) {
      return fail('Closes.StreetAlreadyUsed', 'Cette rue a déjà une close dans ce quartier.');
    }
    if (siblings.some((c) => c.number === payload.number)) {
      return fail('Closes.NumberAlreadyUsed', 'Une close porte déjà ce numéro dans ce quartier.');
    }
    if (siblings.some((c) => c.code === payload.code)) {
      return fail('Closes.CodeAlreadyExists', 'Une close porte déjà ce code dans ce quartier.');
    }
    return null;
  }
}
