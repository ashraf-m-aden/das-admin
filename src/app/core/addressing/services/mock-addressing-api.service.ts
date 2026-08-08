import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AddressingApiPort } from './addressing-api.port';
import { UUID } from '../../models/das.models';
import {
  AssignHouseNumberPayload,
  BlockNamingQuery,
  BlockToName,
  NameSuggestion,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
} from '../models/addressing.models';

@Injectable({ providedIn: 'root' })
export class MockAddressingApiService extends AddressingApiPort {
  private static readonly SIMULATED_LATENCY_MS = 400;

  private blocks: BlockToName[] = [
    {
      id: 'block-0001',
      code: 'BLK-Q7-021',
      name: null,
      status: 'approved',
      pendingSuggestion: {
        id: 'sugg-block-0001',
        suggestedName: 'Avenue Nasser',
        comment: 'Écrit sur une pancarte au coin de la rue',
        status: 'pending',
        proposedByName: 'Idriss Agent',
        proposedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        reviewedByName: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    },
    { id: 'block-0002', code: 'BLK-Q3-014', name: null, status: 'approved', pendingSuggestion: null },
    {
      id: 'block-0003',
      code: 'BLK-RD-002',
      name: null,
      status: 'approved',
      pendingSuggestion: {
        id: 'sugg-block-0003',
        suggestedName: 'Rue du Marché',
        comment: null,
        status: 'pending',
        proposedByName: 'Warsama Robleh',
        proposedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        reviewedByName: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    },
    { id: 'block-0004', code: 'BLK-EIN-007', name: 'Rue des Palmiers', status: 'approved', pendingSuggestion: null },
  ];

  private streets: StreetToName[] = [
    {
      id: 'street-0001',
      code: 'STR-0001',
      name: null,
      type: 'Impasse',
      pendingSuggestion: {
        id: 'sugg-street-0001',
        suggestedName: 'Impasse Saint-Pierre',
        comment: null,
        status: 'pending',
        proposedByName: 'Idriss Agent',
        proposedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        reviewedByName: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    },
    { id: 'street-0002', code: 'STR-0002', name: null, type: 'Piste', pendingSuggestion: null },
    { id: 'street-0003', code: 'STR-0003', name: 'Impasse du Puits', type: 'Impasse', pendingSuggestion: null },
  ];

  private properties: PropertyToNumber[] = [
    {
      id: 'property-0001',
      blockCode: 'BLK-Q7-021',
      blockName: null,
      lotCode: 'A',
      houseNumber: '22',
      quartierName: 'Q7',
      cityName: 'Djibouti-ville',
      adminHierarchy: { region: 'Djibouti', commune: 'Boulaos', arrondissement: 'Arrondissement 2', quartier: 'Q7' },
      addressCode: 'DJ-BOU-ARR2-Q7-BLK-Q7-021-A-022',
      formattedAddress: '22, Q7, Djibouti-ville',
      status: 'approved',
    },
    {
      id: 'property-0002',
      blockCode: 'BLK-EIN-007',
      blockName: 'Rue des Palmiers',
      lotCode: 'B',
      houseNumber: '12',
      quartierName: 'Einguela',
      cityName: 'Djibouti-ville',
      adminHierarchy: { region: 'Djibouti', commune: 'Boulaos', arrondissement: null, quartier: 'Einguela' },
      addressCode: 'DJ-BOU-EIN-BLK-EIN-007-B-012',
      formattedAddress: '12 Rue des Palmiers, Einguela, Djibouti-ville',
      status: 'approved',
    },
  ];

  // --- Blocs ---------------------------------------------------------------

  override listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]> {
    const search = query.search.trim().toLowerCase();
    const filtered = this.blocks.filter((b) => {
      if (query.onlyUnnamed && b.name) return false;
      if (!search) return true;
      return (
        b.code.toLowerCase().includes(search) ||
        (b.name ?? '').toLowerCase().includes(search) ||
        (b.pendingSuggestion?.suggestedName ?? '').toLowerCase().includes(search)
      );
    });
    return of(filtered).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override setBlockName(id: UUID, name: string): Observable<BlockToName> {
    const existing = this.blocks.find((b) => b.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: BlockToName = { ...existing, name, pendingSuggestion: null };
    this.blocks = this.blocks.map((b) => (b.id === id ? updated : b));
    this.propagateBlockName(existing.code, name);
    return of(updated).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override approveBlockSuggestion(id: UUID, suggestionId: UUID): Observable<BlockToName> {
    const existing = this.blocks.find((b) => b.id === id);
    if (!existing?.pendingSuggestion || existing.pendingSuggestion.id !== suggestionId) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    const name = existing.pendingSuggestion.suggestedName;
    const updated: BlockToName = { ...existing, name, pendingSuggestion: null };
    this.blocks = this.blocks.map((b) => (b.id === id ? updated : b));
    this.propagateBlockName(existing.code, name);
    return of(updated).pipe(delay(300));
  }

  override rejectBlockSuggestion(id: UUID, suggestionId: UUID, reason: string): Observable<BlockToName> {
    const existing = this.blocks.find((b) => b.id === id);
    if (!existing?.pendingSuggestion || existing.pendingSuggestion.id !== suggestionId) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    // En mock, on retire simplement la suggestion — en réel elle reste en base avec status='Rejected' (historique conservé).
    const updated: BlockToName = { ...existing, pendingSuggestion: null };
    this.blocks = this.blocks.map((b) => (b.id === id ? updated : b));
    return of(updated).pipe(delay(300));
  }

  private propagateBlockName(blockCode: string, name: string): void {
    this.properties = this.properties.map((p) =>
      p.blockCode === blockCode
        ? { ...p, blockName: name, formattedAddress: `${p.houseNumber} ${name}, ${p.quartierName}, ${p.cityName}` }
        : p,
    );
  }

  // --- Rues (liste plate, aucun regroupement par bloc — voir décision) ------

  override listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]> {
    const search = query.search.trim().toLowerCase();
    const filtered = this.streets.filter((s) => {
      if (query.onlyUnnamed && s.name) return false;
      if (!search) return true;
      return (
        s.code.toLowerCase().includes(search) ||
        (s.name ?? '').toLowerCase().includes(search) ||
        (s.pendingSuggestion?.suggestedName ?? '').toLowerCase().includes(search)
      );
    });
    return of(filtered).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override setStreetName(id: UUID, name: string): Observable<StreetToName> {
    const existing = this.streets.find((s) => s.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: StreetToName = { ...existing, name, pendingSuggestion: null };
    this.streets = this.streets.map((s) => (s.id === id ? updated : s));
    return of(updated).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override approveStreetSuggestion(id: UUID, suggestionId: UUID): Observable<StreetToName> {
    const existing = this.streets.find((s) => s.id === id);
    if (!existing?.pendingSuggestion || existing.pendingSuggestion.id !== suggestionId) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    const updated: StreetToName = { ...existing, name: existing.pendingSuggestion.suggestedName, pendingSuggestion: null };
    this.streets = this.streets.map((s) => (s.id === id ? updated : s));
    return of(updated).pipe(delay(300));
  }

  override rejectStreetSuggestion(id: UUID, suggestionId: UUID, reason: string): Observable<StreetToName> {
    const existing = this.streets.find((s) => s.id === id);
    if (!existing?.pendingSuggestion || existing.pendingSuggestion.id !== suggestionId) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    const updated: StreetToName = { ...existing, pendingSuggestion: null };
    this.streets = this.streets.map((s) => (s.id === id ? updated : s));
    return of(updated).pipe(delay(300));
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
      houseNumber: payload.houseNumber,
      addressCode: existing.addressCode.replace(/-\d+(-BIS)?$/i, `-${payload.houseNumber}`),
      formattedAddress: `${payload.houseNumber}${blockPart}, ${existing.quartierName}, ${existing.cityName}`,
    };
    this.properties = this.properties.map((p) => (p.id === id ? updated : p));
    return of(updated).pipe(delay(300));
  }
}
