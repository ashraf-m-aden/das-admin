import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { RegistryApiPort } from './registry-api.port';
import { AddressWorkflowStage, PropertyType, UUID } from '../../models/das.models';
import {
  AddressDetail, AddressListItem, BulkUpdatePayload,
  RegistryFilterOptions, RegistryPageResult, RegistryQuery, RegistrySummary,
} from '../models/registry.models';

const STREETS = ['Rue de Rome', 'Avenue 13 Juin', 'Rue d\'Angleterre', 'Boulevard Hassan Gouled', 'Rue d\'Éthiopie', 'Rue de Genève'];
const DISTRICTS = ['Balbala', 'Héron', 'Centre-ville', 'Le Plateau', 'Arhiba'];
const REGIONS = ['Djibouti', 'Arta', 'Dikhil', 'Tadjourah', 'Obock'];
const TEAMS = ['Team North', 'Team Central', 'Team South'];
const TYPES: PropertyType[] = ['residential', 'commercial', 'industrial', 'institutional', 'vacant'];
const STAGES: AddressWorkflowStage[] = ['registered', 'surveyed', 'verified', 'approved', 'published'];
import { GeoJSONMultiPolygon } from '../../models/das.models';

function squareMulti(lng: number, lat: number, size: number): GeoJSONMultiPolygon {
  const h = size / 2;
  return { type: 'MultiPolygon', coordinates: [[[
    [lng - h, lat - h], [lng + h, lat - h], [lng + h, lat + h], [lng - h, lat + h], [lng - h, lat - h],
  ]]] };
}
@Injectable({ providedIn: 'root' })
export class MockRegistryApiService extends RegistryApiPort {
  private static readonly LATENCY = 380;

  private records: AddressListItem[] = Array.from({ length: 47 }, (_, i) => {
    const n = 12345 + i;
const lng = 43.134 + (i % 8) * 0.0045;
    const lat = 11.588 + Math.floor(i / 8) * 0.0045;
    return {
      id: `addr-${n}`,
      addressCode: `ADDR-${String(n).padStart(8, '0')}`,
      postcode: `PC ${1001 + (i % 6)}`,
      street: `${8 + (i % 60)} ${STREETS[i % STREETS.length]}`,
      district: DISTRICTS[i % DISTRICTS.length],
      propertyType: TYPES[i % TYPES.length],
      workflowStage: STAGES[i % STAGES.length],
      lastUpdate: new Date(2026, 6, 1 + (i % 28), 9, (i * 7) % 60).toISOString(),
      assignedTeamName: TEAMS[i % TEAMS.length],
      geom: squareMulti(lng, lat, 0.0028),
    };
  });

  override summary(): Observable<RegistrySummary> {
    const pending = this.records.filter((r) => r.workflowStage === 'surveyed' || r.workflowStage === 'registered').length;
    const published = this.records.filter((r) => r.workflowStage === 'published').length;
    return of({
      totalRecords: this.records.length,
      pendingReview: pending,
      duplicatesFlagged: 3,
      publishedToday: published,
    }).pipe(delay(MockRegistryApiService.LATENCY));
  }

  override filterOptions(): Observable<RegistryFilterOptions> {
    return of({
      postcodes: [...new Set(this.records.map((r) => r.postcode!).filter(Boolean))].sort(),
      regions: REGIONS,
      teams: TEAMS,
    }).pipe(delay(200));
  }

  override list(query: RegistryQuery): Observable<RegistryPageResult> {
    const { filters, page, pageSize } = query;
    const search = filters.search.trim().toLowerCase();
    const filtered = this.records.filter((r) => {
      if (search && !r.street.toLowerCase().includes(search) && !r.addressCode.toLowerCase().includes(search)) return false;
      if (filters.postcode && r.postcode !== filters.postcode) return false;
      if (filters.status && r.workflowStage !== filters.status) return false;
      if (filters.team && r.assignedTeamName !== filters.team) return false;
      return true;
    });
    const start = (page - 1) * pageSize;
    return of({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    }).pipe(delay(MockRegistryApiService.LATENCY));
  }

  override getDetail(id: UUID): Observable<AddressDetail> {
    const base = this.records.find((r) => r.id === id);
    if (!base) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const detail: AddressDetail = {
      ...base,
      components: {
        street: base.street, district: base.district, commune: 'Boulaos', region: 'Djibouti', postcode: base.postcode,
      },
      location: { latitude: 11.6004 + Math.random() * 0.01, longitude: 43.1456 + Math.random() * 0.01, parcelNumber: `PAR-${base.postcode?.replace(/\D/g, '')}-${base.id.slice(-4)}` },
      propertyInfo: { propertyType: base.propertyType, occupancyType: 'occupied', buildingUse: base.propertyType === 'residential' ? 'Single Family' : null },
      validation: { score: 82 + (base.id.charCodeAt(base.id.length - 1) % 18), notes: 'Adresse vérifiée sur site. Numéro de bâtiment visible.' },
      history: [
        { id: `${id}-h1`, actionKey: 'registry.history.created', actor: 'Team North', at: base.lastUpdate },
        { id: `${id}-h2`, actionKey: 'registry.history.verified', actor: 'Fatouma A.', at: base.lastUpdate },
      ],
      linked: [
        { id: `${id}-l1`, kind: 'street', label: base.street },
        { id: `${id}-l2`, kind: 'postcode', label: base.postcode ?? '—' },
        { id: `${id}-l3`, kind: 'team', label: base.assignedTeamName ?? '—' },
      ],
    };
    return of(detail).pipe(delay(MockRegistryApiService.LATENCY));
  }

  override approve(ids: UUID[]): Observable<void> {
    this.records = this.records.map((r) => (ids.includes(r.id) ? { ...r, workflowStage: 'approved', lastUpdate: new Date().toISOString() } : r));
    return of(void 0).pipe(delay(300));
  }

  override bulkUpdate(payload: BulkUpdatePayload): Observable<void> {
    this.records = this.records.map((r) => {
      if (!payload.ids.includes(r.id)) return r;
      return {
        ...r,
        assignedTeamName: payload.team !== undefined ? payload.team : r.assignedTeamName,
        workflowStage: payload.stage ?? r.workflowStage,
        lastUpdate: new Date().toISOString(),
      };
    });
    return of(void 0).pipe(delay(300));
  }

  override flagForReview(id: UUID): Observable<void> {
    this.records = this.records.map((r) => (r.id === id ? { ...r, workflowStage: 'surveyed', lastUpdate: new Date().toISOString() } : r));
    return of(void 0).pipe(delay(300));
  }
}
