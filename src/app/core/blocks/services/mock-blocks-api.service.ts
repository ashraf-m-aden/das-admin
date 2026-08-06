import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { BlocksApiPort } from './blocks-api.port';
import { Block, GeoJSONPolygon, UUID } from '../../models/das.models';
import { BlockListQuery, BlockWithLots } from '../models/blocks.models';

/**
 * Géométries factices centrées sur Djibouti-ville (bbox ~[41.5,10.9,43.5,12.8],
 * cohérente avec docker/martin/config.yaml). Suffisant pour tester la carte
 * en overlay GeoJSON sans Martin/Postgres.
 */
function square(centerLng: number, centerLat: number, sizeDeg: number): GeoJSONPolygon {
  const h = sizeDeg / 2;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [centerLng - h, centerLat - h],
        [centerLng + h, centerLat - h],
        [centerLng + h, centerLat + h],
        [centerLng - h, centerLat + h],
        [centerLng - h, centerLat - h],
      ],
    ],
  };
}

@Injectable({ providedIn: 'root' })
export class MockBlocksApiService extends BlocksApiPort {
  private static readonly SIMULATED_LATENCY_MS = 450;

  private blocks: Block[] = [
    {
      id: 'block-0001',
      adminUnitId: 'zone-q7',
      code: 'DJ-BOU-ARR2-Q7-B012',
      geomPolygon: square(43.148, 11.595, 0.004),
      areaM2: 12500,
      status: 'approved',
      assignedUserId: 'mock-surveyor-0001',
      sourceFile: 'import_q7_2026-01.geojson',
      importedBy: 'mock-admin-0001',
      importedAt: new Date('2026-01-12').toISOString(),
      updatedAt: new Date('2026-03-01').toISOString(),
    },
    {
      id: 'block-0002',
      adminUnitId: 'zone-q3',
      code: 'BLK-Q3-014',
      geomPolygon: square(43.132, 11.545, 0.005),
      areaM2: 18700,
      status: 'in_progress',
      assignedUserId: 'mock-surveyor-0001',
      sourceFile: 'import_q3_2026-02.geojson',
      importedBy: 'mock-admin-0001',
      importedAt: new Date('2026-02-05').toISOString(),
      updatedAt: new Date('2026-07-20').toISOString(),
    },
    {
      id: 'block-0003',
      adminUnitId: 'zone-rasdika',
      code: 'BLK-RD-002',
      geomPolygon: square(43.158, 11.605, 0.003),
      areaM2: 9800,
      status: 'submitted',
      assignedUserId: 'mock-surveyor-0002',
      sourceFile: 'import_rasdika_2026-02.geojson',
      importedBy: 'mock-admin-0001',
      importedAt: new Date('2026-02-18').toISOString(),
      updatedAt: new Date('2026-07-28').toISOString(),
    },
    {
      id: 'block-0004',
      adminUnitId: 'zone-einguela',
      code: 'BLK-EIN-007',
      geomPolygon: square(43.140, 11.615, 0.004),
      areaM2: 15200,
      status: 'needs_redo',
      assignedUserId: 'mock-surveyor-0002',
      sourceFile: 'import_einguela_2026-03.geojson',
      importedBy: 'mock-admin-0001',
      importedAt: new Date('2026-03-02').toISOString(),
      updatedAt: new Date('2026-07-31').toISOString(),
    },
    {
      id: 'block-0005',
      adminUnitId: 'zone-q7',
      code: 'BLK-Q7-021',
      geomPolygon: square(43.150, 11.585, 0.0035),
      areaM2: 11000,
      status: 'not_assigned',
      assignedUserId: null,
      sourceFile: 'import_q7_2026-01.geojson',
      importedBy: 'mock-admin-0001',
      importedAt: new Date('2026-01-12').toISOString(),
      updatedAt: new Date('2026-01-12').toISOString(),
    },
  ];

  override list(query: BlockListQuery): Observable<Block[]> {
    const search = query.search.trim().toLowerCase();

    const filtered = this.blocks.filter((b) => {
      const matchesSearch = !search || b.code.toLowerCase().includes(search);
      const matchesStatus = !query.status || b.status === query.status;
      const matchesZone = !query.adminUnitId || b.adminUnitId === query.adminUnitId;
      return matchesSearch && matchesStatus && matchesZone;
    });

    return of(filtered).pipe(delay(MockBlocksApiService.SIMULATED_LATENCY_MS));
  }

  override getById(id: UUID): Observable<BlockWithLots> {
    const block = this.blocks.find((b) => b.id === id);
    if (!block) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    const withLots: BlockWithLots = {
      ...block,
      lots: [
        {
          id: `${id}-lot-a`,
          blockId: id,
          code: 'A',
          plannedType: 'residential',
          plannedUnitCount: 18,
          actualUnitCount: block.status === 'approved' ? 18 : 6,
          status: block.status === 'approved' ? 'completed' : 'in_progress',
          createdAt: block.importedAt,
        },
      ],
    };

    return of(withLots).pipe(delay(MockBlocksApiService.SIMULATED_LATENCY_MS));
  }

  override assign(id: UUID, userId: UUID): Observable<Block> {
    const existing = this.blocks.find((b) => b.id === id);
    if (!existing) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    const updated: Block = {
      ...existing,
      assignedUserId: userId,
      status: existing.status === 'not_assigned' ? 'assigned' : existing.status,
      updatedAt: new Date().toISOString(),
    };
    this.blocks = this.blocks.map((b) => (b.id === id ? updated : b));

    return of(updated).pipe(delay(300));
  }
}
