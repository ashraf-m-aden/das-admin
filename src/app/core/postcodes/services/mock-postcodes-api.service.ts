import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { PostcodesApiPort } from './postcodes-api.port';
import { AllocatePostcodePayload, PostcodeRow, PostcodesData } from '../models/postcodes.models';

const REGIONS = ['Djibouti', 'Arta', 'Dikhil', 'Tadjourah', 'Obock'];
const AREAS = ['Boulaos', 'Balbala', 'Héron', 'Le Plateau', 'Einguela', 'Arhiba'];

@Injectable({ providedIn: 'root' })
export class MockPostcodesApiService extends PostcodesApiPort {
  private rows: PostcodeRow[] = Array.from({ length: 18 }, (_, i) => ({
    id: `pc-${i}`,
    code: `PC ${1001 + i}`,
    adminUnitName: AREAS[i % AREAS.length],
    region: REGIONS[i % REGIONS.length],
    addressCount: 400 + ((i * 137) % 1800),
    status: i % 7 === 0 ? 'reserved' : i % 11 === 0 ? 'retired' : 'active',
    issuedAt: new Date(2025, i % 12, 3 + (i % 20)).toISOString(),
  }));

  private data(): PostcodesData {
    return {
      rows: this.rows,
      monthly: [
        { month: 'Déc', count: 5200 }, { month: 'Jan', count: 6900 }, { month: 'Fév', count: 7400 },
        { month: 'Mar', count: 8600 }, { month: 'Avr', count: 8900 }, { month: 'Mai', count: 10194 },
      ],
      totalIssued: 10194,
      activeCount: this.rows.filter((r) => r.status === 'active').length,
      reservedCount: this.rows.filter((r) => r.status === 'reserved').length,
    };
  }

  override load(): Observable<PostcodesData> { return of(this.data()).pipe(delay(360)); }

  override allocate(payload: AllocatePostcodePayload): Observable<PostcodeRow> {
    const row: PostcodeRow = {
      id: `pc-${this.rows.length}`, code: payload.code, adminUnitName: payload.adminUnitName,
      region: payload.region, addressCount: 0, status: 'reserved', issuedAt: new Date().toISOString(),
    };
    this.rows = [row, ...this.rows];
    return of(row).pipe(delay(300));
  }
}
