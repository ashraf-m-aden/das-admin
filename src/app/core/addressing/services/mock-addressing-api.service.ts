import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AddressingApiPort } from './addressing-api.port';
import { UUID } from '../../models/das.models';
import {
  AssignBlockNamePayload,
  AssignHouseNumberPayload,
  AssignStreetNamePayload,
  BlockNamingQuery,
  BlockToName,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
} from '../models/addressing.models';

@Injectable({ providedIn: 'root' })
export class MockAddressingApiService extends AddressingApiPort {
  private static readonly SIMULATED_LATENCY_MS = 400;

  private blocks: BlockToName[] = [
    { id: 'block-0001', code: 'BLK-Q7-021', suggestedName: 'Avenue Nasser', name: null, status: 'approved' },
    { id: 'block-0002', code: 'BLK-Q3-014', suggestedName: null, name: null, status: 'approved' },
    { id: 'block-0003', code: 'BLK-RD-002', suggestedName: 'Rue du Marché', name: null, status: 'approved' },
    { id: 'block-0004', code: 'BLK-EIN-007', suggestedName: 'Rue des Palmiers', name: 'Rue des Palmiers', status: 'approved' },
  ];

  // Ids alignés sur MockSettingsApiService.roadTypes (road-type-street, road-type-avenue, road-type-alley...)
  private streets: StreetToName[] = [
    {
      id: 'street-0001',
      blockCode: 'BLK-Q7-021',
      suggestedName: 'Ruelle Saint-Pierre',
      nameFr: null,
      nameAr: null,
      roadTypeId: null,
      signPresent: true,
      nameVisible: true,
      status: 'approved',
    },
    {
      id: 'street-0002',
      blockCode: 'BLK-Q7-021',
      suggestedName: null,
      nameFr: null,
      nameAr: null,
      roadTypeId: null,
      signPresent: false,
      nameVisible: false,
      status: 'approved',
    },
    {
      id: 'street-0003',
      blockCode: 'BLK-RD-002',
      suggestedName: 'Impasse du Puits',
      nameFr: 'Impasse du Puits',
      nameAr: null,
      roadTypeId: 'road-type-alley',
      signPresent: true,
      nameVisible: false,
      status: 'approved',
    },
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
      blockCode: 'BLK-Q7-021',
      blockName: null,
      lotCode: 'A',
      houseNumber: '22',
      quartierName: 'Q7',
      cityName: 'Djibouti-ville',
      adminHierarchy: { region: 'Djibouti', commune: 'Boulaos', arrondissement: 'Arrondissement 2', quartier: 'Q7' },
      addressCode: 'DJ-BOU-ARR2-Q7-BLK-Q7-021-A-022-BIS',
      formattedAddress: '22 bis, Q7, Djibouti-ville',
      status: 'approved',
    },
    {
      id: 'property-0003',
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

  override listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]> {
    const search = query.search.trim().toLowerCase();
    const filtered = this.blocks.filter((b) => {
      if (b.status !== 'approved') return false;
      if (query.onlyUnnamed && b.name) return false;
      if (!search) return true;
      return (
        b.code.toLowerCase().includes(search) ||
        (b.name ?? '').toLowerCase().includes(search) ||
        (b.suggestedName ?? '').toLowerCase().includes(search)
      );
    });
    return of(filtered).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override assignBlockName(id: UUID, payload: AssignBlockNamePayload): Observable<BlockToName> {
    const existingBlock = this.blocks.find((b) => b.id === id);
    if (!existingBlock) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    const updatedBlock: BlockToName = { ...existingBlock, name: payload.name };
    this.blocks = this.blocks.map((b) => (b.id === id ? updatedBlock : b));

    this.properties = this.properties.map((p) =>
      p.blockCode === existingBlock.code
        ? { ...p, blockName: payload.name, formattedAddress: this.buildFormattedAddress(p, p.houseNumber, payload.name) }
        : p,
    );

    return of(updatedBlock).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]> {
    const search = query.search.trim().toLowerCase();
    const filtered = this.streets.filter((s) => {
      if (s.status !== 'approved') return false;
      if (query.onlyUnnamed && s.nameFr) return false;
      if (!search) return true;
      return (
        s.blockCode.toLowerCase().includes(search) ||
        (s.nameFr ?? '').toLowerCase().includes(search) ||
        (s.suggestedName ?? '').toLowerCase().includes(search)
      );
    });
    return of(filtered).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override assignStreetName(id: UUID, payload: AssignStreetNamePayload): Observable<StreetToName> {
    const existing = this.streets.find((s) => s.id === id);
    if (!existing) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }
    const updated: StreetToName = {
      ...existing,
      nameFr: payload.nameFr,
      nameAr: payload.nameAr,
      roadTypeId: payload.roadTypeId,
    };
    this.streets = this.streets.map((s) => (s.id === id ? updated : s));
    return of(updated).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]> {
    const filtered = this.properties.filter(
      (p) => p.status === 'approved' && (!query.blockId || p.blockCode === query.blockId),
    );
    return of(filtered).pipe(delay(MockAddressingApiService.SIMULATED_LATENCY_MS));
  }

  override assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber> {
    const existing = this.properties.find((p) => p.id === id);
    if (!existing) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    const updated: PropertyToNumber = {
      ...existing,
      houseNumber: payload.houseNumber,
      addressCode: existing.addressCode.replace(/-\d+(-BIS)?$/i, `-${payload.houseNumber}`),
      formattedAddress: this.buildFormattedAddress(existing, payload.houseNumber, existing.blockName),
    };
    this.properties = this.properties.map((p) => (p.id === id ? updated : p));
    return of(updated).pipe(delay(300));
  }

  private buildFormattedAddress(property: PropertyToNumber, houseNumber: string, blockName: string | null): string {
    const blockPart = blockName ? ` ${blockName}` : '';
    return `${houseNumber}${blockPart}, ${property.quartierName}, ${property.cityName}`;
  }
}
