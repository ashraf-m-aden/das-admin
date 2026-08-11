import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { BlocksApiPort } from './blocks-api.port';
import { AddressWorkflowStage, Block, BlockStatus, GeoJSONMultiPolygon, UUID } from '../../models/das.models';
import {
  BlockListItem,
  BlockListQuery,
  BlockParcelSummary,
  BlockWithParcels,
  VERIFIED_STAGES,
} from '../models/blocks.models';

function squareMulti(centerLng: number, centerLat: number, sizeDeg: number): GeoJSONMultiPolygon {
  const h = sizeDeg / 2;
  return {
    type: 'MultiPolygon',
    coordinates: [[[
      [centerLng - h, centerLat - h], [centerLng + h, centerLat - h],
      [centerLng + h, centerLat + h], [centerLng - h, centerLat + h],
      [centerLng - h, centerLat - h],
    ]]],
  };
}

@Injectable({ providedIn: 'root' })
export class MockBlocksApiService extends BlocksApiPort {
  private static readonly SIMULATED_LATENCY_MS = 450;

  private static readonly USER_NAMES: Record<string, string> = {
    'mock-surveyor-0001': 'Amina Moussa',
    'mock-surveyor-0002': 'Farah Ali',
  };

  /** Fraction de parcelles « vérifiées » selon le statut du bloc. */
  private static readonly VERIFIED_FRACTION: Record<BlockStatus, number> = {
    approved: 1,
    submitted: 0.85,
    in_progress: 0.5,
    assigned: 0.1,
    needs_redo: 0.3,
    not_assigned: 0,
  };

  private blocks: Block[] = [
    {
      id: 'block-0001', adminUnitId: 'unit-q7', code: 'DJ-BOU-Q7-B012', name: null,
      geom: squareMulti(43.148, 11.595, 0.004), areaM2: 12500, status: 'approved',
      assignedUserId: 'mock-surveyor-0001', sourceFile: 'import_q7_2026-01.geojson',
      importedBy: 'mock-admin-0001', importedAt: new Date('2026-01-12').toISOString(), updatedAt: new Date('2026-03-01').toISOString(),
    },
    {
      id: 'block-0002', adminUnitId: 'unit-q3', code: 'BLK-Q3-014', name: null,
      geom: squareMulti(43.132, 11.545, 0.005), areaM2: 18700, status: 'in_progress',
      assignedUserId: 'mock-surveyor-0001', sourceFile: 'import_q3_2026-02.geojson',
      importedBy: 'mock-admin-0001', importedAt: new Date('2026-02-05').toISOString(), updatedAt: new Date('2026-07-20').toISOString(),
    },
    {
      id: 'block-0003', adminUnitId: 'unit-rasdika', code: 'BLK-RD-002', name: null,
      geom: squareMulti(43.158, 11.605, 0.003), areaM2: 9800, status: 'submitted',
      assignedUserId: 'mock-surveyor-0002', sourceFile: 'import_rasdika_2026-02.geojson',
      importedBy: 'mock-admin-0001', importedAt: new Date('2026-02-18').toISOString(), updatedAt: new Date('2026-07-28').toISOString(),
    },
    {
      id: 'block-0004', adminUnitId: 'unit-einguela', code: 'BLK-EIN-007', name: 'Rue des Palmiers',
      geom: squareMulti(43.140, 11.615, 0.004), areaM2: 15200, status: 'needs_redo',
      assignedUserId: 'mock-surveyor-0002', sourceFile: 'import_einguela_2026-03.geojson',
      importedBy: 'mock-admin-0001', importedAt: new Date('2026-03-02').toISOString(), updatedAt: new Date('2026-07-31').toISOString(),
    },
    {
      id: 'block-0005', adminUnitId: 'unit-q7', code: 'BLK-Q7-021', name: null,
      geom: squareMulti(43.150, 11.585, 0.0035), areaM2: 11000, status: 'not_assigned',
      assignedUserId: null, sourceFile: 'import_q7_2026-01.geojson',
      importedBy: 'mock-admin-0001', importedAt: new Date('2026-01-12').toISOString(), updatedAt: new Date('2026-01-12').toISOString(),
    },
  ];

  private parcelsTotalFor(b: Block): number {
    return Math.max(1, Math.round(b.areaM2 / 800));
  }

  private parcelsVerifiedFor(b: Block, total: number): number {
    return Math.round(total * MockBlocksApiService.VERIFIED_FRACTION[b.status]);
  }

  private toListItem(b: Block): BlockListItem {
    const total = this.parcelsTotalFor(b);
    return {
      ...b,
      assignedUserName: b.assignedUserId ? (MockBlocksApiService.USER_NAMES[b.assignedUserId] ?? null) : null,
      parcelsTotal: total,
      parcelsVerified: this.parcelsVerifiedFor(b, total),
    };
  }

  override list(query: BlockListQuery): Observable<BlockListItem[]> {
    const search = query.search.trim().toLowerCase();
    const filtered = this.blocks.filter((b) => {
      const matchesSearch = !search || b.code.toLowerCase().includes(search) || (b.name ?? '').toLowerCase().includes(search);
      const matchesStatus = !query.status || b.status === query.status;
      const matchesZone = !query.adminUnitId || b.adminUnitId === query.adminUnitId;
      return matchesSearch && matchesStatus && matchesZone;
    });
    return of(filtered.map((b) => this.toListItem(b))).pipe(delay(MockBlocksApiService.SIMULATED_LATENCY_MS));
  }

  override getById(id: UUID): Observable<BlockWithParcels> {
    const block = this.blocks.find((b) => b.id === id);
    if (!block) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    const total = this.parcelsTotalFor(block);
    const verified = this.parcelsVerifiedFor(block, total);
    const parcels: BlockParcelSummary[] = Array.from({ length: total }, (_, i) => {
      const stage: AddressWorkflowStage = i < verified ? VERIFIED_STAGES[i % VERIFIED_STAGES.length] : 'registered';
      return { id: `${id}-p${String(i + 1).padStart(3, '0')}`, numero: String(i + 1), workflowStage: stage };
    });

    return of({ ...block, parcels }).pipe(delay(MockBlocksApiService.SIMULATED_LATENCY_MS));
  }

  override assign(id: UUID, userId: UUID): Observable<Block> {
    const existing = this.blocks.find((b) => b.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: Block = {
      ...existing, assignedUserId: userId,
      status: existing.status === 'not_assigned' ? 'assigned' : existing.status,
      updatedAt: new Date().toISOString(),
    };
    this.blocks = this.blocks.map((b) => (b.id === id ? updated : b));
    return of(updated).pipe(delay(300));
  }

  override setName(id: UUID, name: string): Observable<Block> {
    const existing = this.blocks.find((b) => b.id === id);
    if (!existing) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated: Block = { ...existing, name, updatedAt: new Date().toISOString() };
    this.blocks = this.blocks.map((b) => (b.id === id ? updated : b));
    return of(updated).pipe(delay(300));
  }
}
