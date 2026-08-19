import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AddressingApiPort } from './addressing-api.port';
import { UUID, UpdateBlockPayload } from '../../models/das.models';
import {
  AssignHouseNumberPayload,
  BlockNamingQuery,
  BlockToName,
  PendingBlockSuggestion,
  PendingStreetSuggestion,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
  UpdateStreetNamePayload,
} from '../models/addressing.models';

@Injectable({ providedIn: 'root' })
export class MockAddressingApiService extends AddressingApiPort {
  private static readonly SIMULATED_LATENCY_MS = 400;

  private blocks: BlockToName[] = [
    { id: 'block-0001', code: 'BLK-Q7-021', name: null, number: 21, boundaryWkt: null },
    { id: 'block-0002', code: 'BLK-Q3-014', name: null, number: 14, boundaryWkt: null },
    { id: 'block-0003', code: 'BLK-RD-002', name: null, number: null, boundaryWkt: null },
    { id: 'block-0004', code: 'BLK-EIN-007', name: 'Rue des Palmiers', number: 7, boundaryWkt: null },
  ];

  /** Suggestions en attente — source distincte, comme côté réel (`GET /api/blocs/suggestions?status=Pending`). */
  private blockSuggestions: PendingBlockSuggestion[] = [
    {
      id: 'sugg-block-0001', blocId: 'block-0001', suggestedName: 'Avenue Nasser',
      comment: 'Écrit sur une pancarte au coin de la rue',
      proposedAtUtc: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
  ];

  private streets: StreetToName[] = [
    { id: 'street-0001', code: 'STR-0001', name: null, type: 'Impasse', boundaryWkt: null },
    { id: 'street-0002', code: 'STR-0002', name: null, type: 'Piste', boundaryWkt: null },
    { id: 'street-0003', code: 'STR-0003', name: 'Impasse du Puits', type: 'Impasse', boundaryWkt: null },
  ];

  private streetSuggestions: PendingStreetSuggestion[] = [
    {
      id: 'sugg-street-0001', streetId: 'street-0001', suggestedName: 'Impasse Saint-Pierre', comment: null,
      proposedAtUtc: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    },
  ];

  private properties: PropertyToNumber[] = [
    {
      id: 'property-0001',
      blockCode: 'BLK-Q7-021',
      blockName: null,
      numero: '22',
      quartierName: 'Q7',
      cityName: 'Djibouti-ville',
      adminHierarchy: { region: 'Djibouti', ville: 'Djibouti-ville', commune: 'Boulaos', quartier: 'Q7' },
      addressCode: 'DJ-BOU-Q7-BLK-Q7-021-022',
      formattedAddress: '22, Q7, Djibouti-ville',
      status: 'approved',
    },
    {
      id: 'property-0002',
      blockCode: 'BLK-EIN-007',
      blockName: 'Rue des Palmiers',
      numero: '12',
      quartierName: 'Einguela',
      cityName: 'Djibouti-ville',
      adminHierarchy: { region: 'Djibouti', ville: 'Djibouti-ville', commune: 'Boulaos', quartier: 'Einguela' },
      addressCode: 'DJ-BOU-EIN-BLK-EIN-007-012',
      formattedAddress: '12 Rue des Palmiers, Einguela, Djibouti-ville',
      status: 'approved',
    },
  ];

  // --- Blocs ---------------------------------------------------------------

  override listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]> {
    const pendingBlocIds = new Set(this.blockSuggestions.map((s) => s.blocId));
    const search = query.search.trim().toLowerCase();
    const filtered = this.blocks
      .filter((b) => !pendingBlocIds.has(b.id))
      .filter((b) => !query.onlyUnnamed || !b.name)
      .filter((b) => !search || b.code.toLowerCase().includes(search) || (b.name ?? '').toLowerCase().includes(search));
    return of(filtered).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override setBlockName(id: UUID, payload: UpdateBlockPayload): Observable<BlockToName> {
    const existing = this.blocks.find((b) => b.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: BlockToName = { ...existing, ...payload };
    this.blocks = this.blocks.map((b) => (b.id === id ? updated : b));
    if (payload.name) this.propagateBlockName(existing.code, payload.name);
    return of(updated).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override approveBlockSuggestion(suggestionId: UUID): Observable<void> {
    const suggestion = this.blockSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const block = this.blocks.find((b) => b.id === suggestion.blocId);
    if (block) {
      this.blocks = this.blocks.map((b) => (b.id === block.id ? { ...b, name: suggestion.suggestedName } : b));
      this.propagateBlockName(block.code, suggestion.suggestedName);
    }
    this.blockSuggestions = this.blockSuggestions.filter((s) => s.id !== suggestionId);
    return of(undefined).pipe(delay(300));
  }

  override rejectBlockSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void> {
    if (!this.blockSuggestions.some((s) => s.id === suggestionId)) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    // En mock, on retire simplement la suggestion — en réel elle reste en base avec status='Rejected' (historique conservé).
    void rejectionReason;
    this.blockSuggestions = this.blockSuggestions.filter((s) => s.id !== suggestionId);
    return of(undefined).pipe(delay(300));
  }

  override listPendingBlockSuggestions(): Observable<PendingBlockSuggestion[]> {
    return of(this.blockSuggestions).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  private propagateBlockName(blockCode: string, name: string): void {
    this.properties = this.properties.map((p) =>
      p.blockCode === blockCode
        ? { ...p, blockName: name, formattedAddress: `${p.numero} ${name}, ${p.quartierName}, ${p.cityName}` }
        : p,
    );
  }

  // --- Rues (liste plate, aucun regroupement par bloc — voir décision) ------

  override listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]> {
    const pendingStreetIds = new Set(this.streetSuggestions.map((s) => s.streetId));
    const search = query.search.trim().toLowerCase();
    const filtered = this.streets
      .filter((s) => !pendingStreetIds.has(s.id))
      .filter((s) => !query.onlyUnnamed || !s.name)
      .filter((s) => !search || s.code.toLowerCase().includes(search) || (s.name ?? '').toLowerCase().includes(search));
    return of(filtered).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override setStreetName(id: UUID, payload: UpdateStreetNamePayload): Observable<StreetToName> {
    const existing = this.streets.find((s) => s.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: StreetToName = { ...existing, ...payload };
    this.streets = this.streets.map((s) => (s.id === id ? updated : s));
    return of(updated).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override approveStreetSuggestion(suggestionId: UUID): Observable<void> {
    const suggestion = this.streetSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    this.streets = this.streets.map((s) => (s.id === suggestion.streetId ? { ...s, name: suggestion.suggestedName } : s));
    this.streetSuggestions = this.streetSuggestions.filter((s) => s.id !== suggestionId);
    return of(undefined).pipe(delay(300));
  }

  override rejectStreetSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void> {
    if (!this.streetSuggestions.some((s) => s.id === suggestionId)) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    void rejectionReason;
    this.streetSuggestions = this.streetSuggestions.filter((s) => s.id !== suggestionId);
    return of(undefined).pipe(delay(300));
  }

  override listPendingStreetSuggestions(): Observable<PendingStreetSuggestion[]> {
    return of(this.streetSuggestions).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  // --- Propriétés ------------------------------------------------------------

  override listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]> {
    const filtered = this.properties.filter((p) => !query.blockId || p.blockCode === query.blockId);
    return of(filtered).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber> {
    const existing = this.properties.find((p) => p.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const blockPart = existing.blockName ? ` ${existing.blockName}` : '';
    const updated: PropertyToNumber = {
      ...existing,
      numero: payload.numero,
      addressCode: existing.addressCode.replace(/-\d+(-BIS)?$/i, `-${payload.numero}`),
      formattedAddress: `${payload.numero}${blockPart}, ${existing.quartierName}, ${existing.cityName}`,
    };
    this.properties = this.properties.map((p) => (p.id === id ? updated : p));
    return of(updated).pipe(delay(300));
  }
}
